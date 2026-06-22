'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import styles from '../admin.module.css';

const Ctx = createContext(null);

function OverviewProvider({ children }) {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [updatedAt, setUpdatedAt] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/admin/stats');
            if (!res.ok) throw new Error(await res.text());
            setStats(await res.json());
            setUpdatedAt(new Date());
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    return (
        <Ctx.Provider value={{ stats, loading, error, updatedAt, reload: load }}>
            {children}
        </Ctx.Provider>
    );
}

function OverviewSidebar() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { updatedAt, reload, loading } = ctx;
    return (
        <div className={styles.sidebarCard}>
            <p className={styles.sectionTitle}>Snapshot</p>
            <p className={styles.previewMuted} style={{ textAlign: 'left', padding: 0, fontSize: '0.75rem' }}>
                A live snapshot of platform activity.
            </p>
            <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnFull}`} style={{ marginTop: 10 }} onClick={reload} disabled={loading}>
                {loading ? 'Refreshing…' : 'Refresh'}
            </button>
            {updatedAt && (
                <div style={{ marginTop: 8, textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Updated {updatedAt.toLocaleTimeString()}
                </div>
            )}
        </div>
    );
}

function StatTile({ label, value, sub }) {
    return (
        <div style={{
            background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)', padding: '14px 16px', flex: '1 1 150px', minWidth: 140,
        }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.1 }}>{value}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, marginTop: 2 }}>{label}</div>
            {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>{sub}</div>}
        </div>
    );
}

const LABELS = {
    male: 'Male', female: 'Female', unknown: '—',
    swap: 'Swap', giveaway: 'Giveaway', request: 'Request',
    active: 'Active', pending: 'Pending', completed: 'Completed', expired: 'Expired', declined: 'Declined',
};
const labelOf = (k) => LABELS[k] || k;

function BarList({ items, empty = 'No data' }) {
    if (!items || items.length === 0) return <div className={styles.previewMuted} style={{ padding: 0, fontSize: '0.75rem' }}>{empty}</div>;
    const max = Math.max(...items.map(i => i.count), 1);
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map(i => (
                <div key={i.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: '0 0 120px', fontSize: '0.8125rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={i.label || labelOf(i.key)}>
                        {i.label || labelOf(i.key)}
                    </div>
                    <div style={{ flex: '1 1 auto', height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${(i.count / max) * 100}%`, height: '100%', background: 'var(--color-accent)', borderRadius: 4 }} />
                    </div>
                    <div style={{ flex: '0 0 40px', textAlign: 'right', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-primary)' }}>{i.count}</div>
                </div>
            ))}
        </div>
    );
}

function Panel({ title, children }) {
    return (
        <div className={styles.card} style={{ flex: '1 1 320px', minWidth: 280 }}>
            <p className={styles.sectionTitle}>{title}</p>
            {children}
        </div>
    );
}

function OverviewMain() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { stats, loading, error } = ctx;

    if (error) return <div className={styles.error}>{error}</div>;
    if (loading && !stats) return <div className={styles.loading}><div className={styles.spinner} />Loading analytics…</div>;
    if (!stats) return null;

    const { users, posts, matches, savedSchedules, interests, activeAnnouncements, topCourses } = stats;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Headline tiles */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                <StatTile label="Users" value={users.total} sub={`+${users.newLast7} this week`} />
                <StatTile label="Live posts" value={posts.live} sub={`${posts.total} all-time`} />
                <StatTile label="Pending matches" value={matches.pending} sub={`${matches.total} all-time`} />
                <StatTile label="Saved schedules" value={savedSchedules} />
                <StatTile label="Interests sent" value={interests} />
                <StatTile label="Active announcements" value={activeAnnouncements} />
            </div>

            {/* Activity */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <Panel title="New users">
                    <BarList items={[
                        { key: '7d', label: 'Last 7 days', count: users.newLast7 },
                        { key: '30d', label: 'Last 30 days', count: users.newLast30 },
                        { key: 'all', label: 'All time', count: users.total },
                    ]} />
                </Panel>
                <Panel title="New posts">
                    <BarList items={[
                        { key: '7d', label: 'Last 7 days', count: posts.newLast7 },
                        { key: '30d', label: 'Last 30 days', count: posts.newLast30 },
                        { key: 'all', label: 'All time', count: posts.total },
                    ]} />
                </Panel>
            </div>

            {/* Breakdowns */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <Panel title="Posts by type"><BarList items={posts.byType} /></Panel>
                <Panel title="Posts by status"><BarList items={posts.byStatus} /></Panel>
                <Panel title="Matches by status"><BarList items={matches.byStatus} empty="No matches yet" /></Panel>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                <Panel title="Users by major"><BarList items={users.byMajor} /></Panel>
                <Panel title="Users by gender"><BarList items={users.byGender} /></Panel>
            </div>

            <Panel title="Top courses by posts">
                <BarList
                    items={topCourses.map(c => ({ key: c.course_id, label: `${c.course_id}${c.name ? ' · ' + c.name : ''}`, count: c.count }))}
                    empty="No posts yet"
                />
            </Panel>
        </div>
    );
}

const overviewTab = { Provider: OverviewProvider, Sidebar: OverviewSidebar, Main: OverviewMain };
export default overviewTab;
