import { Resend } from 'resend';

// Wait this long before emailing about an unread message. An active thread
// resolves in a couple of minutes, and nobody wants an email per tap.
export const QUIET_MINUTES = 10;

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

function emailHtml({ recipientName, senderName, courseCode, lastBody, unread, conversationId, appUrl }) {
    const safeName = escapeHtml(recipientName || 'Student');
    const safeSender = escapeHtml(senderName || 'A student');
    const safeCourse = escapeHtml(courseCode || 'your swap');
    const safeBody = escapeHtml(lastBody || '');
    const safeUrl = escapeHtml(appUrl);
    const safeId = escapeHtml(conversationId);
    const countLine = unread > 1
        ? `You have <strong>${unread}</strong> unread messages.`
        : 'You have an unread message.';

    return `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #ffffff; color: #333333;">
            <div style="background-color: #0a2540; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">You have a message</h1>
            </div>
            <div style="padding: 32px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
                    Hello <strong>${safeName}</strong>,
                </p>
                <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
                    <strong>${safeSender}</strong> messaged you about <strong>${safeCourse}</strong>. ${countLine}
                </p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 24px; border: 1px solid #eaeaea; font-style: italic; color: #444;">
                    &ldquo;${safeBody}&rdquo;
                </div>
                <div style="text-align: center;">
                    <a href="${safeUrl}/chat/${safeId}"
                       style="background-color: #c9a227; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 16px; display: inline-block;">
                        Open the chat
                    </a>
                </div>
                <p style="margin-top: 40px; font-size: 12px; color: #888888; text-align: center; border-top: 1px solid #eaeaea; padding-top: 20px;">
                    CourseMate - University Section Exchange Platform<br />
                    You can turn these off under Preferences in your profile.
                </p>
            </div>
        </div>
    `;
}

/**
 * Emails everyone sitting on a message that has been unread for the quiet
 * period, at most once per burst.
 *
 * Shared so it can run either from its own endpoint (for an external
 * scheduler) or off the back of an existing cron — Vercel's Hobby plan allows
 * only two cron entries, and both are already spoken for.
 */
export async function dispatchMessageEmails(admin) {
    const { data: pending, error } = await admin
        .rpc('pending_message_emails', { p_quiet_minutes: QUIET_MINUTES });

    if (error) return { error: error.message, sent: 0, candidates: 0 };
    if (!pending || pending.length === 0) return { sent: 0, candidates: 0 };

    const mailer = getResend();
    // Without a mailer there is nothing to send, and marking the watermark
    // would silently swallow these messages once Resend is configured.
    if (!mailer) return { sent: 0, candidates: pending.length, skipped: 'no mailer configured' };

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    let sent = 0;

    for (const row of pending) {
        if (!row.email) continue;

        try {
            await mailer.emails.send({
                from: 'CourseMate <noreply@course-mate.me>',
                to: row.email,
                subject: `${row.sender_name || 'A student'} messaged you about ${row.course_code || 'your swap'}`,
                html: emailHtml({
                    recipientName: row.name,
                    senderName: row.sender_name,
                    courseCode: row.course_code,
                    lastBody: row.last_body,
                    unread: row.unread,
                    conversationId: row.conversation_id,
                    appUrl,
                }),
            });
            sent += 1;
        } catch {
            // Best-effort: leave the watermark alone so the next run retries.
            continue;
        }

        await admin.rpc('mark_message_email_sent', {
            p_conversation_id: row.conversation_id,
            p_user_id: row.user_id,
        });
    }

    return { sent, candidates: pending.length };
}
