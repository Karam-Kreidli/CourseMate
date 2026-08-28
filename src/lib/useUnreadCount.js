'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Unread-notification count, live and shared.
 *
 * Two components need this at once — the bottom nav badge and the top-bar bell
 * — and they must never disagree. A module-level store keeps exactly ONE
 * Supabase realtime channel and ONE poll no matter how many components read it;
 * mounting the hook twice used to mean two channels with the same topic name.
 */

let count = 0;
const listeners = new Set();
let channel = null;
let interval = null;
let starting = false;

const emit = () => listeners.forEach(l => l());

function setCount(next) {
    if (next === count) return;
    count = next;
    emit();
}

async function fetchCount() {
    const supabase = createClient();
    const { count: n, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .is('read', false);
    if (!error) setCount(n || 0);
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

export default function useUnreadCount() {
    const pathname = usePathname();
    const unread = useSyncExternalStore(subscribe, () => count, () => 0);

    // Re-check on every route change — notably right after leaving
    // /notifications, once its "mark read" writes have landed.
    useEffect(() => { fetchCount(); }, [pathname]);

    return unread;
}
