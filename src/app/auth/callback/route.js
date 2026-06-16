import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Only accept same-origin absolute paths. Any value that isn't a string starting
// with exactly one "/" is rejected — prevents open redirects via ?next=https://evil.com
// (which new URL() would otherwise resolve to evil.com when used as base).
function safeNext(next) {
    if (typeof next !== 'string') return null;
    if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return null;
    return next;
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    const next = safeNext(searchParams.get('next'));

    const supabase = await createClient();

    // Handle PKCE flow (code-based)
    if (code) {
        // Do NOT exchange code on the server. The PKCE verifier cookie might be out of sync.
        // Instead, pass the code to the client-side reset-password page to exchange it there.
        const redirectPath = next || '/auth/reset-password';
        const redirectUrl = new URL(redirectPath, request.url);
        redirectUrl.searchParams.set('code', code);
        return NextResponse.redirect(redirectUrl);
    }

    // Handle magic link / recovery flow (token_hash-based)
    if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
            token_hash,
            type,
        });

        if (!error) {
            const redirectPath = type === 'recovery' ? '/auth/reset-password' : (next || '/');
            return NextResponse.redirect(new URL(redirectPath, request.url));
        } else if (type === 'recovery') {
            // Send failed recovery attempts to the reset page so they see the proper error message
            return NextResponse.redirect(new URL('/auth/reset-password', request.url));
        }
    }

    // If both methods fail, redirect to auth page
    return NextResponse.redirect(new URL('/auth', request.url));
}
