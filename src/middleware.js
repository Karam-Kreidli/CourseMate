import { NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// The Supabase seat and section jobs POST to /api/notify-seats and
// /api/notify-new-sections from a server, so they send no Origin at all. They
// prove themselves with CRON_SECRET instead, which a cross-site page cannot
// know, so letting them past the Origin check does not reopen CSRF.
function isCronCaller(request) {
    const secret = process.env.CRON_SECRET;
    return !!secret && request.headers.get('authorization') === `Bearer ${secret}`;
}

function isCsrfSafe(request) {
    if (!STATE_CHANGING.has(request.method)) return true;
    if (!request.nextUrl.pathname.startsWith('/api/')) return true;
    if (isCronCaller(request)) return true;

    const origin = request.headers.get('origin');
    if (!origin) return false;
    try {
        return new URL(origin).host === request.nextUrl.host;
    } catch {
        return false;
    }
}

export async function middleware(request) {
    if (!isCsrfSafe(request)) {
        return new NextResponse('Forbidden', { status: 403 });
    }
    return await updateSession(request);
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
