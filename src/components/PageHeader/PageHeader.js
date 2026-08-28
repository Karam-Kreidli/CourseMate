'use client';

import AppMenu from '@/components/AppMenu';
import AlertsBell from '@/components/AlertsBell';
import styles from './PageHeader.module.css';

/**
 * The glass title card at the top of a page.
 *
 * Carries the app chrome by default: the hamburger menu on the left, the
 * alerts bell on the right. No back button by design — navigation is the
 * bottom nav, the menu, and the system back gesture.
 *
 *   menu={false}  drop the hamburger (nothing does yet)
 *   bell={false}  drop the bell — used by /notifications, which *is* the bell
 *   children      extra right-hand actions, e.g. "Clear all"
 */
export default function PageHeader({
    title,
    subtitle,
    menu = true,
    bell = true,
    left = null,
    children,
}) {
    const hasActions = bell || children;

    return (
        <header className={styles.header}>
            <div className={styles.titleGroup}>
                {menu && <AppMenu />}
                {left}
                <div className={styles.titleText}>
                    <h1 className={styles.title}>{title}</h1>
                    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                </div>
            </div>

            {hasActions && (
                <div className={styles.actions}>
                    {children}
                    {bell && <AlertsBell />}
                </div>
            )}
        </header>
    );
}
