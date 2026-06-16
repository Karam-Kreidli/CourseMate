'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import styles from '../admin.module.css';
import CoursePicker from './CoursePicker';
import MajorEditModal from './MajorEditModal';

const Ctx = createContext(null);

function MajorsProvider({ children }) {
    const [majors, setMajors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editingCode, setEditingCode] = useState(null);
    const [showCreate, setShowCreate] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/admin/majors');
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setMajors(data.majors || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async (code, name) => {
        if (!confirm(`Delete major "${name}" (${code})? Removes the major and its course links. Existing user profiles with this major will be orphaned.`)) return;
        const res = await fetch('/api/admin/majors', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
        });
        if (res.ok) setMajors(prev => prev.filter(m => m.code !== code));
        else {
            const body = await res.json().catch(() => ({}));
            alert(body.error || 'Failed');
        }
    };

    return (
        <Ctx.Provider value={{
            majors, loading, error, editingCode, setEditingCode,
            showCreate, setShowCreate, load, handleDelete,
        }}>
            {children}
        </Ctx.Provider>
    );
}

function MajorsSidebar() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { majors, showCreate, setShowCreate } = ctx;

    return (
        <div className={styles.sidebarCard}>
            <p className={styles.sectionTitle}>Actions</p>
            <button
                className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`}
                onClick={() => setShowCreate(v => !v)}
            >
                {showCreate ? 'Hide create form' : '+ New major'}
            </button>
            <div style={{ marginTop: 12, textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {majors.length} major{majors.length === 1 ? '' : 's'} configured
            </div>
        </div>
    );
}

function MajorsMain() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { majors, loading, error, editingCode, setEditingCode, showCreate, setShowCreate, load, handleDelete } = ctx;

    return (
        <>
            {showCreate && (
                <CreateMajorForm
                    onCancel={() => setShowCreate(false)}
                    onCreated={() => { setShowCreate(false); load(); }}
                />
            )}

            <div className={styles.feedCard}>
                {error && <div className={styles.error}>{error}</div>}
                {loading ? (
                    <div className={styles.loading}><div className={styles.spinner} />Loading majors...</div>
                ) : majors.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyTitle}>No majors yet</div>
                        <span>Use “+ New major” in the sidebar to add one.</span>
                    </div>
                ) : (
                    <div className={styles.feedList}>
                        {majors.map(m => (
                            <div key={m.code} className={styles.row}>
                                <div className={styles.rowMain}>
                                    <div className={styles.rowTitle}>
                                        {m.name}
                                        <span className={styles.badge}>{m.code}</span>
                                    </div>
                                    <div className={styles.rowMeta}>
                                        {m.dept_electives_count || 0} dept electives · {m.support_electives_count || 0} support electives
                                    </div>
                                </div>
                                <div className={styles.rowActions}>
                                    <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setEditingCode(m.code)}>Edit</button>
                                    <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleDelete(m.code, m.name)}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {editingCode && (
                <MajorEditModal code={editingCode} onClose={() => setEditingCode(null)} onSaved={() => { load(); }} />
            )}
        </>
    );
}

function CreateMajorForm({ onCancel, onCreated }) {
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [deptCount, setDeptCount] = useState(0);
    const [supportCount, setSupportCount] = useState(0);
    const [existing, setExisting] = useState([]);
    const [newCourses, setNewCourses] = useState([]);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const addExisting = (c) => setExisting(prev => [...prev, c]);
    const removeExisting = (id) => setExisting(prev => prev.filter(c => c.course_id !== id));
    const addNewRow = () => setNewCourses(prev => [...prev, { course_id: '', course_name: '', credit_hours: '' }]);
    const updateNewRow = (i, field, value) => setNewCourses(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
    const removeNewRow = (i) => setNewCourses(prev => prev.filter((_, idx) => idx !== i));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErr('');
        if (!code.trim() || !name.trim()) {
            setErr('Code and name are required');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/admin/majors', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code.trim(),
                    name: name.trim(),
                    dept_electives_count: deptCount,
                    support_electives_count: supportCount,
                    existing_course_ids: existing.map(c => c.course_id),
                    new_courses: newCourses,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Create failed');
            }
            onCreated();
        } catch (e) {
            setErr(e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className={styles.formCard}>
            <div className={styles.formRow}>
                <input className={styles.input} style={{ maxWidth: 180 }} placeholder="Code (e.g. CS)" value={code} onChange={(e) => setCode(e.target.value)} />
                <input className={styles.input} style={{ flex: 1, minWidth: 220 }} placeholder="Name (e.g. Computer Science)" value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className={styles.formGrid}>
                <div className={styles.numField}>
                    <span className={styles.numFieldLabel}>Dept electives</span>
                    <input className={styles.input} type="number" min="0" value={deptCount} onChange={(e) => setDeptCount(+e.target.value || 0)} />
                </div>
                <div className={styles.numField}>
                    <span className={styles.numFieldLabel}>Support electives</span>
                    <input className={styles.input} type="number" min="0" value={supportCount} onChange={(e) => setSupportCount(+e.target.value || 0)} />
                </div>
            </div>

            <div>
                <span className={styles.fieldLabel}>Attach existing courses</span>
                <CoursePicker selected={existing} onAdd={addExisting} />
                {existing.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                        {existing.map(c => (
                            <span key={c.course_id} className={`${styles.badge} ${styles.badgeAccent}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {c.course_id}
                                <button type="button" onClick={() => removeExisting(c.course_id)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <div className={styles.fieldLabel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>New courses to create</span>
                    <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={addNewRow}>+ Row</button>
                </div>
                {newCourses.map((c, i) => (
                    <div key={i} className={styles.formRow} style={{ marginBottom: 6 }}>
                        <input className={styles.input} style={{ maxWidth: 140 }} placeholder="Course ID" value={c.course_id} onChange={(e) => updateNewRow(i, 'course_id', e.target.value)} />
                        <input className={styles.input} style={{ flex: 1, minWidth: 180 }} placeholder="Course name" value={c.course_name} onChange={(e) => updateNewRow(i, 'course_name', e.target.value)} />
                        <input className={styles.input} style={{ maxWidth: 90 }} type="number" min="0" placeholder="Credits" value={c.credit_hours} onChange={(e) => updateNewRow(i, 'credit_hours', e.target.value)} />
                        <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => removeNewRow(i)}>×</button>
                    </div>
                ))}
            </div>

            {err && <div className={styles.error}>{err}</div>}

            <div className={styles.formRow}>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={saving}>
                    {saving ? 'Creating...' : 'Create major'}
                </button>
                <button type="button" className={styles.btn} onClick={onCancel}>Cancel</button>
            </div>
        </form>
    );
}

const majorsTab = { Provider: MajorsProvider, Sidebar: MajorsSidebar, Main: MajorsMain };
export default majorsTab;
