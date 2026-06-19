'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SearchIcon } from '@/components/Icons';
import styles from '../admin.module.css';
import CourseEditModal from './CourseEditModal';

const Ctx = createContext(null);

function CoursesProvider({ children }) {
    const [courses, setCourses] = useState([]);
    const [search, setSearch] = useState('');
    const [major, setMajor] = useState('');
    const [category, setCategory] = useState('');
    const [majors, setMajors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [editingCourse, setEditingCourse] = useState(null);
    const supabase = createClient();

    const load = useCallback(async (overrides = {}) => {
        const q = overrides.search !== undefined ? overrides.search : search;
        const m = overrides.major !== undefined ? overrides.major : major;
        const cat = overrides.category !== undefined ? overrides.category : category;
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ detail: '1' });
            if (q) params.set('q', q);
            if (m) params.set('major', m);
            if (cat) params.set('category', cat);
            const res = await fetch(`/api/admin/courses?${params}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setCourses(data.courses || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [search, major, category]);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.from('majors').select('code, name').order('name');
            setMajors(data || []);
        })();
        load({ search: '', major: '', category: '' });
        // eslint-disable-next-line
    }, []);

    const setMajorAndLoad = (v) => { setMajor(v); setExpandedId(null); load({ major: v }); };
    const setCategoryAndLoad = (v) => { setCategory(v); setExpandedId(null); load({ category: v }); };
    const submitSearch = (e) => { e?.preventDefault(); setExpandedId(null); load({ search }); };
    const reset = () => { setSearch(''); setMajor(''); setCategory(''); setExpandedId(null); load({ search: '', major: '', category: '' }); };
    const toggleExpand = (id) => setExpandedId(prev => (prev === id ? null : id));
    const reload = () => load({});

    return (
        <Ctx.Provider value={{
            courses, search, setSearch, major, category, majors, loading, error,
            expandedId, toggleExpand, setMajorAndLoad, setCategoryAndLoad, submitSearch, reset,
            editingCourse, setEditingCourse, reload,
        }}>
            {children}
        </Ctx.Provider>
    );
}

const CATEGORY_FILTERS = [
    { value: '', label: 'All types' },
    { value: 'Core', label: 'Core' },
    { value: 'Major Elective', label: 'Major Elective' },
    { value: 'Support Elective', label: 'Support Elective' },
    { value: 'University Elective', label: 'University Elective' },
];

function CoursesSidebar() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { major, category, majors, courses, setMajorAndLoad, setCategoryAndLoad, reset } = ctx;

    return (
        <>
        <div className={styles.sidebarCard}>
            <p className={styles.sectionTitle}>Filter by type</p>
            <div className={styles.navList}>
                {CATEGORY_FILTERS.map(c => (
                    <button
                        key={c.value || 'all'}
                        className={`${styles.navBtn} ${category === c.value ? styles.navBtnActive : ''}`}
                        onClick={() => setCategoryAndLoad(c.value)}
                    >
                        <span>{c.label}</span>
                    </button>
                ))}
            </div>
        </div>

        <div className={styles.sidebarCard}>
            <p className={styles.sectionTitle}>Filter by major</p>
            <div className={`${styles.navList} ${styles.scrollList}`}>
                <button
                    className={`${styles.navBtn} ${major === '' ? styles.navBtnActive : ''}`}
                    onClick={() => setMajorAndLoad('')}
                >
                    <span>All majors</span>
                </button>
                {majors.map(m => (
                    <button
                        key={m.code}
                        className={`${styles.navBtn} ${major === m.code ? styles.navBtnActive : ''}`}
                        onClick={() => setMajorAndLoad(m.code)}
                        title={m.name}
                    >
                        <span>{m.name}</span>
                        <span className={styles.navCount}>{m.code}</span>
                    </button>
                ))}
            </div>
            <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnFull}`} style={{ marginTop: 8 }} onClick={reset}>
                Reset filters
            </button>
            <div style={{ marginTop: 8, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                {courses.length} result{courses.length === 1 ? '' : 's'}
            </div>
        </div>
        </>
    );
}

function chip(text, key) {
    return <span key={key} className={styles.badge} style={{ textTransform: 'none' }}>{text}</span>;
}

function CourseDetail({ course }) {
    return (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                <span><strong style={{ color: 'var(--text-primary)' }}>College:</strong> {course.college_name || '—'}</span>
                <span><strong style={{ color: 'var(--text-primary)' }}>Credits:</strong> {course.credit_hours ?? '—'}</span>
                {course.university_elective_basket && (
                    <span><strong style={{ color: 'var(--text-primary)' }}>Elective basket:</strong> {course.university_elective_basket}</span>
                )}
            </div>

            <div>
                <div className={styles.sectionLabel}>Majors ({course.majors.length})</div>
                {course.majors.length === 0 ? (
                    <div className={styles.rowMeta}>Not attached to any major</div>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {course.majors.map(m => (
                            <span key={m.code} className={`${styles.badge} ${styles.badgeAccent}`} style={{ textTransform: 'none' }} title={m.category || ''}>
                                {m.name}{m.category ? ` · ${m.category}` : ''}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <div className={styles.sectionLabel}>Instructors ({course.instructors.length})</div>
                {course.instructors.length === 0 ? (
                    <div className={styles.rowMeta}>No instructors</div>
                ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {course.instructors.map((ins, i) => chip(ins, i))}
                    </div>
                )}
            </div>

            <div>
                <div className={styles.sectionLabel}>Sections ({course.section_count})</div>
                {course.section_count === 0 ? (
                    <div className={styles.rowMeta}>No sections offered</div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {course.sections.map((s, i) => (
                            <div key={i} className={styles.row} style={{ padding: '8px 10px' }}>
                                <div className={styles.rowMain}>
                                    <div className={styles.rowTitle}>
                                        Section {s.section_num}
                                        {s.crn && <span className={styles.badge}>CRN {s.crn}</span>}
                                        {s.term_code && <span className={styles.badge}>{s.term_code}</span>}
                                        {s.campus && <span className={styles.badge} style={{ textTransform: 'none' }}>{s.campus}</span>}
                                    </div>
                                    <div className={styles.rowMeta}>
                                        {s.instructor || 'No instructor'}{s.class_time ? ` · ${s.class_time}` : ''}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

function CoursesMain() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { courses, search, setSearch, loading, error, expandedId, toggleExpand, submitSearch, majors, editingCourse, setEditingCourse, reload } = ctx;

    return (
        <>
            <form onSubmit={submitSearch} className={styles.card}>
                <div className={styles.searchWrapper}>
                    <span className={styles.searchIcon}><SearchIcon width={18} height={18} /></span>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search courses by ID or name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </form>

            <div className={styles.feedCard}>
                {error && <div className={styles.error}>{error}</div>}
                {loading ? (
                    <div className={styles.loading}><div className={styles.spinner} />Loading courses...</div>
                ) : courses.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyTitle}>No courses found</div>
                        <span>Try a different search or major filter.</span>
                    </div>
                ) : (
                    <div className={styles.feedList}>
                        {courses.map(c => {
                            const expanded = expandedId === c.course_id;
                            return (
                                <div key={c.course_id} className={styles.row} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 0, padding: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
                                        <button
                                            type="button"
                                            onClick={() => toggleExpand(c.course_id)}
                                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, color: 'inherit', flex: '1 1 auto', minWidth: 0 }}
                                        >
                                            <div className={styles.rowMain}>
                                                <div className={styles.rowTitle}>
                                                    {c.course_id} · {c.course_name}
                                                </div>
                                                <div className={styles.rowMeta}>
                                                    {c.majors.length} major{c.majors.length === 1 ? '' : 's'} · {c.section_count} section{c.section_count === 1 ? '' : 's'} · {c.instructors.length} instructor{c.instructors.length === 1 ? '' : 's'}
                                                    {c.section_count === 0 && ' · no sections'}
                                                </div>
                                            </div>
                                            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{expanded ? '▾' : '▸'}</span>
                                        </button>
                                        <button
                                            type="button"
                                            className={`${styles.btn} ${styles.btnGhost}`}
                                            style={{ flexShrink: 0 }}
                                            onClick={() => setEditingCourse(c)}
                                        >
                                            Edit
                                        </button>
                                    </div>
                                    {expanded && <CourseDetail course={c} />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {editingCourse && (
                <CourseEditModal
                    course={editingCourse}
                    majors={majors}
                    onClose={() => setEditingCourse(null)}
                    onSaved={reload}
                />
            )}
        </>
    );
}

const coursesTab = { Provider: CoursesProvider, Sidebar: CoursesSidebar, Main: CoursesMain };
export default coursesTab;
