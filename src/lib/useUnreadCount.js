'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Unread-notification counts, live and shared.
 *
 * Three components need this at once — the bottom nav badge, the top-bar nav
 * badge and the bell — and they must never disagree. A module-level store keeps
 * exactly ONE Supabase realtime channel and ONE poll no matter how many
 * components read it; mounting the hook twice used to mean two channels with the
 * same topic name.
 *
 * Two scopes, because the badges point at different pages:
 *   'all'      → the bell, which opens /notifications and shows everything
 *   'activity' → the Activity tab, which only ever shows swaps and matches
 * A section or new-section alert counted on the Activity tab sent students to a
 * page with nothing on it to read or clear.
 */

// The swap lifecycle — the only notifications the Activity page has anything
// to show for. Opening Activity marks these read (see matches/page.js).
export const ACTIVITY_TYPES = ['match_found', 'match_accepted', 'match_declined', 'match_expired', 'reminder'];

let counts = { all: 0, activity: 0 };
const listeners = new Set();
let channel = null;
let interval = null;
let starting = false;

const emit = () => listeners.forEach(l => l());

function setCounts(next) {
    if (next.all === counts.all && next.activity === counts.activity) return;
    counts = next;
    emit();
}

async function fetchCount() {
    const supabase = createClient();
    const unread = () => supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read', false);
    const [all, activity] = await Promise.all([unread(), unread().in('type', ACTIVITY_TYPES)]);
    if (all.error || activity.error) return;
    setCounts({ all: all.count || 0, activity: activity.count || 0 });
}

async function start() {
    if (starting || channel || interval) return;
    starting = true;
    try {
        await fetchCount();

        // Fallback poll, in case realtime drops.
        interval = setInterval(fetchCount, 60000);

        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || typeof supabase.channel !== 'function') return;

        // Nobody may have unsubscribed while we awaited, but if they did, don't
        // open a channel that no one will close.
        if (listeners.size === 0) return;

        channel = supabase
            .channel(`notifications-badge-${user.id}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
                fetchCount
            )
            .subscribe();
    } finally {
        starting = false;
    }
}

function stop() {
    if (interval) { clearInterval(interval); interval = null; }
    if (channel) {
        createClient().removeChannel(channel);
        channel = null;
    }
}

function subscribe(listener) {
    listeners.add(listener);
    start();
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
    };
}

export default function useUnreadCount(scope = 'all') {
    const pathname = usePathname();
    const unread = useSyncExternalStore(subscribe, () => counts[scope], () => 0);

    // Re-check on every route change — notably right after leaving
    // /notifications or /matches, once their "mark read" writes have landed.
    useEffect(() => { fetchCount(); }, [pathname]);

    return unread;
}
