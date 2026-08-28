import styles from './PageHeader.module.css';

/**
 * The glass title card at the top of a page.
 *
 * No back button by design — navigation is the bottom nav, the menu, and the
 * system back gesture. `left` and `right` are slots for the chrome added in
 * phase 2 (hamburger, bell); `children` is for anything page-specific that
 * belongs on the right, like Notifications' "Clear all".
 */
export default function PageHeader({ title, subtitle, left = null, right = null, children }) {
    const actions = right ?? children;

    return (
        <header className={styles.header}>
            <div className={styles.titleGroup}>
                {left}
                <div>
                    <h1 className={styles.title}>{title}</h1>
                    {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                </div>
            </div>
            {actions && <div className={styles.actions}>{actions}</div>}
        </header>
    );
}
