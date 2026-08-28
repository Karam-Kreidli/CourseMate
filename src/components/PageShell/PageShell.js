import BottomNav from '@/components/BottomNav';
import styles from './PageShell.module.css';

/**
 * The chrome every signed-in page sits in: background, centred column, bottom nav.
 *
 * width="standard" (680px) for reading/form pages, "wide" (1100px) for the
 * dashboard and the browse feed.
 *
 * Pass nav={false} for states that render before the nav is meaningful (the
 * profile-setup gate), and innerClassName when a page needs to change the
 * column's own layout — browse turns it into a two-column row.
 */
export default function PageShell({
    children,
    width = 'standard',
    nav = true,
    className = '',
    innerClassName = '',
}) {
    return (
        <div className={`${styles.page} ${className}`.trim()}>
            <div className={`${styles.pageInner} ${styles[width]} ${innerClassName}`.trim()}>
                {children}
            </div>
            {nav && <BottomNav />}
        </div>
    );
}
