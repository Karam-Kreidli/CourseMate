'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './BottomNav.module.css';

import { HomeIcon, SwapIcon, ProfileIcon, ScheduleIcon, PlusIcon, BellIcon, ChatIcon } from '../Icons';

export default function BottomNav() {
    const pathname = usePathname();
    const [unread, setUnread] = useState(0);
    const [unreadChats, setUnreadChats] = useState(0);

    useEffect(() => {
        const supabase = createClient();
        let cancelled = false;

        const loadUnread = async () => {
            const { count } = await supabase
                .from('notifications')
                .select('id', { count: 'exact', head: true })
                .is('read', false);
            if (!cancelled) setUnread(count || 0);

            const { data: chats } = await supabase.rpc('my_unread_message_count');
            if (!cancelled) setUnreadChats(chats || 0);

            // The app is open somewhere, so anything waiting has reached this
            // device — that's the second grey tick for whoever sent it.
            await supabase.rpc('mark_all_delivered');
        };

        loadUnread();
        const interval = setInterval(loadUnread, 60000);
        return () => { cancelled = true; clearInterval(interval); };
    }, [pathname]);

    const navItems = [
        { href: '/', icon: <HomeIcon />, label: 'Home' },
        { href: '/schedule', icon: <ScheduleIcon />, label: 'Schedule' },
        { href: '/post', icon: <PlusIcon />, label: 'Post' },
        { href: '/browse', icon: <SwapIcon />, label: 'Browse' },
        { href: '/chat', icon: <ChatIcon />, label: 'Chat', badge: unreadChats },
        { href: '/notifications', icon: <BellIcon />, label: 'Alerts', badge: unread },
        { href: '/profile', icon: <ProfileIcon />, label: 'Profile' },
    ];

    return (
        <nav className={styles.bottomNav}>
            {navItems.map((item) => {
                // startsWith so nested routes (e.g. /chat/[id]) keep the tab lit.
                const isActive = item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href || pathname.startsWith(`${item.href}/`);
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
