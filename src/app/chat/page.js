'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import BottomNav from '@/components/BottomNav';
import { ChatIcon } from '@/components/Icons';
import styles from './chat.module.css';

function timeAgo(dateString) {
    const seconds = Math.floor((Date.now() - new Date(dateString)) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

export default function ChatListPage() {
    const router = useRouter();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const supabase = createClient();
        let cancelled = false;

        const load = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/auth'); return; }

            const { data } = await supabase.rpc('my_conversations');
            if (cancelled) return;
            setItems(data || []);
            setLoading(false);

            // Being on this screen means the messages reached this device.
            await supabase.rpc('mark_all_delivered');
        };

        load();
        const interval = setInterval(load, 30000);
        return () => { cancelled = true; clearInterval(interval); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className={styles.page}>
            <div className={styles.pageInner}>
                <header className={styles.header}>
                    <div className={styles.headerTitleContainer}>
                        <button type="button" onClick={() => router.back()} className={styles.backBtn} title="Back" aria-label="Back">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                        </button>
                        <h1>Chat</h1>
                    </div>
                </header>

                <main className={styles.main}>
                    <div className={styles.card}>
                        {loading ? (
                            <div className={styles.centered}><div className={styles.spinner} /></div>
                        ) : items.length === 0 ? (
                            <div className={styles.empty}>
                                <span className={styles.emptyIcon}><ChatIcon width={28} height={28} /></span>
                                <h3>No conversations yet</h3>
                                <p>When you get a swap match, or tap &ldquo;I&rsquo;m interested&rdquo; on a post, a thread opens here so you can sort out the swap without sharing your number.</p>
                            </div>
                        ) : (
                            <div className={styles.list}>
                                {items.map((c) => (
                                    <div
                                        key={c.id}
                                        className={`${styles.item} ${c.unread > 0 ? styles.unread : ''}`}
                                        onClick={() => router.push(`/chat/${c.id}`)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/chat/${c.id}`); }}
                                    >
                                        <div className={styles.itemMain}>
                                            <div className={styles.itemTop}>
                                                <span className={styles.itemTitle}>
                                                    {(c.other_names || []).join(', ') || 'Student'}
                                                </span>
                                                <span className={styles.itemTime}>{timeAgo(c.last_at)}</span>
                                            </div>

                                            <div className={styles.itemMeta}>
                                                <span className={styles.courseTag}>{c.course_code}</span>
                                                {c.my_gives && c.my_gets && (
                                                    <span className={styles.swapTag}>
                                                        §{c.my_gives} → §{c.my_gets}
                                                    </span>
                                                )}
                                                {c.closed && <span className={styles.closedTag}>Closed</span>}
                                            </div>

                                            {c.last_body && (
                                                <div className={styles.itemMsg}>{c.last_body}</div>
                                            )}
                                        </div>

                                        {c.unread > 0 && <span className={styles.badge}>{c.unread > 9 ? '9+' : c.unread}</span>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </main>
            </div>
            <BottomNav />
        </div>
    );
}
