import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/admin';

// Password reset emails, sent by us rather than by Supabase.
//
// Supabase's own reset email came from its shared test sender (rate-limited,
// often junked by university Outlook) and carried a one-time link that broke
// two ways: Outlook's link scanner opened it before the student did, and the
// reset only finished in the browser that asked for it. This email carries a
// code to type into the reset page, plus a link to that page which spends
// nothing until the student submits a new password. Either works on any device.

const RESEND_AFTER_MS = 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function emailHtml({ code, link }) {
    const safeCode = escapeHtml(code);
    const safeLink = escapeHtml(link);
    return `
        <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #ffffff; color: #333333;">
            <div style="background-color: #0a2540; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">Reset your password</h1>
            </div>
            <div style="padding: 32px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
                    Enter this code on the CourseMate reset page:
                </p>
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 24px; border: 1px solid #eaeaea; text-align: center;">
                    <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0a2540;">${safeCode}</span>
                </div>
                <p style="font-size: 16px; line-height: 1.5; margin: 0 0 32px 0;">
                    Or open the reset page from here and choose a new password:
                </p>
                <div style="text-align: center;">
                    <a href="${safeLink}"
                       style="background-color: #c9a227; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 4px; font-weight: 600; font-size: 16px; display: inline-block;">
                        Choose a new password
                    </a>
                </div>
                <p style="font-size: 14px; line-height: 1.5; color: #666666; margin: 32px 0 0 0;">
                    The code and the button work once, and only for your latest request. If you didn't ask to reset your password, you can ignore this email.
                </p>
                <p style="margin-top: 40px; font-size: 12px; color: #888888; text-align: center; border-top: 1px solid #eaeaea; padding-top: 20px;">
                    CourseMate - University Section Exchange Platform
                </p>
            </div>
        </div>
    `;
}

export async function POST(request) {
    let email;
    try {
        email = String((await request.json())?.email || '').trim().toLowerCase();
    } catch {
        email = '';
    }
    if (!EMAIL_RE.test(email)) {
        return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }
    if (!process.env.RESEND_API_KEY) {
        return NextResponse.json({ error: 'Email is not set up on this server' }, { status: 500 });
    }

    // The same answer whether or not the account exists, so this can't be
    // used to find out who has one.
    const sent = NextResponse.json({ ok: true });
    const admin = createAdminClient();

    // ponytail: scans every account per request; fine at a few hundred users,
    // swap for an indexed lookup past a few thousand. profiles.email can't be
    // used: it keeps the address as typed at sign-up, and three accounts' differ.
    const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (listError) return NextResponse.json({ error: 'Could not send the email. Try again.' }, { status: 500 });
    const user = list.users.find(u => u.email?.toLowerCase() === email);
    if (!user) return sent;

    // A second request within a minute sends nothing: a new code would quietly
    // cancel the one already on its way.
    const lastSent = Date.parse(user.app_metadata?.reset_sent_at || '') || 0;
    if (Date.now() - lastSent < RESEND_AFTER_MS) return sent;

    const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'recovery', email: user.email });
    if (linkError) return NextResponse.json({ error: 'Could not send the email. Try again.' }, { status: 500 });
    const { email_otp: code, hashed_token: tokenHash } = link.properties;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const resetLink = `${appUrl}/auth/reset-password?token_hash=${encodeURIComponent(tokenHash)}&email=${encodeURIComponent(user.email)}`;

    try {
        const { error: sendError } = await new Resend(process.env.RESEND_API_KEY).emails.send({
            from: 'CourseMate <noreply@course-mate.me>',
            to: user.email,
            subject: `Your CourseMate reset code: ${code}`,
            html: emailHtml({ code, link: resetLink }),
        });
        if (sendError) throw new Error(sendError.message);
    } catch {
        return NextResponse.json({ error: 'Could not send the email. Try again.' }, { status: 502 });
    }

    await admin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...user.app_metadata, reset_sent_at: new Date().toISOString() },
    });
    return sent;
}
