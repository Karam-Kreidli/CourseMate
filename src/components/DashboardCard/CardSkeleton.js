import styles from './CardSkeleton.module.css';

export default function CardSkeleton() {
    return (
        <div className={styles.skeleton} aria-hidden="true">
            <div className={`${styles.row} ${styles.row1}`} />
            <div className={`${styles.row} ${styles.row2}`} />
            <div className={`${styles.row} ${styles.row3}`} />
        </div>
    );
}
