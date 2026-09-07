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
    const [savingWindow, setSavingWindow] = useState(null);
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

    // datetime-local gives "2026-09-01T00:00" in the admin's own timezone;
    // toISOString() converts to UTC, which is what the database stores.
    const toLocalInput = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const handleWindow = async (term_code, field, value) => {
        setSavingWindow(term_code);
        const body = { term_code, [field]: value ? new Date(value).toISOString() : null };
        const res = await fetch('/api/admin/semesters', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        setSavingWindow(null);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            alert(err.error || 'Could not save the registration window');
            return;
        }
        setSemesters(prev => prev.map(s => s.term_code === term_code ? { ...s, [field]: body[field] } : s));
    };

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
            handleWindow, savingWindow, toLocalInput,
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
    const { semesters, loading, error, handleToggle, handleDelete, handleWindow, savingWindow, toLocalInput } = ctx;

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
                                    {(() => {
                                        // Mirrors seat_refresh_term() in the database: the seat
                                        // refresh only polls while an active term is inside its window.
                                        if (!s.registration_starts_at || !s.registration_ends_at) {
                                            return <span className={styles.badge}>seats: off</span>;
                                        }
                                        const now = Date.now();
                                        const open = now >= new Date(s.registration_starts_at).getTime()
                                            && now < new Date(s.registration_ends_at).getTime();
                                        return (
                                            <span className={`${styles.badge} ${open && s.is_active ? styles.badgeActive : styles.badgeExpired}`}>
                                                {open && s.is_active ? 'seats: refreshing' : 'seats: outside window'}
                                            </span>
                                        );
                                    })()}
                                </div>
                                <div className={styles.windowRow}>
                                    <label className={styles.windowField}>
                                        <span className={styles.windowLabel}>Registration opens</span>
                                        <input
                                            type="datetime-local"
                                            className={styles.windowInput}
                                            value={toLocalInput(s.registration_starts_at)}
                                            max={toLocalInput(s.registration_ends_at) || undefined}
                                            disabled={savingWindow === s.term_code}
                                            onClick={e => e.currentTarget.showPicker?.()}
                                            onChange={e => handleWindow(s.term_code, 'registration_starts_at', e.target.value)}
                                        />
                                    </label>
                                    <span className={styles.windowArrow}>&rarr;</span>
                                    <label className={styles.windowField}>
                                        <span className={styles.windowLabel}>Registration closes</span>
                                        <input
                                            type="datetime-local"
                                            className={styles.windowInput}
                                            value={toLocalInput(s.registration_ends_at)}
                                            min={toLocalInput(s.registration_starts_at) || undefined}
                                            disabled={savingWindow === s.term_code}
                                            onClick={e => e.currentTarget.showPicker?.()}
                                            onChange={e => handleWindow(s.term_code, 'registration_ends_at', e.target.value)}
                                        />
                                    </label>
                                    {(s.registration_starts_at || s.registration_ends_at) && (
                                        <button
                                            type="button"
                                            className={styles.windowClear}
                                            disabled={savingWindow === s.term_code}
                                            title="Clear the window — stops the seat refresh for this semester"
                                            onClick={() => {
                                                handleWindow(s.term_code, 'registration_starts_at', '');
                                                handleWindow(s.term_code, 'registration_ends_at', '');
                                            }}
                                        >
                                            Clear
                                        </button>
                                    )}
                                    {savingWindow === s.term_code && <span className={styles.windowSaving}>Saving…</span>}
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
