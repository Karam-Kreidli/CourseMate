'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { SearchIcon } from '@/components/Icons';
import styles from '../admin.module.css';
import UserSchedulesModal from './UserSchedulesModal';

const Ctx = createContext(null);

function UsersProvider({ children }) {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [major, setMajor] = useState('');
    const [gender, setGender] = useState('');
    const [majors, setMajors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [viewingUser, setViewingUser] = useState(null);
    const supabase = createClient();

    const load = useCallback(async (overrides = {}) => {
        const q = overrides.search !== undefined ? overrides.search : search;
        const m = overrides.major !== undefined ? overrides.major : major;
        const g = overrides.gender !== undefined ? overrides.gender : gender;
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams();
            if (q) params.set('q', q);
            if (m) params.set('major', m);
            if (g) params.set('gender', g);
            const res = await fetch(`/api/admin/users?${params}`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setUsers(data.users || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [search, major, gender]);

    useEffect(() => {
        (async () => {
            const { data } = await supabase.from('majors').select('code, name').order('name');
            setMajors(data || []);
        })();
        load({ search: '', major: '', gender: '' });
        // eslint-disable-next-line
    }, []);

    const setMajorAndLoad = (v) => { setMajor(v); load({ major: v }); };
    const setGenderAndLoad = (v) => { setGender(v); load({ gender: v }); };
    const submitSearch = (e) => { e?.preventDefault(); load({ search }); };
    const reset = () => { setSearch(''); setMajor(''); setGender(''); load({ search: '', major: '', gender: '' }); };

    const handleDelete = async (id, name) => {
        if (!confirm(`Delete user ${name || id}? This removes their auth account and cascades to profile/posts/matches.`)) return;
        try {
            const res = await fetch('/api/admin/users', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Delete failed');
            }
            setUsers(prev => prev.filter(u => u.id !== id));
        } catch (e) {
            alert(e.message);
        }
    };

    return (
        <Ctx.Provider value={{
            users, search, setSearch, major, gender, majors, loading, error,
            viewingUser, setViewingUser,
            setMajorAndLoad, setGenderAndLoad, submitSearch, reset, handleDelete,
        }}>
            {children}
        </Ctx.Provider>
    );
}

function UsersSidebar() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { major, gender, majors, users, setMajorAndLoad, setGenderAndLoad, reset } = ctx;

    return (
        <>
            <div className={styles.sidebarCard}>
                <p className={styles.sectionTitle}>Filter by gender</p>
                <div className={styles.navList}>
                    {[
                        { value: '', label: 'All' },
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                    ].map(g => (
                        <button
                            key={g.value || 'all'}
                            className={`${styles.navBtn} ${gender === g.value ? styles.navBtnActive : ''}`}
                            onClick={() => setGenderAndLoad(g.value)}
                        >
                            <span>{g.label}</span>
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
                    Reset all filters
                </button>
                <div style={{ marginTop: 8, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {users.length} result{users.length === 1 ? '' : 's'}
                </div>
            </div>
        </>
    );
}

function UsersMain() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { users, search, setSearch, loading, error, viewingUser, setViewingUser, submitSearch, handleDelete } = ctx;

    return (
        <>
            <form onSubmit={submitSearch} className={styles.card}>
                <div className={styles.searchWrapper}>
                    <span className={styles.searchIcon}><SearchIcon width={18} height={18} /></span>
                    <input
                        type="text"
                        className={styles.searchInput}
                        placeholder="Search by name, email, or student ID..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </form>

            <div className={styles.feedCard}>
                {error && <div className={styles.error}>{error}</div>}
                {loading ? (
                    <div className={styles.loading}><div className={styles.spinner} />Loading users...</div>
                ) : users.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyTitle}>No users found</div>
                        <span>Try adjusting your filters or search.</span>
                    </div>
                ) : (
                    <div className={styles.feedList}>
                        {users.map(u => (
                            <div key={u.id} className={styles.row}>
                                <div className={styles.rowMain}>
                                    <div className={styles.rowTitle}>
                                        {u.name || '(no name)'}
                                        {u.major && <span className={styles.badge}>{u.major}</span>}
                                        {u.gender && <span className={styles.badge}>{u.gender}</span>}
                                    </div>
                                    <div className={styles.rowMeta}>
                                        {u.email || '—'} · {u.student_id || 'no ID'} · {u.phone || 'no phone'}
                                    </div>
                                </div>
                                <div className={styles.rowActions}>
                                    <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setViewingUser(u)}>Schedules</button>
                                    <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => handleDelete(u.id, u.name)}>Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {viewingUser && (
                <UserSchedulesModal user={viewingUser} onClose={() => setViewingUser(null)} />
            )}
        </>
    );
}

const usersTab = { Provider: UsersProvider, Sidebar: UsersSidebar, Main: UsersMain };
export default usersTab;
