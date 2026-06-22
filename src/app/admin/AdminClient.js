'use client';

import { useState } from 'react';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import overviewTab from './tabs/OverviewTab';
import usersTab from './tabs/UsersTab';
import postsTab from './tabs/PostsTab';
import semestersTab from './tabs/SemestersTab';
import majorsTab from './tabs/MajorsTab';
import coursesTab from './tabs/CoursesTab';
import announcementsTab from './tabs/AnnouncementsTab';
import styles from './admin.module.css';

const TABS = [
    { id: 'overview', label: 'Overview', module: overviewTab },
    { id: 'users', label: 'Users', module: usersTab },
    { id: 'posts', label: 'Posts', module: postsTab },
    { id: 'semesters', label: 'Semesters', module: semestersTab },
    { id: 'majors', label: 'Majors', module: majorsTab },
    { id: 'courses', label: 'Courses', module: coursesTab },
    { id: 'announcements', label: 'Announcements', module: announcementsTab },
];

export default function AdminClient() {
    const [active, setActive] = useState('overview');
    const activeTab = TABS.find(t => t.id === active);
    const { Provider, Sidebar, Main } = activeTab.module;

    return (
        <div className={styles.page}>
            <div className={styles.pageInner}>
                <header className={styles.topbar}>
                    <div className={styles.topbarBrand}>
                        <span className={styles.topbarTitle}>Admin</span>
                        <span className={styles.topbarSubtitle}>CourseMate Console</span>
                    </div>
                    <nav className={styles.topTabs}>
                        {TABS.map(t => (
                            <button
                                key={t.id}
                                className={`${styles.topTab} ${active === t.id ? styles.activeTopTab : ''}`}
                                onClick={() => setActive(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </nav>
                    <div className={styles.topbarRight}>
                        <Link href="/" className={`${styles.btn} ${styles.btnGhost}`}>
                            ← Exit admin
                        </Link>
                        <ThemeToggle />
                    </div>
                </header>

                <Provider>
                    <div className={styles.workspace}>
                        <aside className={styles.sidebar}>
                            <Sidebar />
                        </aside>
                        <main className={styles.mainContent}>
                            <Main />
                        </main>
                    </div>
                </Provider>
            </div>
        </div>
    );
}
