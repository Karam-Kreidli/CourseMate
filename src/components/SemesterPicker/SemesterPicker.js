'use client';

import { useEffect, useRef, useState } from 'react';
import { useSemester } from '@/lib/SemesterContext';
import styles from './SemesterPicker.module.css';

const Chevron = () => (
    <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9" />
    </svg>
);

const Check = () => (
    <svg className={styles.check} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

/**
 * Term switcher.
 *
 * Works for any number of active semesters. The pill it replaces only rendered
 * when there were exactly two, so three active terms left users with no way to
 * switch at all. Renders nothing when there is nothing to choose between.
 */
export default function SemesterPicker() {
    const { semesters, selectedTerm, setSelectedTerm } = useSemester();
    const [open, setOpen] = useState(false);
    const triggerRef = useRef(null);
    const wrapRef = useRef(null);

    // Close on Escape or an outside click. A fixed-position scrim would not
    // work here: the hero's backdrop-filter makes it the containing block for
    // fixed descendants, so a "full screen" scrim would only cover the hero.
    useEffect(() => {
        if (!open) return;
        const onKey = (e) => {
            if (e.key === 'Escape') {
                setOpen(false);
                triggerRef.current?.focus();
            }
        };
        const onPointerDown = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
        };
    }, [open]);

    if (!semesters || semesters.length <= 1) return null;

    const current = semesters.find(s => s.term_code === selectedTerm);

    return (
        <div className={styles.wrap} ref={wrapRef}>
            <button
                type="button"
                ref={triggerRef}
                className={styles.chip}
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                aria-haspopup="listbox"
                aria-label={`Semester: ${current?.name || 'select'}`}
            >
                {current?.name || 'Select semester'}
                <Chevron />
            </button>

            {open && (
                    <ul className={styles.menu} role="listbox" aria-label="Semester">
                        {semesters.map(sem => {
                            const isSelected = sem.term_code === selectedTerm;
                            return (
                                <li key={sem.term_code} role="none">
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={isSelected}
                                        className={`${styles.option} ${isSelected ? styles.selected : ''}`}
                                        onClick={() => {
                                            setSelectedTerm(sem.term_code);
                                            setOpen(false);
                                        }}
                                    >
                                        {sem.name}
                                        {isSelected && <Check />}
                                    </button>
                                </li>
                            );
                        })}
                </ul>
            )}
        </div>
    );
}
