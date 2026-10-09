'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import useUnreadCount from '@/lib/useUnreadCount';
import { useIsGuest } from '@/lib/guest';
import { BellIcon } from '../Icons';
import styles from './AlertsBell.module.css';

/**
 * Top-bar entry point to /notifications, carrying the unread badge. A guest
 * has no alerts, so the same corner holds their way to sign in.
 */
export default function AlertsBell() {
    const unread = useUnreadCount();
    const pathname = usePathname();
    const isActive = pathname === '/notifications';
    const isGuest = useIsGuest();

    if (isGuest) return <Link href="/auth" className={styles.signIn}>Sign in</Link>;

    return (
        <Link
            href="/notifications"
            className={`${styles.bell} ${isActive ? styles.active : ''}`}
            aria-label={unread > 0 ? `Alerts, ${unread} unread` : 'Alerts'}
        >
            <BellIcon />
            {unread > 0 && (
                <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>
            )}
        </Link>
    );
}
