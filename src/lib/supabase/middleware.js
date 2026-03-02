import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';

export async function updateSession(request) {
    // Check if Supabase is configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // If Supabase is not configured, just pass through
    if (!supabaseUrl || !supabaseKey ||
        supabaseUrl.includes('your-project') ||
        supabaseKey.includes('your-')) {
        return NextResponse.next({ request });
    }

    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session if expired
    try {
        await supabase.auth.getUser();
    } catch (e) {
        // Ignore auth errors during middleware
    }

    // Handle auth callback code from any page (Supabase may redirect to root)
    const code = request.nextUrl.searchParams.get('code');
    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
            // Redirect to reset-password page after successful code exchange
            const url = request.nextUrl.clone();
            url.pathname = '/auth/reset-password';
            url.searchParams.delete('code');
            return NextResponse.redirect(url);
        }
    }

    return supabaseResponse;
}
