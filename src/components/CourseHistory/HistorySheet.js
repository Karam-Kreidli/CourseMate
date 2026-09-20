'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { useSemester } from '@/lib/SemesterContext';
import { historyTerms, fetchCourseHistory } from '@/lib/courseHistory';
import styles from './CourseHistory.module.css';

/**
 * Quick look at a course's past terms, opened from its clock button in the
 * build tab. Slides up over the page so the schedule being built stays put;
 * "See every section" hands over to the History tab.
 */
export default function HistorySheet({ course, onClose, onSeeAll }) {
    const supabase = createClient();
    const { selectedTerm } = useSemester();
    const [history, setHistory] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        fetchCourseHistory(supabase, course.course_id, historyTerms(selectedTerm))
            .then(result => { if (!cancelled) setHistory(result); })
            .catch(() => { if (!cancelled) setFailed(true); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [course.course_id, selectedTerm]);

    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    const newestOffered = history?.terms.find(t => t.offered);

    return createPortal(
        <div className={styles.sheetBackdrop} onClick={onClose}>
            <div
                className={styles.sheet}
                role="dialog"
                aria-modal="true"
                aria-label={`Past terms for ${course.name || course.course_id}`}
                onClick={e => e.stopPropagation()}
            >
                <div className={styles.sheetHandle}></div>
                <div className={styles.courseHead}>
                    <div className={styles.courseTitle}>
                        <span className={styles.courseId}>{course.course_id}</span>
                        <span className={styles.courseName}>{course.name}</span>
                    </div>
                    <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">×</button>
                </div>

                {!history && !failed && <div className={styles.spinner}></div>}
                {failed && <div className={styles.empty}>Couldn&rsquo;t load this course&rsquo;s history.</div>}

                {history && (
                    <>
                        <div className={styles.tiles} style={{ gridTemplateColumns: `repeat(${history.terms.length}, minmax(0, 1fr))` }}>
                            {/* Oldest on the left, so the tiles read like a timeline. */}
                            {history.terms.slice().reverse().map(t => (
                                <div key={t.code} className={t.offered ? styles.tile : styles.tileOff}>
                                    <span className={styles.tileTerm}>{t.label}</span>
                                    <span className={styles.tileCount}>{t.sections.length}</span>
                                    <span className={styles.tileLabel}>
                                        {t.offered ? (t.sections.length === 1 ? 'section' : 'sections') : 'not offered'}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {history.instructors.length > 0 && (
                            <div className={styles.sheetBlock}>
                                <span className={styles.sectionTitle}>Who taught it</span>
                                {history.instructors.slice(0, 5).map(i => (
                                    <div key={i.name} className={styles.instructorRow}>
                                        <span className={styles.instructorName}>{i.name}</span>
                                        <span className={styles.instructorMeta}>
                                            {i.terms.join(', ')} · {i.sections} {i.sections === 1 ? 'section' : 'sections'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {history.usualTimes.length > 0 && (
                            <div className={styles.sheetBlock}>
                                <span className={styles.sectionTitle}>Usual times</span>
                                <div className={styles.chips}>
                                    {history.usualTimes.map(t => <span key={t} className={styles.chipLarge}>{t}</span>)}
                                </div>
                            </div>
                        )}

                        {newestOffered ? (
                            <button type="button" className={styles.sheetPrimary} onClick={() => onSeeAll(newestOffered.code)}>
                                See every section
                            </button>
                        ) : (
                            <div className={styles.empty}>Not offered in any of these terms.</div>
                        )}
                    </>
                )}
            </div>
        </div>,
        document.body
    );
}
