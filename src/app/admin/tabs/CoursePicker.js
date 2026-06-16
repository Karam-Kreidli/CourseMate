'use client';

import { useEffect, useState } from 'react';
import styles from '../admin.module.css';

export default function CoursePicker({ selected, onAdd, excludeIds = [] }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const handle = setTimeout(async () => {
            if (query.trim().length < 2) {
                setResults([]);
                return;
            }
            setLoading(true);
            try {
                const res = await fetch(`/api/admin/courses?q=${encodeURIComponent(query.trim())}`);
                const data = await res.json();
                setResults(data.courses || []);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 200);
        return () => clearTimeout(handle);
    }, [query]);

    const exclude = new Set([...excludeIds, ...selected.map(c => c.course_id)]);
    const visible = results.filter(c => !exclude.has(c.course_id));

    return (
        <div>
            <input
                className={styles.search}
                placeholder="Search courses by code or name..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />
            {query.trim().length >= 2 && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                    {loading && <div className={styles.rowMeta}>Searching...</div>}
                    {!loading && visible.length === 0 && <div className={styles.rowMeta}>No matches</div>}
                    {visible.map(c => (
                        <button
                            type="button"
                            key={c.course_id}
                            className={styles.btn}
                            style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                            onClick={() => { onAdd(c); setQuery(''); setResults([]); }}
                        >
                            <strong>{c.course_id}</strong> · {c.course_name}
                            {c.credit_hours != null && <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>· {c.credit_hours} cr</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
