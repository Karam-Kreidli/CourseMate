'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import styles from './AppMenu.module.css';

const MenuIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
);
const PersonIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
);
const MoonIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
);
const SignOutIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
);

function initialsOf(name) {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

/**
 * The account menu behind the hamburger.
 *
 * Deliberately account-only: navigation lives in the bottom nav / top bar, so
 * this holds Profile & settings, the theme switch and Sign out. Admin is NOT
 * listed — it is reachable only by typing /admin on an admin account.
 */
export default function AppMenu() {
    const [open, setOpen] = useState(false);
    const [profile, setProfile] = useState(null);
    const [theme, setTheme] = useState('dark');
    const [mounted, setMounted] = useState(false);
    const anchorRef = useRef(null);
    const panelRef = useRef(null);
    const triggerRef = useRef(null);
    const router = useRouter();
    const pathname = usePathname();
    const supabase = createClient();

    useEffect(() => {
        setMounted(true);
        try {
            const saved = localStorage.getItem('theme')
                || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            setTheme(saved);
        } catch { /* storage unavailable — fall back to the default */ }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || cancelled) return;
            const { data } = await supabase
                .from('profiles')
                .select('name, student_id, major')
                .eq('id', user.id)
                .single();
            if (!cancelled) setProfile(data || null);
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Close on route change, so tapping a link never leaves the sheet open.
    useEffect(() => { setOpen(false); }, [pathname]);

    // Escape closes and returns focus to the trigger; focus moves into the
    // panel on open so keyboard users aren't stranded behind the scrim.
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        panelRef.current?.querySelector('a, button')?.focus();
        return () => document.removeEventListener('keydown', onKey);
    }, [open]);

    const toggleTheme = () => {
        const next = theme === 'light' ? 'dark' : 'light';
        setTheme(next);
        try { localStorage.setItem('theme', next); } catch { /* not fatal */ }
        document.documentElement.setAttribute('data-theme', next);
    };

    const signOut = async () => {
        setOpen(false);
        await supabase.auth.signOut();
        router.push('/auth');
        router.refresh();
    };

    return (
        <div className={styles.anchor} ref={anchorRef}>
            <button
                type="button"
                ref={triggerRef}
                className={styles.trigger}
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label="Menu"
            >
                <MenuIcon />
            </button>

            {open && (
                <>
                    <div
                        className={styles.scrim}
                        onClick={() => setOpen(false)}
                        aria-hidden="true"
                    />
                    <div className={styles.panel} ref={panelRef} role="menu" aria-label="Account menu">
                        <div className={styles.identity}>
                            <span className={styles.avatar}>{initialsOf(profile?.name)}</span>
                            <div className={styles.identityText}>
                                <div className={styles.name}>{profile?.name || 'Your account'}</div>
                                <div className={styles.meta}>
                                    {[profile?.major, profile?.student_id].filter(Boolean).join(' · ') || 'CourseMate'}
                                </div>
                            </div>
                        </div>

                        <div className={styles.rule} />

                        <div className={styles.rows}>
                            <Link href="/profile" className={styles.row} role="menuitem">
                                <PersonIcon />
                                Profile &amp; settings
                            </Link>

                            <button type="button" className={styles.row} role="menuitem" onClick={toggleTheme}>
                                <MoonIcon />
                                Dark mode
                                <span
                                    className={`${styles.switch} ${mounted && theme === 'dark' ? styles.switchOn : ''}`}
                                    aria-hidden="true"
                                />
                            </button>
                        </div>

                        <div className={styles.spacer} />
                        <div className={styles.rule} />

                        <div className={styles.rows}>
                            <button
                                type="button"
                                className={`${styles.row} ${styles.danger}`}
                                role="menuitem"
                                onClick={signOut}
                            >
                                <SignOutIcon />
                                Sign out
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
