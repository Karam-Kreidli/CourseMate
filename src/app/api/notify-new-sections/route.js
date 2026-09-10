import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendPushToUsers } from '@/lib/push/server';

let resend = null;
const getResend = () => {
    if (!resend && process.env.RESEND_API_KEY) resend = new Resend(process.env.RESEND_API_KEY);
    return resend;
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * A section appeared in Banner that was not there before.
 *
 * Called by the sync-sections edge function, not by a signed-in user, so it
 * authenticates with CRON_SECRET the way the other scheduled routes do.
 *
 * Who hears about it is decided in SQL by new_section_audience(), which applies
 * both gates: the course is in the student's major study plan, and the
 * section's campus rule admits them.
 *
 * The audience is then split by channel, because reach is wildly uneven — the
 * median course sits in 6 study plans but the common core sits in all 149:
 *
 *   in-app   → everyone the function returns
 *   email +  → only students with `planning` true, meaning the course is
 *   push       already in their cart or a saved schedule for the term
 *
 * So a new section of a first-year core course puts a badge on 149 bells and
 * sends about five emails, instead of mailing the whole university about a
 * course most of them finished two years ago.
 */
export async function POST(request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const termCode = body?.term_code;
    const sections = Array.isArray(body?.sections) ? body.sections : [];
    if (!termCode || sections.length === 0) {
        return NextResponse.json({ success: true, notified: 0 });
    }

    const admin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const byCrn = new Map(sections.map(s => [String(s.crn), s]));
    const crns = [...byCrn.keys()];

    const { data: audience, error } = await admin.rpc('new_section_audience', {
        p_term: termCode,
        p_crns: crns,
    });
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!audience?.length) return NextResponse.json({ success: true, notified: 0 });

    const courseCodes = [...new Set(sections.map(s => s.course_code))];
    const { data: courses } = await admin
        .from('courses').select('course_id, course_name').in('course_id', courseCodes);
    const nameOf = new Map((courses || []).map(c => [c.course_id, c.course_name]));

    // Per student: which new sections concern them, and whether any of them is
    // for a course they are actively planning.
    const perUser = new Map();
    for (const row of audience) {
        const section = byCrn.get(String(row.crn));
        if (!section) continue;
        if (!perUser.has(row.user_id)) perUser.set(row.user_id, { list: [], planning: false });
        const entry = perUser.get(row.user_id);
        if (!entry.list.some(s => String(s.crn) === String(section.crn))) entry.list.push(section);
        if (row.planning) entry.planning = true;
    }
    if (perUser.size === 0) return NextResponse.json({ success: true, notified: 0 });

    const describe = (s) => {
        const label = nameOf.get(s.course_code)
            ? `${s.course_code} - ${nameOf.get(s.course_code)}`
            : s.course_code;
        const when = s.class_time ? ` — ${s.class_time}` : '';
        const who = s.instructor ? `, ${s.instructor}` : '';
        return `${label} (Section ${s.section_num}, CRN ${s.crn})${when}${who}`;
    };

    const titleFor = (list) => list.length === 1
        ? `New section in ${list[0].course_code}`
        : `${list.length} new sections in your study plan`;

    const userIds = [...perUser.keys()];

    await admin.from('notifications').insert(userIds.map(uid => {
        const { list } = perUser.get(uid);
        return {
            user_id: uid,
            type: 'new_section',
            title: titleFor(list),
            message: list.map(describe).join('; '),
            data: { reason: 'new_section', term_code: termCode, sections: list },
        };
    }));

    // Email and push are the narrow channel: students actively planning the
    // course, who have not opted out.
    const planningIds = userIds.filter(uid => perUser.get(uid).planning);
    if (planningIds.length === 0) {
        return NextResponse.json({ success: true, notified: userIds.length, emailed: 0 });
    }

    const { data: recipients } = await admin
        .from('profiles')
        .select('id, name, email, email_new_section_alerts')
        .in('id', planningIds);
    const optedIn = (recipients || []).filter(r => r.email_new_section_alerts !== false);
    if (optedIn.length === 0) {
        return NextResponse.json({ success: true, notified: userIds.length, emailed: 0 });
    }

    await sendPushToUsers(admin, optedIn.map(r => r.id), {
        title: 'A new section opened',
        body: 'A course you are planning has a section that was not there before.',
        url: '/schedule',
        tag: `new-sections-${termCode}`,
    });

    const mailer = getResend();
    let emailed = 0;
    if (mailer) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const sent = await Promise.all(optedIn.filter(r => r.email).map(r => {
            const { list } = perUser.get(r.id) || { list: [] };
            if (list.length === 0) return null;
            const items = list.map(s => `<li>${escapeHtml(describe(s))}</li>`).join('');
            return mailer.emails.send({
                from: 'CourseMate <noreply@course-mate.me>',
                to: r.email,
                subject: titleFor(list),
                html: `<p>Hi ${escapeHtml(r.name || 'Student')},</p>
<p>A section that was not there before has appeared in a course you're planning:</p>
<ul>${items}</ul>
<p><a href="${escapeHtml(appUrl)}/schedule">Open CourseMate</a></p>`,
            }).then(() => true).catch(() => null);
        }));
        emailed = sent.filter(Boolean).length;
    }

    return NextResponse.json({
        success: true,
        notified: userIds.length,
        emailed,
        sections: crns.length,
    });
}
