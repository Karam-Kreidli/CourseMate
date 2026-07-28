'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import BottomNav from '@/components/BottomNav';
import MessageTicks from '@/components/MessageTicks';
import TemplatePicker from '@/components/TemplatePicker';
import styles from './thread.module.css';

function clockTime(dateString) {
    return new Date(dateString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(dateString) {
    const d = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function ThreadPage() {
    const router = useRouter();
    const { id } = useParams();
    const [meta, setMeta] = useState(null);
    const [messages, setMessages] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const bottomRef = useRef(null);

    const supabaseRef = useRef(null);
    if (!supabaseRef.current) supabaseRef.current = createClient();
    const supabase = supabaseRef.current;

    // Pull the thread and, if the tab is actually being looked at, move the read
    // watermark — that is what turns the sender's ticks to "seen".
    const refresh = useCallback(async (markRead = true) => {
        const [{ data: rows }, { data: metaRows }] = await Promise.all([
            supabase.rpc('conversation_thread', { p_conversation_id: id }),
            supabase.rpc('my_conversations', { p_conversation_id: id }),
        ]);

        setMessages(rows || []);
        setMeta((metaRows || [])[0] || null);

        if (markRead && typeof document !== 'undefined' && document.visibilityState === 'visible') {
            await supabase.rpc('mark_conversation_read', { p_conversation_id: id });
        }
    }, [id, supabase]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/auth'); return; }

            const { data: metaRows } = await supabase.rpc('my_conversations', { p_conversation_id: id });
            if (cancelled) return;

            if (!metaRows || metaRows.length === 0) {
                setNotFound(true);
                setLoading(false);
                return;
            }

            const { data: tpl } = await supabase.rpc('conversation_templates', { p_conversation_id: id });
            if (cancelled) return;
            setTemplates(tpl || []);

            await refresh();
            if (!cancelled) setLoading(false);
        })();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Realtime keeps both sides in sync; the interval is the fallback for a
    // dropped socket, matching the polling used elsewhere in the app.
    useEffect(() => {
        if (notFound) return;

        const channel = supabase
            .channel(`conversation:${id}`)
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
                () => refresh())
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `conversation_id=eq.${id}` },
                () => refresh(false))
            .subscribe();

        const interval = setInterval(() => refresh(), 15000);
        const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
        document.addEventListener('visibilitychange', onVisible);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [id, notFound, refresh, supabase]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, [messages.length]);

    const handleSend = async (templateKey, values) => {
        const { error } = await supabase.rpc('send_message', {
            p_conversation_id: id,
            p_template_key: templateKey,
            p_params: values,
        });
        if (error) throw new Error(error.message);
        await refresh();
    };

    const others = (meta?.other_names || []).join(', ') || 'Student';

    let closedNote = null;
    if (meta?.closed) {
        closedNote = meta.match_status === 'completed'
            ? 'This swap is done — the conversation is closed.'
            : 'This match is no longer active, so the conversation is closed.';
    }

    return (
        <div className={styles.page}>
            <div className={styles.pageInner}>
                <header className={styles.header}>
                    <button type="button" onClick={() => router.push('/chat')} className={styles.backBtn} title="Back" aria-label="Back">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
                    </button>
                    <div className={styles.headerText}>
                        <h1>{loading ? 'Loading…' : others}</h1>
                        {meta && (
                            <p className={styles.headerMeta}>
                                {meta.course_code}
                                {meta.my_gives && meta.my_gets && ` · you give §${meta.my_gives}, you get §${meta.my_gets}`}
                            </p>
                        )}
                    </div>
                </header>

                <main className={styles.thread}>
                    {loading ? (
                        <div className={styles.centered}><div className={styles.spinner} /></div>
                    ) : notFound ? (
                        <div className={styles.empty}>
                            <h3>Conversation not available</h3>
                            <p>It may have been removed, or you&rsquo;re not part of it.</p>
                        </div>
                    ) : (
                        <>
                            {messages.map((m, i) => {
                                const prev = messages[i - 1];
                                const showDay = !prev || dayLabel(prev.created_at) !== dayLabel(m.created_at);

                                if (m.kind === 'system') {
                                    return (
                                        <div key={m.id}>
                                            {showDay && <div className={styles.dayDivider}>{dayLabel(m.created_at)}</div>}
                                            <div className={styles.systemMsg}>{m.body}</div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={m.id}>
                                        {showDay && <div className={styles.dayDivider}>{dayLabel(m.created_at)}</div>}
                                        <div className={`${styles.row} ${m.mine ? styles.rowMine : ''}`}>
                                            <div className={`${styles.bubble} ${m.mine ? styles.bubbleMine : styles.bubbleTheirs}`}>
                                                {!m.mine && (meta?.other_names || []).length > 1 && (
                                                    <span className={styles.senderName}>{m.sender_name || 'Student'}</span>
                                                )}
                                                <span className={styles.bubbleBody}>{m.body}</span>
                                                <span className={styles.bubbleFoot}>
                                                    <span className={styles.bubbleTime}>{clockTime(m.created_at)}</span>
                                                    {m.mine && <MessageTicks state={m.state} />}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                            <div ref={bottomRef} />
                        </>
                    )}
                </main>
            </div>

            {!loading && !notFound && (
                <div className={styles.composerDock}>
                    <div className={styles.composerInner}>
                        <TemplatePicker
                            templates={templates}
                            disabled={!!meta?.closed}
                            disabledNote={closedNote}
                            onSend={handleSend}
                        />
                    </div>
                </div>
            )}

            <BottomNav />
        </div>
    );
}
