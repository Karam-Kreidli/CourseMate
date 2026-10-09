'use client';

import Link from 'next/link';
import styles from './DashboardCard.module.css';
import CardSkeleton from './CardSkeleton';
import { LockIcon } from '../Icons';
import { refuse } from '@/lib/guest';

export default function DashboardCard({
    title,
    icon,
    actionLabel,
    actionHref,
    onAction,
    loading = false,
    empty,
    className = '',
    style,
    // Guest mode: a reason to sign up. The card still shows, blurred under a lock.
    locked,
    children,
}) {
    const actionEl = !locked && actionLabel && (actionHref ? (
        <Link href={actionHref} className={styles.action}>{actionLabel} →</Link>
    ) : onAction ? (
        <button type="button" className={styles.action} onClick={onAction}>{actionLabel} →</button>
    ) : null);

    return (
        <section className={`${styles.card} ${className}`} style={style}>
            {(title || icon || actionEl) && (
                <header className={styles.header}>
                    <div className={styles.titleRow}>
                        {icon && <span className={styles.icon}>{icon}</span>}
                        {title && <p className={styles.title}>{title}</p>}
                    </div>
                    {actionEl}
                </header>
            )}
            <div className={styles.body}>
                {locked ? (
                    <button type="button" className={styles.locked} onClick={refuse} aria-disabled="true">
                        <div className={styles.lockedContent} aria-hidden="true">{children}</div>
                        <span className={styles.lockOverlay}><LockIcon width={18} height={18} />{locked}</span>
                    </button>
                ) : loading ? <CardSkeleton /> : empty ? <div className={styles.empty}>{empty}</div> : children}
            </div>
        </section>
    );
}
