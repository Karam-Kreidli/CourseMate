'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SearchIcon } from '@/components/Icons';
import styles from '../admin.module.css';

const Ctx = createContext(null);

const STATUSES = [
    { value: 'active', label: 'Active' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'expired', label: 'Expired' },
    { value: 'all', label: 'All' },
];

function PostsProvider({ children }) {
    const [posts, setPosts] = useState([]);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('active');
    const [term, setTerm] = useState('');
    const [semesters, setSemesters] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const supabase = createClient();

    const load = useCallback(async (overrides = {}) => {
        const q = overrides.search !== undefined ? overrides.search : search;
        const s = overrides.status !== undefined ? overrides.status : status;
        const t = overrides.term !== undefined ? overrides.term : term;
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (q) params.set('q', q);
            if (s) params.set('status', s);
            if (t) params.set('term', t);
            const res = await fetch(`/api/admin/posts?${params}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setPosts(data.posts || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [search, status, term]);

    useEffect(() => {
        (async () => {
            const { data } = await supabase
                .from('semesters')
                .select('term_code, name, is_active')
                .order('term_code', { ascending: false });
            setSemesters(data || []);
        })();
        load({ search: '', status: 'active', term: '' });
        // eslint-disable-next-line
    }, []);

    const setStatusAndLoad = (v) => { setStatus(v); load({ status: v }); };
    const setTermAndLoad = (v) => { setTerm(v); load({ term: v }); };
    const submitSearch = (e) => { e?.preventDefault(); load({ search }); };

    const handleExpire = async (id) => {
        if (!confirm('Force-expire this post?')) return;
        const res = await fetch('/api/admin/posts', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status: 'expired' }),
        });
        if (res.ok) setPosts(prev => prev.map(p => p.id === id ? { ...p, status: 'expired' } : p));
        else alert('Failed');
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this post permanently?')) return;
        const res = await fetch('/api/admin/posts', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id }),
        });
        if (res.ok) setPosts(prev => prev.filter(p => p.id !== id));
        else alert('Failed');
    };

    return (
        <Ctx.Provider value={{
            posts, search, setSearch, status, term, semesters, loading, error,
            setStatusAndLoad, setTermAndLoad, submitSearch, handleExpire, handleDelete,
        }}>
            {children}
        </Ctx.Provider>
    );
}

function PostsSidebar() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { status, term, semesters, posts, setStatusAndLoad, setTermAndLoad } = ctx;

    return (
        <>
            <div className={styles.sidebarCard}>
                <p className={styles.sectionTitle}>Filter by status</p>
                <div className={styles.navList}>
                    {STATUSES.map(s => (
                        <button
                            key={s.value}
                            className={`${styles.navBtn} ${status === s.value ? styles.navBtnActive : ''}`}
                            onClick={() => setStatusAndLoad(s.value)}
                        >
                            <span>{s.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className={styles.sidebarCard}>
                <p className={styles.sectionTitle}>Filter by semester</p>
                <div className={`${styles.navList} ${semesters.length > 5 ? styles.scrollList : ''}`}>
                    <button
                        className={`${styles.navBtn} ${term === '' ? styles.navBtnActive : ''}`}
                        onClick={() => setTermAndLoad('')}
                    >
                        <span>All semesters</span>
                    </button>
                    {semesters.map(s => (
                        <button
                            key={s.term_code}
                            className={`${styles.navBtn} ${term === s.term_code ? styles.navBtnActive : ''}`}
                            onClick={() => setTermAndLoad(s.term_code)}
                            title={s.name}
                        >
                            <span>{s.name}</span>
                            <span className={styles.navCount}>{s.term_code}</span>
                        </button>
                    ))}
                </div>
                <div style={{ marginTop: 8, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {posts.length} result{posts.length === 1 ? '' : 's'}
                </div>
            </div>
        </>
    );
}

function PostsMain() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { posts, search, setSearch, loading, error, submitSearch, handleExpire, handleDelete } = ctx;

    const badgeClass = (s) => {
        if (s === 'active') return styles.badgeActive;
        if (s === 'pending') return styles.badgePending;
        return styles.badgeExpired;
    };

    return (
        <>
            <form onSubmit={submitSearch} className={styles.card}>
                <div className={styles.searchWrapper}>
                    <span className={styles.searchIcon}><SearchIcon width={18} height={18} /></span>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search by course code or name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </form>

            <div className={styles.feedCard}>
                {error && <div className={styles.error}>{error}</div>}
                {loading ? (
                    <div className={styles.loading}><div className={styles.spinner} />Loading posts...</div>
                ) : posts.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyTitle}>No posts</div>
                        <span>Nothing matches the current filter.</span>
                    </div>
                ) : (
                    <div className={styles.feedList}>
                        {posts.map(p => (
                            <div key={p.id} className={styles.row}>
                                <div className={styles.rowMain}>
                                    <div className={styles.rowTitle}>
                                        {p.course_code}
                                        <span className={styles.badge}>{p.type}</span>
                                        <span className={`${styles.badge} ${badgeClass(p.status)}`}>{p.status}</span>
                                        <span className={styles.badge}>{p.term_code}</span>
                                    </div>
                                    <div className={styles.rowMeta}>
                                        {p.course_name} · have {p.have_section}{p.want_section ? ` → want ${p.want_section}` : ''}
                                    </div>
                                    <div className={styles.rowMeta}>
                                        {p.profile?.name || '(unknown)'} ({p.profile?.student_id || '—'}) · {p.profile?.email || '—'}
                                    </div>
                                </div>
                                <div className={styles.rowActions}>
                                    {p.status !== 'expired' && p.status !== 'completed' && (
                                        <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => handleExpire(p.id)}>Expire</button>
                                    )}
                                    <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleDelete(p.id)}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

const postsTab = { Provider: PostsProvider, Sidebar: PostsSidebar, Main: PostsMain };
export default postsTab;
