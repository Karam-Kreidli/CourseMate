'use client';

import { useMemo, useState } from 'react';
import styles from '../admin.module.css';

const CATEGORIES = ['Core', 'Major Elective', 'Support Elective'];
const BASKETS = ['Basket 1', 'Basket 2'];

export default function CourseEditModal({ course, majors, onClose, onSaved }) {
    const [name, setName] = useState(course.course_name || '');
    const [credits, setCredits] = useState(course.credit_hours ?? 0);
    const [basket, setBasket] = useState(course.university_elective_basket || '');
    const [restricted, setRestricted] = useState(course.restricted_majors || []);
    // memberships: [{ code, name, category }] — hand-edited categories only.
    // "University Elective" rows are derived from the basket flag, so they're managed
    // by the basket + restrict controls below, not listed here.
    const [memberships, setMemberships] = useState(
        (course.majors || [])
            .filter(m => m.category !== 'University Elective')
            .map(m => ({ code: m.code, name: m.name, category: m.category || 'Core' }))
    );
    const [addCode, setAddCode] = useState('');
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const usedCodes = useMemo(() => new Set(memberships.map(m => m.code)), [memberships]);
    const available = (majors || []).filter(m => !usedCodes.has(m.code));

    const addMajor = () => {
        if (!addCode) return;
        const m = (majors || []).find(x => x.code === addCode);
        if (!m) return;
        setMemberships(prev => [...prev, { code: m.code, name: m.name, category: 'Core' }]);
        setAddCode('');
    };

    const setCategory = (code, category) =>
        setMemberships(prev => prev.map(m => (m.code === code ? { ...m, category } : m)));

    const removeMajor = (code) =>
        setMemberships(prev => prev.filter(m => m.code !== code));

    const toggleRestricted = (code) =>
        setRestricted(prev => (prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]));

    const handleSave = async () => {
        if (!name.trim()) { setErr('Course name is required.'); return; }
        setSaving(true);
        setErr('');
        try {
            const res = await fetch(`/api/admin/courses/${encodeURIComponent(course.course_id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    course_name: name,
                    credit_hours: credits,
                    university_elective_basket: basket,
                    // Restriction only applies to basket courses; clear it otherwise.
                    restricted_majors: basket ? restricted : [],
                    majors: memberships.map(m => ({ major_code: m.code, category: m.category })),
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
                    width: '100%', maxWidth: 680,
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
                        <div style={{ fontSize: 18, fontWeight: 700 }}>Edit course</div>
                        <div className={styles.rowMeta}>{course.course_id}{course.college_name ? ` · ${course.college_name}` : ''}</div>
                    </div>
                    <button className={styles.btn} onClick={onClose}>Close</button>
                </div>

                {err && <div className={styles.error}>{err}</div>}

                {/* Course fields */}
                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Course name</label>
                    <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Course name" />
                </div>

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div className={styles.fieldGroup} style={{ flex: '0 0 120px' }}>
                        <label className={styles.fieldLabel}>Credit hours</label>
                        <input className={styles.input} type="number" min="0" value={credits} onChange={(e) => setCredits(+e.target.value || 0)} />
                    </div>
                    <div className={styles.fieldGroup} style={{ flex: '1 1 200px' }}>
                        <label className={styles.fieldLabel}>University elective basket</label>
                        <select className={styles.input} value={basket} onChange={(e) => setBasket(e.target.value)}>
                            <option value="">None</option>
                            {[...new Set([...BASKETS, ...(basket ? [basket] : [])])].map(b => (
                                <option key={b} value={b}>{b}</option>
                            ))}
                        </select>
                        <span className={styles.rowMeta} style={{ marginTop: 4 }}>
                            {basket ? 'Shared across all majors unless restricted below.' : 'Applies to all majors.'}
                        </span>
                    </div>
                </div>

                {basket && (
                    <div className={styles.fieldGroup}>
                        <label className={styles.fieldLabel}>
                            Restrict to majors {restricted.length === 0 ? '(none — shared with all majors)' : `(${restricted.length})`}
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {(majors || []).map(m => (
                                <button
                                    type="button"
                                    key={m.code}
                                    onClick={() => toggleRestricted(m.code)}
                                    className={`${styles.btn} ${restricted.includes(m.code) ? styles.btnPrimary : ''}`}
                                    title={m.name}
                                >
                                    {m.code}
                                </button>
                            ))}
                        </div>
                        <span className={styles.rowMeta} style={{ marginTop: 4 }}>
                            Leave empty to share with every major. Selecting majors limits this basket course to only those.
                        </span>
                    </div>
                )}

                {/* Major memberships */}
                <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Majors & elective type ({memberships.length})</label>
                    {basket && (
                        <span className={styles.rowMeta} style={{ marginBottom: 4 }}>
                            University-elective membership is managed by the basket setting above. Add majors here only for Core / Major / Support roles.
                        </span>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {memberships.length === 0 && <div className={styles.rowMeta}>Not attached to any major.</div>}
                        {memberships.map(m => (
                            <div key={m.code} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                                    <div className={styles.rowTitle} style={{ fontSize: '0.8125rem' }}>{m.name}</div>
                                    <div className={styles.rowMeta}>{m.code}</div>
                                </div>
                                <select
                                    className={styles.input}
                                    style={{ flex: '0 0 170px' }}
                                    value={m.category}
                                    onChange={(e) => setCategory(m.code, e.target.value)}
                                >
                                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                                <button type="button" className={`${styles.btn} ${styles.btnDanger}`} style={{ flexShrink: 0 }} onClick={() => removeMajor(m.code)}>Remove</button>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <select className={styles.input} style={{ flex: '1 1 auto' }} value={addCode} onChange={(e) => setAddCode(e.target.value)}>
                            <option value="">Add a major…</option>
                            {available.map(m => <option key={m.code} value={m.code}>{m.name} ({m.code})</option>)}
                        </select>
                        <button type="button" className={styles.btn} style={{ flexShrink: 0 }} onClick={addMajor} disabled={!addCode}>+ Add</button>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                    <button className={styles.btn} onClick={onClose} disabled={saving}>Cancel</button>
                    <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
