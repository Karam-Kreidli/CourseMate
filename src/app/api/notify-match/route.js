import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

let resend = null;
const getResend = () => {
    if (!resend && process.env.RESEND_API_KEY) {
        resend = new Resend(process.env.RESEND_API_KEY);
    }
    return resend;
};

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function emailHtml({ recipientName, courseCode, courseName, theirSection, otherUserName, otherSection, appUrl }) {
    const safeName = escapeHtml(recipientName || 'Student');
    const safeCourseCode = escapeHtml(courseCode || '');
    const safeCourseName = escapeHtml(courseName || '');
    const safeTheirSection = escapeHtml(theirSection || '');
    const safeOtherUserName = escapeHtml(otherUserName || 'Student');
    const safeOtherSection = escapeHtml(otherSection || '');
    const safeAppUrl = escapeHtml(appUrl);
    const courseLine = safeCourseName ? `${safeCourseCode} - ${safeCourseName}` : safeCourseCode;

    return `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #ffffff; color: #333333;">
            <div style="background-color: #0a2540; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Match Available</h1>
            </div>
            <div style="padding: 32px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
                    Hello <strong>${safeName}</strong>,
                </p>
                <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
                    A potential CourseMate match has been found for you.
                </p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 24px; border: 1px solid #eaeaea;">
                    <h3 style="margin: 0 0 16px 0; color: #0a2540; font-size: 18px;">${courseLine}</h3>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #666;">Your Section:</span>
                        <span style="font-weight: 600; color: #333;">${safeTheirSection}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #666;">Their Section:</span>
                        <span style="font-weight: 600; color: #333;">${safeOtherSection}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #666;">Matched With:</span>
                        <span style="font-weight: 600; color: #333;">${safeOtherUserName}</span>
                    </div>
                </div>
                <p style="font-size: 16px; line-height: 1.5; margin: 0 0 32px 0;">
                    Please log in to review and respond to this match request.
                </p>
                <div style="text-align: center;">
                    <a href="${safeAppUrl}/matches"
                       style="background-color: #c9a227; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 16px; display: inline-block;">
                        View Match Details
                    </a>
                </div>
                <p style="margin-top: 40px; font-size: 12px; color: #888888; text-align: center; border-top: 1px solid #eaeaea; padding-top: 20px;">
                    CourseMate - University Section Exchange Platform
                </p>
            </div>
        </div>
    `;
}

export async function POST(request) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const body = await request.json().catch(() => ({}));
        const matchId = body?.matchId;
        if (!matchId || typeof matchId !== 'string') {
            return NextResponse.json({ error: 'matchId required' }, { status: 400 });
        }

        const admin = createServiceClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const { data: match, error: matchErr } = await admin
            .from('matches')
            .select('id, user_a_id, user_b_id, post_a_id, post_b_id')
            .eq('id', matchId)
            .single();
        if (matchErr || !match) {
            return NextResponse.json({ error: 'Match not found' }, { status: 404 });
        }

        if (user.id !== match.user_a_id && user.id !== match.user_b_id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { data: posts, error: postsErr } = await admin
            .from('posts')
            .select('id, user_id, course_code, course_name, have_section')
            .in('id', [match.post_a_id, match.post_b_id]);
        if (postsErr || !posts || posts.length !== 2) {
            return NextResponse.json({ error: 'Posts not found' }, { status: 500 });
        }
        const postA = posts.find(p => p.id === match.post_a_id);
        const postB = posts.find(p => p.id === match.post_b_id);

        const { data: profiles, error: profilesErr } = await admin
            .from('profiles')
            .select('id, name, email')
            .in('id', [match.user_a_id, match.user_b_id]);
        if (profilesErr || !profiles) {
            return NextResponse.json({ error: 'Profiles not found' }, { status: 500 });
        }
        const userA = profiles.find(p => p.id === match.user_a_id);
        const userB = profiles.find(p => p.id === match.user_b_id);

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const courseCode = postA?.course_code || postB?.course_code || '';
        const courseName = postA?.course_name || postB?.course_name || '';
        const mailer = getResend();
        if (!mailer) return NextResponse.json({ success: true, emailsSent: [], skipped: true });

        const emailsSent = [];
        const errors = [];

        if (userA?.email) {
            try {
                await mailer.emails.send({
                    from: 'CourseMate <noreply@course-mate.me>',
                    to: userA.email,
                    subject: `Match Found: ${courseCode}`,
                    html: emailHtml({
                        recipientName: userA?.name,
                        courseCode,
                        courseName,
                        theirSection: postA?.have_section,
                        otherUserName: userB?.name,
                        otherSection: postB?.have_section,
                        appUrl,
                    }),
                });
                emailsSent.push('A');
            } catch (err) {
                errors.push({ user: 'A', error: err.message });
            }
        }

        if (userB?.email) {
            try {
                await mailer.emails.send({
                    from: 'CourseMate <noreply@course-mate.me>',
                    to: userB.email,
                    subject: `Match Found: ${courseCode}`,
                    html: emailHtml({
                        recipientName: userB?.name,
                        courseCode,
                        courseName,
                        theirSection: postB?.have_section,
                        otherUserName: userA?.name,
                        otherSection: postA?.have_section,
                        appUrl,
                    }),
                });
                emailsSent.push('B');
            } catch (err) {
                errors.push({ user: 'B', error: err.message });
            }
        }

        return NextResponse.json({ success: true, emailsSent: emailsSent.length, errors });
    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
