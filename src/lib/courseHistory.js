// Past terms of a course, for the Schedule page's History tab and its shortcuts.
//
// Rows come from the course_history_sections view: archived terms from
// section_history, plus terms still only held in `sections`.

import { decodeHtmlEntities } from '@/lib/text';

const SEASONS = { '10': 'Fall', '20': 'Spring', '30': 'Summer' };

// A term code's year is the academic year's first, so Spring and Summer land
// in the next calendar year: 202510 is Fall 2025, 202520 Spring 2026 and
// 202530 Summer 2026. (semesters.name has had these wrong, so labels are
// worked out here rather than read from it.)
function calendarYear(code) {
    const year = Number(String(code).slice(0, 4));
    return String(code).slice(4) === '10' ? year : year + 1;
}

export function termLabel(code) {
    if (!code) return '';
    return `${SEASONS[String(code).slice(4)] || 'Term'} ${calendarYear(code)}`;
}

// Which past terms to show, newest first, for the term a student is planning.
//   Fall:   last academic year's Fall, Spring and Summer.
//   Spring: the same, plus this year's Fall.
//   Summer: last Summer, plus this year's Fall and Spring.
export function historyTerms(currentCode) {
    if (!currentCode) return [];
    const year = Number(String(currentCode).slice(0, 4));
    const season = String(currentCode).slice(4);
    const code = (y, s) => `${y}${s}`;
    if (season === '10') return [code(year - 1, '30'), code(year - 1, '20'), code(year - 1, '10')];
    if (season === '20') return [code(year, '10'), code(year - 1, '30'), code(year - 1, '20'), code(year - 1, '10')];
    if (season === '30') return [code(year, '20'), code(year, '10'), code(year - 1, '30')];
    return [];
}

const DAY_ORDER = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

// "Mon/Wed 08:00-09:15, Tue 10:00-11:40" into its meetings.
export function parseMeetings(classTime) {
    if (!classTime) return [];
    return classTime.split(',').map(part => {
        const m = part.trim().match(/^(.+?)\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
        if (!m) return null;
        const days = m[1].split(/[\s/]+/).filter(d => DAY_ORDER.includes(d));
        return {
            days,
            start: Number(m[2]) * 60 + Number(m[3]),
            end: Number(m[4]) * 60 + Number(m[5]),
        };
    }).filter(Boolean);
}

export function formatClock(minutes) {
    return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

// "Mon/Wed 8:00 to 9:15", one line per meeting.
export function meetingText(classTime) {
    const meetings = parseMeetings(classTime);
    if (meetings.length === 0) return 'No set time';
    return meetings.map(m => `${m.days.join('/')} ${formatClock(m.start)} to ${formatClock(m.end)}`).join(', ');
}

export const CAMPUS_LABELS = { main: 'Main', men: 'Men', women: 'Women' };

// Share of seats taken, over sections that report both numbers. Banner lets
// sections over-enrol, so this can pass 100 and is capped for display.
function fillPercent(sections) {
    let taken = 0, seats = 0;
    for (const s of sections) {
        if (s.enrollment == null || !s.max_enrollment) continue;
        taken += s.enrollment;
        seats += s.max_enrollment;
    }
    return seats > 0 ? Math.min(100, Math.round((taken / seats) * 100)) : null;
}

// Most common start slots, e.g. ["Mon/Wed 8:00", "Tue/Thu 11:00"].
function usualTimes(sections, limit) {
    const counts = new Map();
    for (const s of sections) {
        const first = parseMeetings(s.class_time)[0];
        if (!first) continue;
        const key = `${first.days.join('/')} ${formatClock(first.start)}`;
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k]) => k);
}

function campusesOf(sections) {
    return [...new Set(sections.map(s => s.campus).filter(Boolean))];
}

// One term's rows into what the History screens show about it.
function summarizeTerm(code, sections) {
    const instructors = [...new Set(sections.map(s => s.instructor).filter(Boolean))];
    const meetings = sections.flatMap(s => parseMeetings(s.class_time));
    const dayPatterns = [...new Set(sections.map(s => parseMeetings(s.class_time)[0]?.days.join('/')).filter(Boolean))];
    return {
        code,
        label: termLabel(code),
        offered: sections.length > 0,
        sections,
        instructors,
        dayPatterns,
        earliest: meetings.length ? Math.min(...meetings.map(m => m.start)) : null,
        latest: meetings.length ? Math.max(...meetings.map(m => m.end)) : null,
        fill: fillPercent(sections),
        campuses: campusesOf(sections),
        usualTimes: usualTimes(sections, 3),
    };
}

// Sections for one course across `terms`, summarised per term (newest first)
// and overall.
export async function fetchCourseHistory(supabase, courseId, terms) {
    const { data, error } = await supabase
        .from('course_history_sections')
        .select('term_code, crn, course_id, section_num, class_time, instructor, location, campus, max_enrollment, enrollment')
        .eq('course_id', courseId)
        .in('term_code', terms)
        .order('section_num');
    if (error) throw error;

    const rows = (data || []).map(r => ({ ...r, instructor: decodeHtmlEntities(r.instructor) }));
    const perTerm = terms.map(code => summarizeTerm(code, rows.filter(r => r.term_code === code)));
    const offered = perTerm.filter(t => t.offered);

    // Who taught it, busiest first, with their terms oldest first.
    const byInstructor = new Map();
    for (const t of offered.slice().reverse()) {
        for (const s of t.sections) {
            if (!s.instructor) continue;
            const entry = byInstructor.get(s.instructor) || { name: s.instructor, terms: [], sections: 0 };
            if (!entry.terms.includes(t.label)) entry.terms.push(t.label);
            entry.sections += 1;
            byInstructor.set(s.instructor, entry);
        }
    }

    return {
        terms: perTerm,
        offeredCount: offered.length,
        sectionsPerTerm: offered.length ? Math.round(rows.length / offered.length) : 0,
        instructors: [...byInstructor.values()].sort((a, b) => b.sections - a.sections),
        usualTimes: usualTimes(rows, 3),
    };
}

// course_id -> [{ term, sections }] newest first, for the picker's "Last ran" hint.
export async function fetchHistoryCounts(supabase, courseIds, terms) {
    if (!courseIds.length || !terms.length) return {};
    const { data, error } = await supabase.rpc('course_history_counts', { p_course_ids: courseIds, p_terms: terms });
    if (error) throw error;
    const out = {};
    for (const row of data || []) (out[row.course_id] ||= []).push({ term: row.term_code, sections: row.sections });
    for (const list of Object.values(out)) list.sort((a, b) => terms.indexOf(a.term) - terms.indexOf(b.term));
    return out;
}

// Mon to Thu always, plus any other day a section met; one row per start time
// sections actually used (8:00, 9:30, 11:00). Each cell counts the sections
// starting then.
export function startGrid(sections) {
    const meetings = sections.flatMap(s => parseMeetings(s.class_time));
    const used = new Set(meetings.flatMap(m => m.days));
    const days = DAY_ORDER.filter(d => ['Mon', 'Tue', 'Wed', 'Thu'].includes(d) || used.has(d));
    const starts = [...new Set(meetings.map(m => m.start))].sort((a, b) => a - b);
    const cells = starts.map(start => days.map(d => meetings.filter(m => m.start === start && m.days.includes(d)).length));
    return { days, starts, cells };
}
