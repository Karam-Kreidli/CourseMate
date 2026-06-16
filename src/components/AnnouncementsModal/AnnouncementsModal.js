'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './AnnouncementsModal.module.css';

function relativeTime(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
}

export default function AnnouncementsModal({ ready }) {
    const [items, setItems] = useState(null);
    const [closing, setClosing] = useState(false);

    useEffect(() => {
        if (!ready) return;
        let cancelled = false;
        (async () => {
            const supabase = createClient();
            const { data, error } = await supabase.rpc('get_my_active_announcements');
            if (cancelled) return;
            if (error) {
                console.error('Announcements fetch error:', error);
                setItems([]);
                return;
            }
            setItems(data || []);
        })();
        return () => { cancelled = true; };
    }, [ready]);

    const dismissOne = async (id) => {
        setItems(prev => prev.filter(a => a.id !== id));
        try {
            await fetch('/api/announcements/dismiss', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ announcement_id: id }),
            });
        } catch (e) {
            console.error('Dismiss failed:', e);
        }
    };

    const dismissAll = async () => {
        setClosing(true);
        try {
            await fetch('/api/announcements/dismiss', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ all: true }),
            });
        } catch (e) {
            console.error('Dismiss all failed:', e);
        }
        setTimeout(() => setItems([]), 200);
    };

    if (!items || items.length === 0) return null;

    return (
        <div className={`${styles.backdrop} ${closing ? styles.closing : ''}`} role="dialog" aria-modal="true" aria-label="What's new">
            <div className={styles.modal}>
                <header className={styles.header}>
                    <div>
                        <p className={styles.eyebrow}>Updates</p>
                        <h2 className={styles.title}>What&rsquo;s new</h2>
                    </div>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        onClick={dismissAll}
                        aria-label="Close and dismiss all"
                        title="Close and dismiss all"
                    >×</button>
                </header>

                <div className={styles.list}>
                    {items.map((a) => (
                        <article key={a.id} className={styles.card}>
                            <div className={styles.cardHeader}>
                                <h3 className={styles.cardTitle}>{a.title}</h3>
                                <span className={styles.timeStamp}>{relativeTime(a.created_at)}</span>
                            </div>
                            {a.body_html && (
                                <div
                                    className={styles.body}
                                    dangerouslySetInnerHTML={{ __html: a.body_html }}
                                />
                            )}
                            <div className={styles.cardActions}>
                                <button
                                    type="button"
                                    className={styles.dismissBtn}
                                    onClick={() => dismissOne(a.id)}
                                >
                                    Got it
                                </button>
                            </div>
                        </article>
                    ))}
                </div>

                {items.length > 1 && (
                    <footer className={styles.footer}>
                        <button type="button" className={styles.dismissAllBtn} onClick={dismissAll}>
                            Dismiss all
                        </button>
                    </footer>
                )}
            </div>
        </div>
    );
}
