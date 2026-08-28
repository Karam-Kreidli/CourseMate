'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import useUnreadCount from '@/lib/useUnreadCount';
import AppMenu from '@/components/AppMenu';
import AlertsBell from '@/components/AlertsBell';
import { HomeIcon, SearchIcon, ScheduleIcon, PlusIcon, ActivityIcon } from '../Icons';
import styles from './TopBar.module.css';

const NAV_ITEMS = [
    { href: '/', icon: <HomeIcon />, label: 'Home' },
    { href: '/browse', icon: <SearchIcon />, label: 'Browse' },
    { href: '/schedule', icon: <ScheduleIcon />, label: 'Schedule' },
    { href: '/matches', icon: <ActivityIcon />, label: 'Activity' },
];

const isActiveRoute = (pathname, href) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

/**
 * Desktop navigation (≥1024px). Hidden below that, where BottomNav takes over.
 * Mirrors BottomNav's destinations exactly; Post is a filled button here
 * because a raised FAB only makes sense attached to a bottom bar.
 */
export default function TopBar() {
    const pathname = usePathname();
    const unread = useUnreadCount();

    return (
        <header className={styles.topBar}>
            <Link href="/" className={styles.brand}>
                <span className={styles.logoFrame}>
                    <Image src="/logo.png" alt="" width={64} height={64} className={styles.logoImage} />
                </span>
                <span className={styles.wordmark}>CourseMate</span>
            </Link>

            <nav className={styles.nav} aria-label="Main">
                {NAV_ITEMS.map(item => {
                    const isActive = isActiveRoute(pathname, item.href);
                    const badge = item.href === '/matches' ? unread : 0;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            {item.icon}
                            {item.label}
                            {badge > 0 && (
                                <span className={styles.badge}>{badge > 9 ? '9+' : badge}</span>
                            )}
                        </Link>
                    );
                })}
            </nav>

            <div className={styles.actions}>
                <Link href="/post" className={styles.newPost}>
                    <PlusIcon />
                    New post
                </Link>
                <AlertsBell />
                <AppMenu />
            </div>
        </header>
    );
}
