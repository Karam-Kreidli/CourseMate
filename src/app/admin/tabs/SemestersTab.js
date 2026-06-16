'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import styles from '../admin.module.css';

const SEMESTER_NAMES = { '10': 'Fall', '20': 'Spring', '30': 'Summer' };

function deriveName(termCode) {
    const code = (termCode || '').trim();
    if (!/^\d{6}$/.test(code)) return '';
    const year = code.slice(0, 4);
    const sem = SEMESTER_NAMES[code.slice(4, 6)];
    if (!sem) return '';
    return `${sem} ${year}`;
}

const Ctx = createContext(null);

function SemestersProvider({ children }) {
    const [semesters, setSemesters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newTerm, setNewTerm] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/admin/semesters');
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setSemesters(data.semesters || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleToggle = async (term_code, is_active) => {
        const res = await fetch('/api/admin/semesters', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ term_code, is_active: !is_active }),
        });
        if (res.ok) setSemesters(prev => prev.map(s => s.term_code === term_code ? { ...s, is_active: !is_active } : s));
        else alert('Failed');
    };

    const handleAdd = async (e) => {
        e?.preventDefault();
        const code = newTerm.trim();
        const name = deriveName(code);
        if (!code || !name) return;
        const res = await fetch('/api/admin/semesters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ term_code: code, name, is_active: false }),
        });
        if (res.ok) {
            setNewTerm('');
            load();
        } else {
            const body = await res.json().catch(() => ({}));
            alert(body.error || 'Failed');
        }
    };

    const handleDelete = async (term_code) => {
        if (!confirm(`Delete semester ${term_code}? This won't delete sections/posts but they'll be orphaned.`)) return;
        const res = await fetch('/api/admin/semesters', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ term_code }),
        });
        if (res.ok) setSemesters(prev => prev.filter(s => s.term_code !== term_code));
        else alert('Failed');
    };

    return (
        <Ctx.Provider value={{
            semesters, loading, error, newTerm, setNewTerm,
            handleToggle, handleAdd, handleDelete,
        }}>
            {children}
        </Ctx.Provider>
    );
}

function SemestersSidebar() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { newTerm, setNewTerm, handleAdd } = ctx;
    const preview = deriveName(newTerm);
    const canAdd = newTerm.trim() && preview;

    return (
        <div className={styles.sidebarCard}>
            <p className={styles.sectionTitle}>Add semester</p>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Term code</label>
                    <input
                        className={styles.input}
                        placeholder="e.g. 202610"
                        value={newTerm}
                        onChange={(e) => setNewTerm(e.target.value)}
                    />
                </div>

                {newTerm.trim() ? (
                    preview ? (
                        <div className={styles.previewName}>{preview}</div>
                    ) : (
                        <div className={styles.previewMuted}>Invalid code</div>
                    )
                ) : (
                    <div className={styles.previewMuted}>10 = Fall · 20 = Spring · 30 = Summer</div>
                )}

                <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`} disabled={!canAdd}>
                    Add semester
                </button>
            </form>
        </div>
    );
}

function SemestersMain() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { semesters, loading, error, handleToggle, handleDelete } = ctx;

    return (
        <div className={styles.feedCard}>
            {error && <div className={styles.error}>{error}</div>}
            {loading ? (
                <div className={styles.loading}><div className={styles.spinner} />Loading semesters...</div>
            ) : semesters.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyTitle}>No semesters yet</div>
                    <span>Add a term code from the sidebar.</span>
                </div>
            ) : (
                <div className={styles.feedList}>
                    {semesters.map(s => (
                        <div key={s.term_code} className={styles.row}>
                            <div className={styles.rowMain}>
                                <div className={styles.rowTitle}>
                                    {s.name}
                                    <span className={styles.badge}>{s.term_code}</span>
                                    <span className={`${styles.badge} ${s.is_active ? styles.badgeActive : styles.badgeExpired}`}>
                                        {s.is_active ? 'active' : 'inactive'}
                                    </span>
                                </div>
                            </div>
                            <div className={styles.rowActions}>
                                <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => handleToggle(s.term_code, s.is_active)}>
                                    {s.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleDelete(s.term_code)}>Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const semestersTab = { Provider: SemestersProvider, Sidebar: SemestersSidebar, Main: SemestersMain };
export default semestersTab;
