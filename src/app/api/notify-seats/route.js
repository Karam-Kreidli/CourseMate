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

// Called by refresh-seats.js, not by a signed-in user, so it authenticates with
// CRON_SECRET the same way the scheduled routes do.
export async function POST(request) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const termCode = body?.term_code;
    const opened = Array.isArray(body?.opened) ? body.opened : [];
    if (!termCode || opened.length === 0) {
        return NextResponse.json({ success: true, notified: 0 });
    }

    const admin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const courseCodes = [...new Set(opened.map(o => o.course_code))];

    const [{ data: watches }, { data: courses }] = await Promise.all([
        admin.from('section_watches')
            .select('user_id, course_code, want_section')
            .eq('term_code', termCode)
            .in('course_code', courseCodes),
        admin.from('courses').select('course_id, course_name').in('course_id', courseCodes)
    ]);

    const nameOf = new Map((courses || []).map(c => [c.course_id, c.course_name]));

    // The caller only sends sections that are genuinely joinable (open seat,
    // empty waitlist), but this is the last gate before a student's phone
    // buzzes, so re-check rather than trust the payload.
    const joinable = opened.filter(s => Number(s.seats_available) > 0);
    if (joinable.length === 0) return NextResponse.json({ success: true, notified: 0 });

    // A watch with no want_section follows the whole course; one with a
    // section only fires for that section.
    const perUser = new Map();
    for (const section of joinable) {
        for (const w of (watches || [])) {
            if (w.course_code !== section.course_code) continue;
            if (w.want_section && w.want_section !== section.section_num) continue;
            if (!perUser.has(w.user_id)) perUser.set(w.user_id, []);
            const list = perUser.get(w.user_id);
            if (!list.some(s => s.crn === section.crn)) list.push(section);
        }
    }
    if (perUser.size === 0) return NextResponse.json({ success: true, notified: 0 });

    const describe = s => {
        const label = nameOf.get(s.course_code)
            ? `${s.course_code} - ${nameOf.get(s.course_code)}`
            : s.course_code;
        return `${label} (Section ${s.section_num}, CRN ${s.crn}) — ${s.seats_available} seat${s.seats_available === 1 ? '' : 's'} open`;
    };

    const userIds = [...perUser.keys()];
    const rows = userIds.map(uid => {
        const list = perUser.get(uid);
        const title = list.length === 1
            ? `A seat opened in ${list[0].course_code}`
            : `${list.length} sections you watch opened up`;
        return {
            user_id: uid,
            type: 'watch_alert',
            title,
            message: list.map(describe).join('; '),
            data: { reason: 'seats_opened', term_code: termCode, sections: list }
        };
    });
    await admin.from('notifications').insert(rows);

    const { data: recipients } = await admin
        .from('profiles')
        .select('id, name, email, email_watch_alerts')
        .in('id', userIds);
    const optedIn = (recipients || []).filter(r => r.email_watch_alerts !== false);

    await sendPushToUsers(admin, optedIn.map(r => r.id), {
        title: 'A seat opened up',
        body: rows.find(r => optedIn.some(o => o.id === r.user_id))?.message || 'A section you are watching has seats.',
        url: '/schedule',
        tag: `seats-${termCode}`
    });

    const mailer = getResend();
    if (mailer) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        await Promise.all(optedIn.filter(r => r.email).map(r => {
            const list = perUser.get(r.id) || [];
            if (list.length === 0) return null;
            const items = list.map(s => `<li>${escapeHtml(describe(s))}</li>`).join('');
            return mailer.emails.send({
                from: 'CourseMate <noreply@course-mate.me>',
                to: r.email,
                subject: list.length === 1
                    ? `A seat opened in ${list[0].course_code}`
                    : `${list.length} sections you watch opened up`,
                html: `<p>Hi ${escapeHtml(r.name || 'Student')},</p>
<p>A section you're watching has seats available:</p>
<ul>${items}</ul>
<p>Seats move quickly — check the registration portal to enrol.</p>
<p><a href="${escapeHtml(appUrl)}/schedule">Open CourseMate</a></p>`
            }).catch(() => null);
        }));
    }

    return NextResponse.json({ success: true, notified: userIds.length, sections: joinable.length });
}
