'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import styles from './SectionAlerts.module.css';

export default function SectionAlerts({ term, courses }) {
    const supabase = createClient();
    const [watches, setWatches] = useState([]);
    const [userId, setUserId] = useState(null);
    const [course, setCourse] = useState('');
    const [section, setSection] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUserId(user?.id || null);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!userId || !term) return;
        (async () => {
            setLoading(true);
            const { data } = await supabase
                .from('section_watches')
                .select('*')
                .eq('term_code', term)
                .order('created_at', { ascending: false });
            setWatches(data || []);
            setLoading(false);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId, term]);

    const add = async (e) => {
        e?.preventDefault();
        setError('');
        const code = course.trim();
        if (!code) { setError('Enter a course ID.'); return; }
        if (courses && Object.keys(courses).length > 0 && !courses[code]) {
            setError('Unknown course ID.');
            return;
        }
        const payload = { user_id: userId, term_code: term, course_code: code, want_section: section.trim() || null };
        const { data, error: insErr } = await supabase.from('section_watches').insert(payload).select().single();
        if (insErr) {
            setError(insErr.code === '23505' ? 'You already have that alert.' : 'Could not add alert.');
            return;
        }
        setWatches(prev => [data, ...prev]);
        setCourse('');
        setSection('');
    };

    const remove = async (id) => {
        await supabase.from('section_watches').delete().eq('id', id);
        setWatches(prev => prev.filter(w => w.id !== id));
    };

    if (!term) return null;

    return (
        <div className={styles.card}>
            <p className={styles.title}>Section alerts</p>
            <p className={styles.hint}>Get notified when a swap or giveaway opens up for a section you want.</p>

            <form onSubmit={add} className={styles.form}>
                <input
                    list="watch-course-list"
                    className={styles.input}
                    placeholder="Course ID"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                />
                <datalist id="watch-course-list">
                    {Object.keys(courses || {}).map(c => <option key={c} value={c}>{courses[c]}</option>)}
                </datalist>
                <input
                    className={styles.input}
                    placeholder="Section (optional)"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                />
                <button type="submit" className={styles.addBtn}>Add alert</button>
            </form>
            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.list}>
                {loading ? (
                    <div className={styles.muted}>Loading…</div>
                ) : watches.length === 0 ? (
                    <div className={styles.muted}>No alerts yet.</div>
                ) : (
                    watches.map(w => (
                        <div key={w.id} className={styles.watch}>
                            <span className={styles.watchText}>
                                {w.course_code}{w.want_section ? ` · §${w.want_section}` : ' · any section'}
                            </span>
                            <button className={styles.removeBtn} onClick={() => remove(w.id)} title="Remove alert">×</button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
