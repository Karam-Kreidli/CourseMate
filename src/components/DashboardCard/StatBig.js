import styles from './StatBig.module.css';

export default function StatBig({ value, max, label, sub, tone = 'accent' }) {
    const valueClass = tone === 'muted'
        ? styles.valueMuted
        : tone === 'accent'
            ? styles.valueAccent
            : '';
    return (
        <div className={styles.stat}>
            <div className={styles.valueRow}>
                <span className={`${styles.value} ${valueClass}`}>{value}</span>
                {max !== undefined && max !== null && <span className={styles.max}>/ {max}</span>}
            </div>
            {label && <span className={styles.label}>{label}</span>}
            {sub && <span className={styles.sub}>{sub}</span>}
        </div>
    );
}
