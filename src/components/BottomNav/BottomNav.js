'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './BottomNav.module.css';

import { HomeIcon, SwapIcon, ProfileIcon, ScheduleIcon, PlusIcon, BellIcon } from '../Icons';

export default function BottomNav() {
    const pathname = usePathname();
    const [unread, setUnread] = useState(0);
    const supabase = createClient();

    const loadUnread = async () => {
        const { count } = await supabase
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .is('read', false);
        setUnread(count || 0);
    };

    // Poll as a fallback, and re-check on every route change (e.g. right after
    // leaving /notifications, once its "mark read" writes have landed).
    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            const { count } = await supabase
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .is('read', false);
            if (!cancelled) setUnread(count || 0);
        };
        run();
        const interval = setInterval(run, 60000);
        return () => { cancelled = true; clearInterval(interval); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    // Live badge updates: a new notification (e.g. a match found) lands on the
    // bell instantly instead of waiting up to 60s for the poll above.
    useEffect(() => {
        let channel = null;
        let cancelled = false;
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || cancelled || typeof supabase.channel !== 'function') return;
            channel = supabase
                .channel(`notifications-badge-${user.id}`)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, loadUnread)
                .subscribe();
        })();
        return () => {
            cancelled = true;
            if (channel) supabase.removeChannel(channel);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const navItems = [
        { href: '/', icon: <HomeIcon />, label: 'Home' },
        { href: '/schedule', icon: <ScheduleIcon />, label: 'Schedule' },
        { href: '/post', icon: <PlusIcon />, label: 'Post' },
        { href: '/browse', icon: <SwapIcon />, label: 'Browse' },
        { href: '/notifications', icon: <BellIcon />, label: 'Alerts', badge: unread },
        { href: '/profile', icon: <ProfileIcon />, label: 'Profile' },
    ];

    return (
        <nav className={styles.bottomNav}>
            {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                    <Link key={item.href} href={item.href} className={`${styles.navItem} ${isActive ? styles.active : ''}`}>
                        <span className={styles.navIcon}>
                            {item.icon}
                            {item.badge > 0 && (
                                <span className={styles.badge}>{item.badge > 9 ? '9+' : item.badge}</span>
                            )}
                        </span>
                        <span className={styles.navLabel}>{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}
