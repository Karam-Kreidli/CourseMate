import Link from 'next/link';
import styles from './MinimapLink.module.css';

/**
 * The way into the campus map from home: a round minimap, the way a game
 * shows one, framing the middle of campus. The dot in the middle is
 * decoration, not the student's position; nothing here knows where they are.
 *
 * Two homes, never both on screen. On desktop it floats in the bottom right
 * corner. Below 1024px, where the bottom nav and the page's own buttons fill
 * that corner, `inline` puts a small one in the header's top right instead,
 * where it scrolls away with the page rather than covering anything.
 */
export default function MinimapLink({ inline = false }) {
    return (
        <Link
            href="/map"
            className={`${styles.minimap} ${inline ? styles.inline : styles.corner}`}
            aria-label="Open the campus map"
        >
            <span className={styles.disc} aria-hidden="true">
                <span className={styles.ground} />
                <span className={styles.player} />
            </span>
            <span className={styles.north} aria-hidden="true">N</span>
            {!inline && <span className={styles.label}>Campus map</span>}
        </Link>
    );
}
