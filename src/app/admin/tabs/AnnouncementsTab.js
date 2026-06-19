'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import RichTextEditor from '@/components/RichTextEditor';
import styles from '../admin.module.css';

const Ctx = createContext(null);

const GENDERS = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
];

const EMPTY_FORM = {
    id: null,
    title: '',
    body_html: '',
    active: true,
    expires_at: '',
    target_majors: [],
    target_genders: [],
    target_user_ids: [],
};

function toDatetimeLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value) {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
}

function AnnouncementsProvider({ children }) {
    const [announcements, setAnnouncements] = useState([]);
    const [majors, setMajors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [pickedUsers, setPickedUsers] = useState([]);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [aRes, mRes] = await Promise.all([
                fetch('/api/admin/announcements'),
                fetch('/api/admin/majors'),
            ]);
            if (!aRes.ok) throw new Error(await aRes.text());
            const aData = await aRes.json();
            setAnnouncements(aData.announcements || []);
            if (mRes.ok) {
                const mData = await mRes.json();
                setMajors(mData.majors || []);
            }
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const startNew = () => { setForm(EMPTY_FORM); setPickedUsers([]); };

    const startEdit = async (a) => {
        const next = {
            id: a.id,
            title: a.title || '',
            body_html: a.body_html || '',
            active: !!a.active,
            expires_at: toDatetimeLocal(a.expires_at),
            target_majors: a.target_majors || [],
            target_genders: a.target_genders || [],
            target_user_ids: a.target_user_ids || [],
        };
        setForm(next);

        if (next.target_user_ids.length > 0) {
            try {
                const res = await fetch('/api/admin/users');
                if (res.ok) {
                    const { users } = await res.json();
                    setPickedUsers(users.filter(u => next.target_user_ids.includes(u.id)));
                }
            } catch { /* non-fatal */ }
        } else {
            setPickedUsers([]);
        }
    };

    const save = async () => {
        if (!form.title.trim()) { alert('Title is required'); return; }
        setSaving(true);
        try {
            const payload = {
                title: form.title,
                body_html: form.body_html,
                active: form.active,
                expires_at: fromDatetimeLocal(form.expires_at),
                target_majors: form.target_majors,
                target_genders: form.target_genders,
                target_user_ids: form.target_user_ids,
            };
            const method = form.id ? 'PATCH' : 'POST';
            const body = form.id ? { id: form.id, ...payload } : payload;
            const res = await fetch('/api/admin/announcements', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) throw new Error(await res.text());
            await load();
            startNew();
        } catch (e) {
            alert(`Save failed: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (a) => {
        const res = await fetch('/api/admin/announcements', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: a.id, active: !a.active }),
        });
        if (res.ok) {
            setAnnouncements(prev => prev.map(x => x.id === a.id ? { ...x, active: !x.active } : x));
        } else {
            alert('Failed');
        }
    };

    const remove = async (a) => {
        if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return;
        const res = await fetch('/api/admin/announcements', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: a.id }),
        });
        if (res.ok) {
            setAnnouncements(prev => prev.filter(x => x.id !== a.id));
            if (form.id === a.id) startNew();
        } else {
            alert('Failed');
        }
    };

    return (
        <Ctx.Provider value={{
            announcements, majors, loading, error,
            form, setForm, saving, save, startNew, startEdit,
            toggleActive, remove,
            pickedUsers, setPickedUsers,
        }}>
            {children}
        </Ctx.Provider>
    );
}

function DismissedList({ announcementId, count }) {
    const [open, setOpen] = useState(false);
    const [users, setUsers] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const toggle = async () => {
        const next = !open;
        setOpen(next);
        if (next && users === null && count > 0) {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`/api/admin/announcements/dismissals?id=${encodeURIComponent(announcementId)}`);
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();
                setUsers(data.users || []);
            } catch (e) {
                setError(e.message || 'Failed to load');
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div>
            <button
                type="button"
                className={styles.previewMuted}
                onClick={count > 0 ? toggle : undefined}
                style={{
                    textAlign: 'left', padding: 0, fontSize: '0.7rem',
                    background: 'none', border: 'none',
                    cursor: count > 0 ? 'pointer' : 'default',
                    textDecoration: count > 0 ? 'underline' : 'none',
                }}
            >
                {count} {count === 1 ? 'user' : 'users'} dismissed{count > 0 ? (open ? ' ▾' : ' ▸') : ''}
            </button>
            {open && (
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {loading && <div className={styles.previewMuted} style={{ padding: 0, fontSize: '0.7rem' }}>Loading…</div>}
                    {error && <div className={styles.error}>{error}</div>}
                    {users && users.map(u => (
                        <div key={u.id} style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.35 }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{u.name || '(no name)'}</span>
                            {' · '}{u.student_id || '—'}{' · '}{u.email || '—'}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function AnnouncementsSidebar() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { announcements, loading, form, startNew, startEdit, toggleActive, remove } = ctx;

    return (
        <>
            <div className={styles.sidebarCard}>
                <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`} onClick={startNew}>
                    + New announcement
                </button>
            </div>

            <div className={styles.sidebarCard}>
                <p className={styles.sectionTitle}>All announcements</p>
                {loading ? (
                    <div className={styles.loading}><div className={styles.spinner} /></div>
                ) : announcements.length === 0 ? (
                    <div className={styles.previewMuted}>No announcements yet.</div>
                ) : (
                    <div className={styles.navList}>
                        {announcements.map(a => {
                            const expired = a.expires_at && new Date(a.expires_at) < new Date();
                            const isSelected = form.id === a.id;
                            return (
                                <div key={a.id} className={styles.row} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                                        <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</span>
                                        <span className={`${styles.badge} ${a.active && !expired ? styles.badgeActive : styles.badgeExpired}`}>
                                            {expired ? 'expired' : a.active ? 'active' : 'hidden'}
                                        </span>
                                    </div>
                                    <DismissedList announcementId={a.id} count={a.dismissed_count ?? 0} />
                                    <div className={styles.rowActions} style={{ justifyContent: 'flex-end' }}>
                                        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => startEdit(a)}>
                                            {isSelected ? 'Editing' : 'Edit'}
                                        </button>
                                        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => toggleActive(a)}>
                                            {a.active ? 'Hide' : 'Show'}
                                        </button>
                                        <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => remove(a)}>Delete</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}

function MajorMultiSelect({ majors, value, onChange }) {
    const toggle = (code) => {
        if (value.includes(code)) onChange(value.filter(v => v !== code));
        else onChange([...value, code]);
    };
    return (
        <div className={styles.formGrid}>
            {majors.length === 0 && <div className={styles.previewMuted}>No majors loaded</div>}
            {majors.map(m => (
                <button
                    type="button"
                    key={m.code}
                    onClick={() => toggle(m.code)}
                    className={`${styles.btn} ${value.includes(m.code) ? styles.btnPrimary : ''}`}
                    title={m.name}
                >
                    {m.code}
                </button>
            ))}
        </div>
    );
}

function UserPicker({ value, onChange, picked, setPicked }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const tRef = useRef();

    useEffect(() => {
        clearTimeout(tRef.current);
        if (!query.trim()) { setResults([]); return; }
        tRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`/api/admin/users?q=${encodeURIComponent(query.trim())}`);
                if (res.ok) {
                    const { users } = await res.json();
                    setResults(users || []);
                }
            } finally {
                setSearching(false);
            }
        }, 250);
        return () => clearTimeout(tRef.current);
    }, [query]);

    const add = (u) => {
        if (value.includes(u.id)) return;
        onChange([...value, u.id]);
        setPicked([...picked.filter(p => p.id !== u.id), u]);
        setQuery('');
        setResults([]);
    };

    const removeId = (id) => {
        onChange(value.filter(v => v !== id));
        setPicked(picked.filter(p => p.id !== id));
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
                type="text"
                placeholder="Search users by name, email, student ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={styles.input}
            />
            {searching && <div className={styles.previewMuted}>Searching…</div>}
            {results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: 6 }}>
                    {results.map(u => (
                        <button
                            key={u.id}
                            type="button"
                            className={styles.btn}
                            onClick={() => add(u)}
                            disabled={value.includes(u.id)}
                            style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                        >
                            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                                <span style={{ fontWeight: 700 }}>{u.name || '(no name)'}</span>
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                    {u.student_id || '—'} · {u.email || '—'}
                                </span>
                            </span>
                        </button>
                    ))}
                </div>
            )}
            {picked.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {picked.map(u => (
                        <span
                            key={u.id}
                            className={styles.badge}
                            style={{ background: 'var(--color-accent-muted)', color: 'var(--color-accent)', borderColor: 'transparent', textTransform: 'none', display: 'inline-flex', gap: 6, alignItems: 'center' }}
                        >
                            {u.name || u.student_id || u.id.slice(0, 8)}
                            <button
                                type="button"
                                onClick={() => removeId(u.id)}
                                style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 700, padding: 0, lineHeight: 1 }}
                                title="Remove"
                            >×</button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

function AnnouncementsMain() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { error, majors, form, setForm, saving, save, startNew, pickedUsers, setPickedUsers } = ctx;

    const update = (patch) => setForm(prev => ({ ...prev, ...patch }));

    const targetingSummary = useMemo(() => {
        const parts = [];
        if (form.target_majors.length) parts.push(`${form.target_majors.length} major(s)`);
        if (form.target_genders.length) parts.push(`${form.target_genders.length} gender(s)`);
        if (form.target_user_ids.length) parts.push(`${form.target_user_ids.length} user(s)`);
        return parts.length ? parts.join(' AND ') : 'All users';
    }, [form]);

    return (
        <>
            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.formCard}>
                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Title</label>
                    <input
                        type="text"
                        className={styles.input}
                        value={form.title}
                        onChange={(e) => update({ title: e.target.value })}
                        placeholder="What's new?"
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Body</label>
                    <RichTextEditor
                        value={form.body_html}
                        onChange={(html) => update({ body_html: html })}
                        placeholder="Describe the update — paste images, add links, format lists…"
                    />
                </div>

                <div className={styles.formGrid}>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Auto-expire (optional)</label>
                        <input
                            type="datetime-local"
                            className={styles.input}
                            value={form.expires_at}
                            onChange={(e) => update({ expires_at: e.target.value })}
                        />
                    </div>
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>Visibility</label>
                        <button
                            type="button"
                            className={`${styles.btn} ${form.active ? styles.btnPrimary : ''}`}
                            onClick={() => update({ active: !form.active })}
                        >
                            {form.active ? 'Active (visible)' : 'Hidden'}
                        </button>
                    </div>
                </div>

                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Targeting — current: {targetingSummary}</label>
                    <p className={styles.previewMuted} style={{ textAlign: 'left', padding: 0 }}>
                        Leave a section empty to skip that filter. Filters within a section are OR; across sections, AND.
                    </p>
                </div>

                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Majors</label>
                    <MajorMultiSelect
                        majors={majors}
                        value={form.target_majors}
                        onChange={(v) => update({ target_majors: v })}
                    />
                </div>

                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Genders</label>
                    <div className={styles.formGrid}>
                        {GENDERS.map(g => (
                            <button
                                type="button"
                                key={g.value}
                                onClick={() => {
                                    const has = form.target_genders.includes(g.value);
                                    update({ target_genders: has ? form.target_genders.filter(x => x !== g.value) : [...form.target_genders, g.value] });
                                }}
                                className={`${styles.btn} ${form.target_genders.includes(g.value) ? styles.btnPrimary : ''}`}
                            >
                                {g.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Specific users</label>
                    <UserPicker
                        value={form.target_user_ids}
                        onChange={(v) => update({ target_user_ids: v })}
                        picked={pickedUsers}
                        setPicked={setPickedUsers}
                    />
                </div>

                <div className={styles.formRow} style={{ justifyContent: 'flex-end' }}>
                    {form.id && (
                        <button type="button" className={styles.btn} onClick={startNew} disabled={saving}>
                            Cancel
                        </button>
                    )}
                    <button
                        type="button"
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={save}
                        disabled={saving}
                    >
                        {saving ? 'Saving…' : form.id ? 'Save changes' : 'Publish announcement'}
                    </button>
                </div>
            </div>
        </>
    );
}

const announcementsTab = {
    Provider: AnnouncementsProvider,
    Sidebar: AnnouncementsSidebar,
    Main: AnnouncementsMain,
};
export default announcementsTab;
