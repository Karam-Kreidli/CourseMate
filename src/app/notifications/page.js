'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import BottomNav from '@/components/BottomNav';
import { BellIcon } from '@/components/Icons';
import styles from './notifications.module.css';

function timeAgo(dateString) {
    const seconds = Math.floor((Date.now() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

function linkFor(n) {
    if (!n?.type) return null;
    if (n.type.startsWith('match')) return '/matches';
    if (n.type === 'interest_received' || n.type === 'watch_alert' || n.type === 'giveaway_posted') return '/browse';
    return null;
}

export default function NotificationsPage() {
    const router = useRouter();
    const supabase = createClient();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    // Snapshot of which were unread at load, so styling persists after we mark them read.
    const [unreadSnapshot, setUnreadSnapshot] = useState(new Set());

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/auth'); return; }

            const { data } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            const list = data || [];
            setItems(list);
            setUnreadSnapshot(new Set(list.filter(n => !n.read).map(n => n.id)));
            setLoading(false);

            // Mark everything read so the badge clears, but keep the load-time styling.
            const unreadIds = list.filter(n => !n.read).map(n => n.id);
            if (unreadIds.length > 0) {
                await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openItem = (n) => {
        const href = linkFor(n);
        if (href) router.push(href);
    };

    const clearAll = async () => {
        if (items.length === 0) return;
        if (!confirm('Clear all notifications? This cannot be undone.')) return;
        const ids = items.map(n => n.id);
        await supabase.from('notifications').delete().in('id', ids);
        setItems([]);
    };

    return (
        <div className={styles.page}>
            <div className={styles.pageInner}>
                <header className={styles.header}>
                    <div className={styles.headerTitleContainer}>
                        <button type="button" onClick={() => router.back()} className={styles.backBtn} title="Back" aria-label="Back">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                        </button>
                        <h1>Notifications</h1>
                    </div>
                    {items.length > 0 && (
                        <button className={styles.clearBtn} onClick={clearAll}>Clear all</button>
                    )}
                </header>

                <main className={styles.main}>
                    <div className={styles.card}>
                        {loading ? (
                            <div className={styles.centered}><div className={styles.spinner} /></div>
                        ) : items.length === 0 ? (
                            <div className={styles.empty}>
                                <span className={styles.emptyIcon}><BellIcon width={28} height={28} /></span>
                                <h3>No notifications</h3>
                                <p>Matches, interest in your posts, and watched sections will show up here.</p>
                            </div>
                        ) : (
                            <div className={styles.list}>
                                {items.map(n => {
                                    const wasUnread = unreadSnapshot.has(n.id);
                                    const href = linkFor(n);
                                    return (
                                        <div
                                            key={n.id}
                                            className={`${styles.item} ${wasUnread ? styles.unread : ''} ${href ? styles.clickable : ''}`}
                                            onClick={() => openItem(n)}
                                            role={href ? 'button' : undefined}
                                        >
                                            {wasUnread && <span className={styles.dot} />}
                                            <div className={styles.itemMain}>
                                                <div className={styles.itemTitle}>{n.title}</div>
                                                {n.message && <div className={styles.itemMsg}>{n.message}</div>}
                                                <div className={styles.itemTime}>{timeAgo(n.created_at)}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </main>
            </div>
            <BottomNav />
        </div>
    );
}
