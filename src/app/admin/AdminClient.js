'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ThemeToggle from '@/components/ThemeToggle';
import overviewTab from './tabs/OverviewTab';
import usersTab from './tabs/UsersTab';
import postsTab from './tabs/PostsTab';
import semestersTab from './tabs/SemestersTab';
import majorsTab from './tabs/MajorsTab';
import coursesTab from './tabs/CoursesTab';
import roomsTab from './tabs/RoomsTab';
import announcementsTab from './tabs/AnnouncementsTab';
import mapTab from './tabs/MapTab';
import styles from './admin.module.css';

const TABS = [
    { id: 'overview', label: 'Overview', module: overviewTab },
    { id: 'users', label: 'Users', module: usersTab },
    { id: 'posts', label: 'Posts', module: postsTab },
    { id: 'semesters', label: 'Semesters', module: semestersTab },
    { id: 'majors', label: 'Majors', module: majorsTab },
    { id: 'courses', label: 'Courses', module: coursesTab },
    { id: 'rooms', label: 'Rooms', module: roomsTab },
    { id: 'announcements', label: 'Announcements', module: announcementsTab },
    { id: 'map', label: 'Map', module: mapTab },
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
                        <span className={styles.logoFrame}>
                            <Image src="/logo.png" alt="" width={64} height={64} className={styles.logoImage} />
                        </span>
                        <span className={styles.topbarTitle}>Admin</span>
                    </div>

                    {/* Scrolls sideways on a narrow window rather than wrapping or
                        running under the brand. */}
                    <nav className={styles.topTabs} aria-label="Admin sections">
                        {TABS.map(t => (
                            <button
                                key={t.id}
                                className={`${styles.topTab} ${active === t.id ? styles.activeTopTab : ''}`}
                                aria-current={active === t.id ? 'page' : undefined}
                                onClick={() => setActive(t.id)}
                            >
                                {t.label}
                            </button>
                        ))}
                    </nav>

                    <div className={styles.topbarRight}>
                        {/* Swatches only: the names are on hover, and the labelled
                            version crowded the tabs off the bar. */}
                        <ThemeToggle compact />
                        <span className={styles.topbarDivider} aria-hidden="true" />
                        <Link href="/" className={styles.exitLink}>
                            <span className={styles.exitLabel}>Exit admin</span>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                        </Link>
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
