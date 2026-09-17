'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useSemester } from '@/lib/SemesterContext';
import { decodeHtmlEntities } from '@/lib/text';
import { OFFICE_HOUR_DAYS, formatClock, fetchOfficeHours, layoutOfficeHours } from '@/lib/officeHours';
import styles from './InstructorFinder.module.css';

// ===== TIME PARSING UTILITIES (reused from schedule) =====
function parseDays(dayStr) {
    const dayMap = {
        'Mon': 'Mon', 'Tue': 'Tue', 'Wed': 'Wed', 'Thu': 'Thu',
        'Sun': 'Sun', 'Sat': 'Sat', 'Fri': 'Fri',
        'M': 'Mon', 'T': 'Tue', 'W': 'Wed', 'R': 'Thu', 'Su': 'Sun', 'S': 'Sat',
    };
    const days = [];
    const parts = dayStr.trim().split(/[\s\/]+/);
    for (const p of parts) {
        if (dayMap[p]) days.push(dayMap[p]);
    }
    return days;
}

function parseTimeToMinutes(timeStr) {
    const str = timeStr.trim();
    const match12 = str.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (match12) {
        let hours = parseInt(match12[1]);
        const minutes = parseInt(match12[2]);
        const period = match12[3].toUpperCase();
        if (period === 'PM' && hours !== 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return hours * 60 + minutes;
    }
    const match24 = str.match(/(\d{1,2}):(\d{2})/);
    if (match24) {
        return parseInt(match24[1]) * 60 + parseInt(match24[2]);
    }
    return 0;
}

function parseClassTime(classTimeStr) {
    if (!classTimeStr) return [];
    const match = classTimeStr.match(/^(.+?)\s+(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*-\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)$/i);
    if (!match) return [];
    const days = parseDays(match[1]);
    const startMin = parseTimeToMinutes(match[2]);
    const endMin = parseTimeToMinutes(match[3]);
    return days.map(day => ({ day, start: startMin, end: endMin }));
}

function formatTimeShort(minutes) {
    const h = Math.floor(minutes / 60);
    const period = h >= 12 ? 'PM' : 'AM';
    const displayH = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayH} ${period}`;
}

function encodeForSearch(text) {
    if (!text) return text;
    return text.replace(/'/g, '&#39;');
}

const ALL_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

// Office hours and office locations are Find My Prof's work; credited below.
const FIND_MY_PROF_URL = 'https://uos-findmyprof.vercel.app';
const TIME_SLOTS = [];
for (let h = 8; h <= 20; h++) {
    TIME_SLOTS.push(h * 60);
}

/**
 * Instructor timetable lookup.
 *
 * Rendered both as the /instructors route and as the "Find instructor" mode of
 * the Schedule page — it answers the same question the builder does (when does
 * this happen), so it sits beside it as a peer rather than in a settings menu.
 */
export default function InstructorFinder() {
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedInstructor, setSelectedInstructor] = useState(null);
    const [instructorSections, setInstructorSections] = useState([]);
    const [courseData, setCourseData] = useState({});
    const [loading, setLoading] = useState(false);
    // The selected instructor's Find My Prof entry ({ name, office, hours }),
    // or null when Find My Prof does not list them.
    const [officeHours, setOfficeHours] = useState(null);

    const router = useRouter();
    const supabase = createClient();
    const { selectedTerm, semesters } = useSemester();
    const currentSemesterName = semesters?.find(s => s.term_code === selectedTerm)?.name || selectedTerm;
    const searchRef = useRef(null);
    const searchTimeout = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Clear search and results when semester changes
    useEffect(() => {
        setSearchQuery('');
        setSuggestions([]);
        setSelectedInstructor(null);
        setInstructorSections([]);
        setOfficeHours(null);
    }, [selectedTerm]);

    // Handle search input changes
    const handleSearchChange = (e) => {
        const query = e.target.value;
        setSearchQuery(query);

        if (searchTimeout.current) clearTimeout(searchTimeout.current);

        if (!query.trim() || !selectedTerm) {
            setSuggestions([]);
            setShowDropdown(false);
            return;
        }

        const encodedQuery = encodeForSearch(query);

        searchTimeout.current = setTimeout(async () => {
            const { data } = await supabase
                .from('sections')
                .select('instructor')
                .eq('term_code', selectedTerm)
                .eq('is_active', true)
                .ilike('instructor', `%${encodedQuery}%`)
                .not('instructor', 'is', null)
                .limit(300);

            if (data) {
                const unique = [...new Set(data.map(d => d.instructor))].slice(0, 10);
                setSuggestions(unique);
                setShowDropdown(true);
            }
        }, 300);
    };

    const handleSelectInstructor = async (name) => {
        setSearchQuery(decodeHtmlEntities(name));
        setShowDropdown(false);
        setSelectedInstructor(name);
        setOfficeHours(null);
        setLoading(true);

        // Fetch sections
        const { data: sections } = await supabase
            .from('sections')
            .select('*')
            .eq('term_code', selectedTerm)
            .eq('is_active', true)
            .eq('instructor', name);

        if (!sections || sections.length === 0) {
            setInstructorSections([]);
            setLoading(false);
            return;
        }

        // Fetch course details, and the instructor's office hours when Find My
        // Prof has them (joined by the email Banner lists for their sections).
        const courseIds = [...new Set(sections.map(s => s.course_id))];
        const email = sections.find(s => s.instructor_email)?.instructor_email || null;
        const [{ data: courses }, hoursByEmail] = await Promise.all([
            supabase
                .from('courses')
                .select('course_id, course_name')
                .in('course_id', courseIds),
            fetchOfficeHours(supabase, email ? [email] : []),
        ]);
        setOfficeHours((email && hoursByEmail[email]) || null);

        const courseMap = {};
        if (courses) {
            courses.forEach(c => {
                courseMap[c.course_id] = c.course_name;
            });
        }

        setCourseData(courseMap);
        setInstructorSections(sections);
        setLoading(false);
    };

    // Render timetable blocks
    const renderTimetable = () => {
        if (!instructorSections.length) return null;

        const blocks = [];
        const courseColors = {};
        const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
        let colorIdx = 0;

        instructorSections.forEach(sec => {
            // Assign a color per course
            if (!courseColors[sec.course_id]) {
                courseColors[sec.course_id] = colors[colorIdx % colors.length];
                colorIdx++;
            }

            const slots = parseClassTime(sec.class_time);
            slots.forEach(slot => {
                blocks.push({
                    ...slot,
                    courseId: sec.course_id,
                    courseName: courseData[sec.course_id] || '',
                    sectionNum: sec.section_num,
                    color: courseColors[sec.course_id]
                });
            });
        });

        const days = ['Mon', 'Tue', 'Wed', 'Thu'];
        if (blocks.length > 0 && !blocks.some(b => days.includes(b.day))) {
            return <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No scheduled times found for these sections on Mon-Thu.</div>;
        }

        // Office hours, in the time the instructor is not teaching.
        const officeBlocks = [];
        (officeHours?.hours || []).forEach(h => h.days.forEach(d => {
            const day = OFFICE_HOUR_DAYS[d];
            if (!days.includes(day)) return;
            officeBlocks.push({
                day,
                start: h.start,
                end: h.end,
                location: h.location,
                title: `Office hours ${formatClock(h.start)}-${formatClock(h.end)}${h.location ? `, ${h.location}` : ''}`,
            });
        }));
        const officeSegments = layoutOfficeHours(blocks, officeBlocks);
        const timed = [...blocks, ...officeSegments];

        const minTime = timed.length > 0 ? Math.min(...timed.map(b => b.start)) : 8 * 60;
        const maxTime = timed.length > 0 ? Math.max(...timed.map(b => b.end)) : 17 * 60;
        const startHour = Math.min(8, Math.floor(minTime / 60));
        const endHour = Math.max(17, Math.ceil(maxTime / 60));
        const totalMinutes = (endHour - startHour) * 60;

        const HEADER_HEIGHT = 28;
        const PX_PER_MIN = 0.8;
        const Y_OFFSET = 12; // Prevents top and bottom time labels from being clipped
        const gridHeight = totalMinutes * PX_PER_MIN + (Y_OFFSET * 2);

        const hours = [];
        for (let h = startHour; h <= endHour; h++) hours.push(h);

        return (
            <div className={styles.timetableWrapper}>
                <div className={styles.timetableHeader} style={{ gridTemplateColumns: `45px repeat(${days.length}, 1fr)` }}>
                    <div style={{ width: '45px' }}></div>
                    {days.map(d => (
                        <div key={d} className={styles.dayLabel}>{d}</div>
                    ))}
                </div>
                <div className={styles.timetableBody} style={{ height: `${gridHeight}px` }}>
                    <div className={styles.gridLines}>
                        {hours.map(h => (
                            <div key={h} className={styles.gridLine} style={{ top: `${(h - startHour) * 60 * PX_PER_MIN + Y_OFFSET}px` }} />
                        ))}
                    </div>
                    <div className={styles.timeLabels}>
                        {hours.map(h => (
                            <div key={h} className={styles.timeLabel} style={{ top: `${(h - startHour) * 60 * PX_PER_MIN + Y_OFFSET}px` }}>
                                {formatTimeShort(h * 60)}
                            </div>
                        ))}
                    </div>

                    <div style={{ position: 'absolute', left: '45px', right: 0, top: 0, bottom: 0, display: 'flex' }}>
                        {days.map((day, dIdx) => {
                            const dayBlocks = blocks.filter(b => b.day === day);
                            return (
                                <div key={day} style={{ position: 'relative', flex: 1, borderLeft: dIdx > 0 ? '1px solid var(--border-color)' : 'none' }}>
                                    {officeSegments.filter(b => b.day === day).map((block, i) => {
                                        const top = (block.start - startHour * 60) * PX_PER_MIN + Y_OFFSET;
                                        const height = (block.end - block.start) * PX_PER_MIN;
                                        const width = 100 / block.lanes;
                                        return (
                                            <div
                                                key={`oh-${i}`}
                                                className={styles.officeBlock}
                                                title={block.title}
                                                style={{
                                                    top: `${top}px`,
                                                    height: `${height}px`,
                                                    left: `calc(${block.lane * width}% + 2px)`,
                                                    width: `calc(${width}% - 4px)`,
                                                }}
                                            >
                                                {height >= 16 && <div style={{ WebkitLineClamp: height >= 32 ? 2 : 1 }}>Office hours</div>}
                                            </div>
                                        );
                                    })}
                                    {dayBlocks.map((block, i) => {
                                        const top = (block.start - startHour * 60) * PX_PER_MIN + Y_OFFSET;
                                        const height = (block.end - block.start) * PX_PER_MIN;

                                        // Hex to rgba helper
                                        const hex = block.color.replace('#', '');
                                        const r = parseInt(hex.substring(0, 2), 16);
                                        const g = parseInt(hex.substring(2, 4), 16);
                                        const b = parseInt(hex.substring(4, 6), 16);
                                        const bgRgba = `rgba(${r},${g},${b},0.15)`;

                                        // Course id and section take about 38px with padding;
                                        // the name gets only the whole lines left, so no line
                                        // is sliced through at the bottom.
                                        const nameLines = Math.floor((height - 38) / 11.5);

                                        return (
                                            <div
                                                key={i}
                                                className={styles.classBlock}
                                                title={`${block.courseId}${block.courseName ? ` ${block.courseName}` : ''}, section ${block.sectionNum}`}
                                                style={{
                                                    top: `${top}px`,
                                                    height: `${height}px`,
                                                    backgroundColor: bgRgba,
                                                    borderColor: block.color,
                                                    color: block.color
                                                }}
                                            >
                                                <div className={styles.blockCourseId}>{block.courseId}</div>
                                                {block.courseName && nameLines > 0 && (
                                                    <div className={styles.blockCourseName} style={{ WebkitLineClamp: nameLines }}>{block.courseName}</div>
                                                )}
                                                {height >= 30 && <div className={styles.blockSection}>Sec {block.sectionNum}</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    // Find My Prof sometimes holds a placeholder like "M5-XXX" instead of a room.
    // It files offices under M5/W5, the same buildings students know as A9/C9
    // (and that its own office-hour rooms use), so the room is shown that way.
    const officeLocation = officeHours?.office && !/x{2,}/i.test(officeHours.office)
        ? officeHours.office.replace(/^(M5|W5)-/, (_, building) => (building === 'M5' ? 'A9-' : 'C9-'))
        : null;
    const hasOfficeHours = (officeHours?.hours?.length || 0) > 0;

    return (
                <div className={styles.main}>
                    <div className={styles.card}>
                        <div className={styles.section} ref={searchRef}>
                            <span className={styles.sectionTitle}>Find Instructor ({currentSemesterName || 'Loading...'})</span>
                            <div className={styles.searchWrapper}>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="Type an instructor's name..."
                                    value={searchQuery}
                                    onChange={handleSearchChange}
                                    onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
                                />
                                {showDropdown && suggestions.length > 0 && (
                                    <div className={styles.dropdown}>
                                        {suggestions.map((name, i) => (
                                            <button
                                                key={i}
                                                className={styles.dropdownItem}
                                                onClick={() => handleSelectInstructor(name)}
                                            >
                                                {decodeHtmlEntities(name)}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {loading && <div className={styles.spinner}></div>}

                        {!loading && selectedInstructor && instructorSections.length > 0 && (
                            <div style={{ marginTop: '24px' }}>
                                <div className={styles.resultsHeader}>
                                    <div>
                                        <div className={styles.instructorName}>{decodeHtmlEntities(selectedInstructor)}</div>
                                        {officeLocation && <div className={styles.instructorOffice}>{officeLocation}</div>}
                                    </div>
                                </div>

                                {officeHours && (
                                    <p className={styles.attribution}>
                                        Office hours and office locations come from Find My Prof. You can find them at{' '}
                                        <a href={FIND_MY_PROF_URL} target="_blank" rel="noopener noreferrer">uos-findmyprof.vercel.app</a>.
                                    </p>
                                )}

                                <p className={styles.disclaimer}>
                                    {hasOfficeHours
                                        ? <>Note: this timetable shows class times and office hours only. Meetings and other activities aren&rsquo;t shown.</>
                                        : <>Note: this timetable shows only the instructor&rsquo;s class times. No office hours are posted for them, and meetings and other activities aren&rsquo;t shown.</>}
                                </p>

                                {renderTimetable()}

                                <div className={styles.blockList}>
                                    {instructorSections.map(sec => (
                                        <div key={sec.crn} className={styles.listItem}>
                                            <div style={{ display: 'flex', alignItems: 'baseline' }}>
                                                <span className={styles.listCourseId}>{sec.course_id}</span>
                                                <span className={styles.listCourseName}>{courseData[sec.course_id] || 'Loading...'}</span>
                                            </div>
                                            <div className={styles.listSection}>
                                                Section {sec.section_num} • {sec.class_time} • CRN: {sec.crn}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!loading && selectedInstructor && instructorSections.length === 0 && (
                            <div style={{ marginTop: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No sections found for {decodeHtmlEntities(selectedInstructor)} in this semester.
                            </div>
                        )}
                    </div>
                </div>
    );
}
