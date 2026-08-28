'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useUnreadCount from '@/lib/useUnreadCount';
import styles from './BottomNav.module.css';

import { HomeIcon, SearchIcon, ScheduleIcon, PlusIcon, ActivityIcon } from '../Icons';

// Post is deliberately absent: it is the raised centre button, not a tab.
const NAV_ITEMS = [
    { href: '/', icon: <HomeIcon />, label: 'Home' },
    { href: '/browse', icon: <SearchIcon />, label: 'Browse' },
    { href: '/schedule', icon: <ScheduleIcon />, label: 'Schedule' },
    { href: '/matches', icon: <ActivityIcon />, label: 'Activity' },
];

// Sub-routes that should keep their parent tab lit. Home stays exact-match so
// it doesn't win on every route.
const isActiveRoute = (pathname, href) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

export default function BottomNav() {
    const pathname = usePathname();
    const unread = useUnreadCount();
    const postActive = isActiveRoute(pathname, '/post');

    const renderItem = (item) => {
        const isActive = isActiveRoute(pathname, item.href);
        return (
            <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.active : ''}`}
                aria-current={isActive ? 'page' : undefined}
            >
                <span className={styles.navIcon}>
                    {item.icon}
                    {item.badge > 0 && (
                        <span className={styles.badge}>{item.badge > 9 ? '9+' : item.badge}</span>
                    )}
                </span>
                <span className={styles.navLabel}>{item.label}</span>
            </Link>
        );
    };

    const [home, browse, schedule, activity] = NAV_ITEMS;

    return (
        <nav className={styles.bottomNav} aria-label="Main">
            {renderItem(home)}
            {renderItem(browse)}

            {/* Creating a post is the primary action, so it gets the centre
                slot as a raised button rather than competing as a tab. */}
            <Link
                href="/post"
                className={`${styles.fab} ${postActive ? styles.fabActive : ''}`}
                aria-label="New post"
                aria-current={postActive ? 'page' : undefined}
            >
                <PlusIcon />
            </Link>

            {renderItem(schedule)}
            {renderItem({ ...activity, badge: unread })}
        </nav>
    );
}
