'use client';

import { useCallback, useEffect, useState } from 'react';
import styles from './ThemeToggle.module.css';

// "dark" still means the navy theme so anyone's saved choice survives; "black"
// is the new true-black variant. "system" follows the OS and keeps following it,
// which the old two-state toggle could not do once you had picked either side.
const OPTIONS = [
    { value: 'system', label: 'Auto', title: 'Follow your device setting' },
    { value: 'light', label: 'Light', title: 'Light theme' },
    { value: 'dark', label: 'Navy', title: 'Dark theme, navy background' },
    { value: 'black', label: 'Black', title: 'True black, best on OLED screens' },
];

const DARK_QUERY = '(prefers-color-scheme: dark)';

// System dark resolves to navy, not black: navy is the app's dark identity and
// black is a deliberate choice for OLED or low light.
function resolveTheme(preference) {
    if (preference !== 'system') return preference;
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

function applyTheme(preference) {
    document.documentElement.setAttribute('data-theme', resolveTheme(preference));
}

// `compact` drops the text labels, for tight places like the account menu
// where the swatches alone carry the choice.
export default function ThemeToggle({ compact = false }) {
    const [preference, setPreference] = useState('system');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('theme');
        const initial = OPTIONS.some(o => o.value === saved) ? saved : 'system';
        setPreference(initial);
        applyTheme(initial);
        setMounted(true);
    }, []);

    // Only while following the system: keep up if the OS flips mid-session.
    useEffect(() => {
        if (preference !== 'system') return;
        const media = window.matchMedia(DARK_QUERY);
        const onChange = () => applyTheme('system');
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, [preference]);

    const choose = useCallback((value) => {
        setPreference(value);
        localStorage.setItem('theme', value);
        applyTheme(value);
    }, []);

    // Nothing is rendered until the saved choice is known, so the control never
    // shows the wrong option selected for a frame.
    if (!mounted) return null;

    return (
        <div className={`${styles.group} ${compact ? styles.compact : ''}`} role="radiogroup" aria-label="Colour theme">
            {OPTIONS.map(option => (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={preference === option.value}
                    title={option.title}
                    className={`${styles.option} ${preference === option.value ? styles.selected : ''}`}
                    onClick={() => choose(option.value)}
                    aria-label={option.label}
                >
                    <span className={`${styles.swatch} ${styles[`swatch_${option.value}`]}`} aria-hidden="true" />
                    {!compact && <span className={styles.label}>{option.label}</span>}
                </button>
            ))}
        </div>
    );
}
