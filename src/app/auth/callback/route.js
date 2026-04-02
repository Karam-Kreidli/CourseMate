import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const token_hash = searchParams.get('token_hash');
    const type = searchParams.get('type');
    const next = searchParams.get('next');

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
        }
    }

    // If both methods fail, redirect to auth page
    return NextResponse.redirect(new URL('/auth', request.url));
}
