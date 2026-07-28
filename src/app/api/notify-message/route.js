'use server';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { dispatchMessageEmails } from '@/lib/messageEmails';

function authorized(request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return false;
    const header = request.headers.get('authorization') || '';
    return header === `Bearer ${secret}`;
}

/**
 * Chat email nudges.
 *
 * This is deliberately NOT registered in vercel.json: the Hobby plan allows
 * two cron entries and expire-matches/expire-posts already use both. The daily
 * expire-matches run calls dispatchMessageEmails() so this still happens out of
 * the box; point an external scheduler at this endpoint (with CRON_SECRET) if
 * you want it more often than once a day.
 */
export async function GET(request) {
    if (!authorized(request)) {
        return new NextResponse('Not found', { status: 404 });
    }

    try {
        const admin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );

        const result = await dispatchMessageEmails(admin);
        if (result.error) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ message: 'Chat emails processed', ...result });
    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
