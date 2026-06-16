'use client';

import Link from 'next/link';
import styles from './DashboardCard.module.css';
import CardSkeleton from './CardSkeleton';

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
    children,
}) {
    const actionEl = actionLabel && (actionHref ? (
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
                {loading ? <CardSkeleton /> : empty ? <div className={styles.empty}>{empty}</div> : children}
            </div>
        </section>
    );
}
