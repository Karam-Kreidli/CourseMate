import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { sendPushToUsers } from '@/lib/push/server';

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

function emailHtml({ recipientName, declinerName, swapLabel, courseLine, appUrl }) {
    const safeName = escapeHtml(recipientName || 'Student');
    const safeDecliner = escapeHtml(declinerName || 'The other student');
    const safeCourseLine = escapeHtml(courseLine || '');
    const safeAppUrl = escapeHtml(appUrl);
    const safeSwapLabel = escapeHtml(swapLabel);

    return `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #ffffff; color: #333333;">
            <div style="background-color: #0a2540; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Swap Declined</h1>
            </div>
            <div style="padding: 32px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
                    Hello <strong>${safeName}</strong>,
                </p>
                <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
                    <strong>${safeDecliner}</strong> declined ${safeSwapLabel} for <strong>${safeCourseLine}</strong>. Your post is active again, and we'll keep looking for a new match.
                </p>
                <div style="text-align: center;">
                    <a href="${safeAppUrl}/matches"
                       style="background-color: #c9a227; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 16px; display: inline-block;">
                        View My Posts
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
            .select('id, size, status, declined_by')
            .eq('id', matchId)
            .single();
        if (matchErr || !match || match.status !== 'declined') {
            return NextResponse.json({ error: 'Declined match not found' }, { status: 404 });
        }

        // Load every participant + their post + their profile.
        const { data: participants, error: partErr } = await admin
            .from('match_participants')
            .select(`
                position, user_id,
                post:posts!match_participants_post_id_fkey(course_code, course_name),
                profile:profiles!match_participants_user_id_fkey(id, name, email, email_match_alerts)
            `)
            .eq('match_id', matchId)
            .order('position');
        if (partErr || !participants || participants.length === 0) {
            return NextResponse.json({ error: 'Participants not found' }, { status: 500 });
        }

        // Authorize: the caller must be one of the participants.
        if (!participants.some(p => p.user_id === user.id)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Only the other participants get told — the decliner already knows.
        const recipients = participants.filter(p => p.user_id !== match.declined_by);
        if (recipients.length === 0) {
            return NextResponse.json({ success: true, emailsSent: 0 });
        }

        const decliner = participants.find(p => p.user_id === match.declined_by);
        const declinerName = decliner?.profile?.name || 'The other student';
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const isCycle = (match.size || participants.length) > 2;
        const swapLabel = isCycle ? `your ${match.size || participants.length}-way swap` : 'your swap';

        // Web Push — one personalized push per recipient, to all their devices.
        await Promise.all(
            recipients
                .filter(p => p.profile?.email_match_alerts !== false)
                .map(p => {
                    const courseLine = p.post?.course_name ? `${p.post.course_name} (${p.post.course_code})` : p.post?.course_code;
                    return sendPushToUsers(admin, [p.user_id], {
                        title: 'Swap declined',
                        body: `${declinerName} declined ${swapLabel} for ${courseLine}.`,
                        url: '/matches',
                        tag: `match-declined-${matchId}`,
                    });
                })
        );

        const mailer = getResend();
        if (!mailer) return NextResponse.json({ success: true, emailsSent: 0, skipped: true });

        let emailsSent = 0;
        const errors = [];

        for (const p of recipients) {
            const profile = p.profile;
            if (!profile?.email || profile.email_match_alerts === false) continue;

            const courseLine = p.post?.course_name ? `${p.post.course_name} (${p.post.course_code})` : p.post?.course_code;

            try {
                await mailer.emails.send({
                    from: 'CourseMate <noreply@course-mate.me>',
                    to: profile.email,
                    subject: `Swap Declined: ${p.post?.course_code || ''}`,
                    html: emailHtml({
                        recipientName: profile.name,
                        declinerName,
                        swapLabel,
                        courseLine,
                        appUrl,
                    }),
                });
                emailsSent++;
            } catch (err) {
                errors.push({ user: p.user_id, error: err.message });
            }
        }

        return NextResponse.json({ success: true, emailsSent, errors });
    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
