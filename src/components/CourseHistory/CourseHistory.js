'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSemester } from '@/lib/SemesterContext';
import { HistoryIcon, ChevronLeftIcon } from '@/components/Icons';
import {
    historyTerms, termLabel, fetchCourseHistory, startGrid, meetingText, formatClock, CAMPUS_LABELS,
} from '@/lib/courseHistory';
import styles from './CourseHistory.module.css';

// PostgREST's or() splits on commas and parentheses, and ilike treats % and _
// as wildcards, so those can't pass through from the search box.
function cleanQuery(q) {
    return q.replace(/[,()%_*\\]/g, ' ').trim();
}

/**
 * The Schedule page's History tab: how a course ran in recent past terms.
 *
 * `request` opens a course straight away ({ courseId, courseName, term,
 * fromBuild }); the build tab's shortcuts send one. `onBackToBuild` is shown
 * as a back link when the student came from building a schedule.
 */
export default function CourseHistory({ request, onBackToBuild }) {
    const supabase = createClient();
    const { selectedTerm } = useSemester();
    const terms = historyTerms(selectedTerm);

    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [course, setCourse] = useState(null);
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    // Sections of this course in the term being planned; null while unknown or
    // when that term has no sections loaded at all.
    const [openNow, setOpenNow] = useState(null);
    const [openTerm, setOpenTerm] = useState(null);
    const searchRef = useRef(null);
    const searchTimeout = useRef(null);

    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const selectCourse = async (picked, term = null) => {
        setCourse(picked);
        setQuery(picked.name || picked.course_id);
        setShowDropdown(false);
        setOpenTerm(term);
        setHistory(null);
        setOpenNow(null);
        setFailed(false);
        if (!terms.length) return;
        setLoading(true);
        try {
            const [result, now, termAny] = await Promise.all([
                fetchCourseHistory(supabase, picked.course_id, terms),
                supabase.from('sections').select('crn', { count: 'exact', head: true })
                    .eq('term_code', selectedTerm).eq('course_id', picked.course_id).eq('is_active', true),
                supabase.from('sections').select('crn', { count: 'exact', head: true })
                    .eq('term_code', selectedTerm).eq('is_active', true),
            ]);
            setHistory(result);
            setOpenNow(termAny.count > 0 ? (now.count || 0) : null);
            // A term with nothing to show can't be opened; fall back to the list.
            if (term && !result.terms.find(t => t.code === term)?.offered) setOpenTerm(null);
        } catch {
            setFailed(true);
        }
        setLoading(false);
    };

    // A shortcut from the build tab, or a link like /schedule?mode=history&course=0401211.
    useEffect(() => {
        if (!request?.courseId || !selectedTerm) return;
        (async () => {
            let picked = { course_id: request.courseId, name: request.courseName, credit_hours: null };
            const { data } = await supabase.from('courses')
                .select('course_id, course_name, credit_hours').eq('course_id', request.courseId).maybeSingle();
            if (data) picked = { course_id: data.course_id, name: data.course_name, credit_hours: data.credit_hours };
            selectCourse(picked, request.term || null);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [request, selectedTerm]);

    // Another term being planned means another set of past terms.
    useEffect(() => {
        if (course && !request?.courseId) selectCourse(course);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTerm]);

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setQuery(value);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        const q = cleanQuery(value);
        if (q.length < 2) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }
        searchTimeout.current = setTimeout(async () => {
            const { data } = await supabase.from('courses')
                .select('course_id, course_name, credit_hours')
                .or(`course_name.ilike.%${q}%,course_id.ilike.%${q}%`)
                .order('course_id')
                .limit(8);
            setSuggestions((data || []).map(c => ({ course_id: c.course_id, name: c.course_name, credit_hours: c.credit_hours })));
            setShowDropdown(true);
        }, 250);
    };

    const pastLabels = terms.map(termLabel);
    const detail = history && openTerm ? history.terms.find(t => t.code === openTerm) : null;

    return (
        <div className={styles.main}>
            {onBackToBuild && (
                <button type="button" className={styles.backToBuild} onClick={onBackToBuild}>
                    <ChevronLeftIcon width={16} height={16} />
                    Back to your schedule
                </button>
            )}

            {!detail && (
                <div className={styles.card} ref={searchRef}>
                    <label htmlFor="history-search" className={styles.label}>Look up a course</label>
                    <div className={styles.searchWrapper}>
                        <input
                            id="history-search"
                            type="text"
                            className={styles.input}
                            placeholder="Search by course name or ID..."
                            autoComplete="off"
                            value={query}
                            onChange={handleSearchChange}
                            onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
                        />
                        {showDropdown && suggestions.length > 0 && (
                            <div className={styles.dropdown}>
                                {suggestions.map(c => (
                                    <button key={c.course_id} type="button" className={styles.dropdownItem} onClick={() => selectCourse(c)}>
                                        <span className={styles.dropdownId}>{c.course_id}</span>
                                        <span>{c.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {loading && <div className={styles.spinner}></div>}
            {failed && <div className={styles.empty}>Couldn&rsquo;t load this course&rsquo;s history. Try again in a moment.</div>}

            {!course && !loading && (
                <div className={styles.empty}>
                    <HistoryIcon width={32} height={32} />
                    <span className={styles.emptyTitle}>See how a course ran before</span>
                    <span>
                        {terms.length
                            ? `Times, instructors and sections from ${pastLabels.slice().reverse().join(', ')}.`
                            : 'Pick a semester first.'}
                    </span>
                </div>
            )}

            {course && history && !loading && !detail && (
                <>
                    <div className={styles.card}>
                        <div className={styles.courseHead}>
                            <div className={styles.courseTitle}>
                                <span className={styles.courseId}>{course.course_id}</span>
                                <span className={styles.courseName}>{course.name}</span>
                            </div>
                            {course.credit_hours > 0 && <span className={styles.credits}>{course.credit_hours} credits</span>}
                        </div>
                        <div className={styles.stats}>
                            <div className={styles.stat}>
                                <span className={styles.statValue}>{history.offeredCount} of {terms.length}</span>
                                <span className={styles.statLabel}>terms offered</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statValue}>{history.sectionsPerTerm}</span>
                                <span className={styles.statLabel}>sections a term</span>
                            </div>
                            <div className={styles.stat}>
                                <span className={styles.statValue}>{history.instructors.length}</span>
                                <span className={styles.statLabel}>{history.instructors.length === 1 ? 'instructor' : 'instructors'}</span>
                            </div>
                        </div>
                        {openNow != null && (
                            <div className={openNow > 0 ? styles.nowOpen : styles.nowClosed}>
                                {openNow > 0
                                    ? `Open this term too: ${openNow} ${openNow === 1 ? 'section' : 'sections'} in ${termLabel(selectedTerm)}`
                                    : `Not open in ${termLabel(selectedTerm)}`}
                            </div>
                        )}
                    </div>

                    <div className={styles.termList}>
                        <span className={styles.sectionTitle}>Past terms</span>
                        {history.terms.map(t => t.offered ? (
                            <button key={t.code} type="button" className={styles.termRow} onClick={() => setOpenTerm(t.code)}>
                                <span className={styles.termRowHead}>
                                    <span className={styles.termName}><span className={styles.dotOn}></span>{t.label}</span>
                                    <span className={styles.termCount}>
                                        {t.sections.length} {t.sections.length === 1 ? 'section' : 'sections'}
                                        {t.fill != null && ` · ${t.fill}% full`}
                                    </span>
                                </span>
                                <span className={styles.chips}>
                                    {t.dayPatterns.slice(0, 3).map(d => <span key={d} className={styles.chip}>{d}</span>)}
                                    {t.earliest != null && <span className={styles.chip}>{formatClock(t.earliest)} to {formatClock(t.latest)}</span>}
                                    <span className={styles.chip}>
                                        {t.instructors.length === 1 ? t.instructors[0] : `${t.instructors.length} instructors`}
                                    </span>
                                    {t.campuses.length === 1 && <span className={styles.chip}>{CAMPUS_LABELS[t.campuses[0]] || t.campuses[0]} campus only</span>}
                                </span>
                            </button>
                        ) : (
                            <div key={t.code} className={styles.termRowOff}>
                                <span className={styles.termName}><span className={styles.dotOff}></span>{t.label}</span>
                                <span>Not offered</span>
                            </div>
                        ))}
                    </div>

                    <p className={styles.footnote}>Past terms show what ran, not what will. Times and instructors change every term.</p>
                </>
            )}

            {detail && (
                <TermDetail
                    course={course}
                    history={history}
                    term={detail}
                    onPickTerm={setOpenTerm}
                    onBack={() => setOpenTerm(null)}
                />
            )}
        </div>
    );
}

function TermDetail({ course, history, term, onPickTerm, onBack }) {
    const grid = startGrid(term.sections);
    const anySeats = term.sections.some(s => s.enrollment != null && s.max_enrollment);

    return (
        <>
            <div className={styles.detailHead}>
                <button type="button" className={styles.iconBtn} onClick={onBack} aria-label="Back to all terms">
                    <ChevronLeftIcon width={18} height={18} />
                </button>
                <div className={styles.courseTitle}>
                    <span className={styles.courseId}>{course.course_id} · {course.name}</span>
                    <span className={styles.detailTerm}>{term.label}</span>
                </div>
            </div>

            <div className={styles.termTabs} role="tablist" aria-label="Term">
                {history.terms.map(t => (
                    <button
                        key={t.code}
                        type="button"
                        role="tab"
                        aria-selected={t.code === term.code}
                        disabled={!t.offered}
                        className={`${styles.termTab} ${t.code === term.code ? styles.termTabActive : ''}`}
                        onClick={() => onPickTerm(t.code)}
                        title={t.offered ? undefined : 'Not offered'}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {grid.starts.length > 0 && (
                <div className={styles.card}>
                    <span className={styles.sectionTitle}>When it ran</span>
                    <div className={styles.heat} style={{ gridTemplateColumns: `48px repeat(${grid.days.length}, minmax(0, 1fr))` }}>
                        <span></span>
                        {grid.days.map(d => <span key={d} className={styles.heatDay}>{d.toUpperCase()}</span>)}
                        {grid.starts.map((start, r) => (
                            <StartRow key={start} label={formatClock(start)} row={grid.cells[r]} days={grid.days} />
                        ))}
                    </div>
                </div>
            )}

            <div className={styles.listHead}>
                <span className={styles.sectionTitle}>{term.sections.length} {term.sections.length === 1 ? 'section' : 'sections'}</span>
                {anySeats && <span className={styles.listNote}>Enrolment when last checked</span>}
            </div>

            <div className={styles.sectionList}>
                {term.sections.map(s => {
                    const hasSeats = s.enrollment != null && s.max_enrollment > 0;
                    const pct = hasSeats ? Math.min(100, Math.round((s.enrollment / s.max_enrollment) * 100)) : 0;
                    return (
                        <div key={s.crn} className={styles.sectionCard}>
                            <div className={styles.sectionTop}>
                                <span className={styles.sectionTime}>{meetingText(s.class_time)}</span>
                                <span className={styles.sectionNum}>Sec {s.section_num}</span>
                            </div>
                            <div className={styles.sectionMid}>
                                <span>{s.instructor || 'Instructor not listed'}</span>
                                {s.campus && <span className={`${styles.campus} ${styles[`campus_${s.campus}`] || ''}`}>{CAMPUS_LABELS[s.campus] || s.campus}</span>}
                            </div>
                            {s.location && <div className={styles.sectionRoom}>{s.location}</div>}
                            {hasSeats && (
                                <div className={styles.fillRow}>
                                    <div className={styles.fillTrack}><div className={styles.fillBar} style={{ width: `${pct}%` }}></div></div>
                                    <span className={styles.fillText}>{s.enrollment}/{s.max_enrollment}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </>
    );
}

// Fixed steps by section count, on the app's green: 1 is a light turquoise
// green, and 4 or more is the darkest.
const SHADES = [
    { background: '#A7EBD6', color: '#0A2540' },
    { background: '#5CD6B0', color: '#0A2540' },
    { background: '#00A775', color: '#FFFFFF' },
    { background: '#006E4E', color: '#FFFFFF' },
];

function shade(n) {
    return SHADES[Math.min(n, SHADES.length) - 1];
}

function StartRow({ label, row, days }) {
    return (
        <>
            <span className={styles.heatHour}>{label}</span>
            {row.map((n, i) => (
                <span
                    key={days[i]}
                    className={styles.heatCell}
                    style={n ? shade(n) : undefined}
                    title={n ? `${n} ${n === 1 ? 'section' : 'sections'} starting ${days[i]} ${label}` : undefined}
                >
                    {n > 0 ? n : ''}
                </span>
            ))}
        </>
    );
}
