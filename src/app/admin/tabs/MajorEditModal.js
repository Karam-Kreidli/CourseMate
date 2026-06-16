'use client';

import { useEffect, useState } from 'react';
import styles from '../admin.module.css';
import CoursePicker from './CoursePicker';

export default function MajorEditModal({ code, onClose, onSaved }) {
    const [major, setMajor] = useState(null);
    const [courses, setCourses] = useState([]); // currently attached
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const [deptCount, setDeptCount] = useState(0);
    const [supportCount, setSupportCount] = useState(0);
    const [name, setName] = useState('');
    const [toAttach, setToAttach] = useState([]); // [{course_id, course_name, credit_hours}]
    const [toDetach, setToDetach] = useState(new Set()); // course_ids
    const [newCourses, setNewCourses] = useState([]);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/admin/majors/${encodeURIComponent(code)}`);
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();
                setMajor(data.major);
                setCourses(data.courses || []);
                setName(data.major?.name || '');
                setDeptCount(data.major?.dept_electives_count || 0);
                setSupportCount(data.major?.support_electives_count || 0);
            } catch (e) {
                setErr(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, [code]);

    const toggleDetach = (id) => setToDetach(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });

    const addAttach = (c) => setToAttach(prev => [...prev, c]);
    const removeAttach = (id) => setToAttach(prev => prev.filter(c => c.course_id !== id));

    const addNewRow = () => setNewCourses(prev => [...prev, { course_id: '', course_name: '', credit_hours: '' }]);
    const updateNewRow = (i, field, value) => setNewCourses(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));
    const removeNewRow = (i) => setNewCourses(prev => prev.filter((_, idx) => idx !== i));

    const handleSave = async () => {
        setSaving(true);
        setErr('');
        try {
            const res = await fetch(`/api/admin/majors/${encodeURIComponent(code)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    dept_electives_count: deptCount,
                    support_electives_count: supportCount,
                    attach_course_ids: toAttach.map(c => c.course_id),
                    detach_course_ids: Array.from(toDetach),
                    new_courses: newCourses,
                }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Save failed');
            }
            onSaved?.();
            onClose();
        } catch (e) {
            setErr(e.message);
        } finally {
            setSaving(false);
        }
    };

    const excludeIds = [...courses.map(c => c.course_id), ...toAttach.map(c => c.course_id)];

    return (
        <div
            onClick={onClose}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
                display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
                paddingTop: 40, paddingBottom: 40, overflowY: 'auto', zIndex: 100,
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: '100%', maxWidth: 760,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 16, padding: 20,
                    boxShadow: 'var(--shadow-xl)',
                    margin: '0 16px',
                    color: 'var(--text-primary)',
                    display: 'flex', flexDirection: 'column', gap: 14,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>Edit major</div>
                        <div className={styles.rowMeta}>{code}</div>
                    </div>
                    <button className={styles.btn} onClick={onClose}>Close</button>
                </div>

                {loading && <div className={styles.loading}>Loading...</div>}
                {err && <div className={styles.error}>{err}</div>}

                {!loading && major && (
                    <>
                        <div className={styles.toolbar}>
                            <input className={styles.search} placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>

                        <div className={styles.formGrid}>
                            <div className={styles.numField}>
                                <span className={styles.numFieldLabel}>Dept electives</span>
                                <input className={styles.search} type="number" min="0" value={deptCount} onChange={(e) => setDeptCount(+e.target.value || 0)} />
                            </div>
                            <div className={styles.numField}>
                                <span className={styles.numFieldLabel}>Support electives</span>
                                <input className={styles.search} type="number" min="0" value={supportCount} onChange={(e) => setSupportCount(+e.target.value || 0)} />
                            </div>
                        </div>

                        <div>
                            <div className={styles.sectionLabel}>Currently attached ({courses.length})</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 240, overflowY: 'auto' }}>
                                {courses.length === 0 && <div className={styles.rowMeta}>No courses attached</div>}
                                {courses.map(c => {
                                    const marked = toDetach.has(c.course_id);
                                    return (
                                        <div key={c.course_id} className={styles.row} style={{ opacity: marked ? 0.5 : 1 }}>
                                            <div className={styles.rowMain}>
                                                <div className={styles.rowTitle}>{c.course_id}</div>
                                                <div className={styles.rowMeta}>{c.course_name}{c.credit_hours != null && ` · ${c.credit_hours} cr`}</div>
                                            </div>
                                            <div className={styles.rowActions}>
                                                <button className={`${styles.btn} ${marked ? '' : styles.btnDanger}`} onClick={() => toggleDetach(c.course_id)}>
                                                    {marked ? 'Undo' : 'Remove'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <div className={styles.sectionLabel}>Attach more existing courses</div>
                            <CoursePicker selected={toAttach} onAdd={addAttach} excludeIds={excludeIds} />
                            {toAttach.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                                    {toAttach.map(c => (
                                        <span key={c.course_id} className={`${styles.badge} ${styles.badgeAccent}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                            {c.course_id}
                                            <button type="button" onClick={() => removeAttach(c.course_id)} style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div>
                            <div className={styles.sectionLabel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Create + attach new courses</span>
                                <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={addNewRow}>+ Row</button>
                            </div>
                            {newCourses.map((c, i) => (
                                <div key={i} className={styles.toolbar} style={{ marginBottom: 6 }}>
                                    <input className={styles.search} style={{ maxWidth: 140 }} placeholder="Course ID" value={c.course_id} onChange={(e) => updateNewRow(i, 'course_id', e.target.value)} />
                                    <input className={styles.search} placeholder="Course name" value={c.course_name} onChange={(e) => updateNewRow(i, 'course_name', e.target.value)} />
                                    <input className={styles.search} style={{ maxWidth: 90 }} type="number" min="0" placeholder="Credits" value={c.credit_hours} onChange={(e) => updateNewRow(i, 'credit_hours', e.target.value)} />
                                    <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => removeNewRow(i)}>×</button>
                                </div>
                            ))}
                        </div>

                        <div className={styles.toolbar}>
                            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : 'Save changes'}
                            </button>
                            <button className={styles.btn} onClick={onClose}>Cancel</button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
