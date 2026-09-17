/**
 * A schedule as a calendar file (.ics) the student can import into Outlook,
 * Google Calendar or Apple Calendar.
 *
 * One event per section, repeating weekly from the first day of classes to the
 * last, with the term's holidays excluded. Those dates come from the semesters
 * table (classes_start, classes_end, no_class_dates), typed in from the UOS
 * academic calendar, since Banner does not carry them.
 */
import { decodeHtmlEntities } from '@/lib/text';

// UOS runs on Gulf Standard Time all year, with no daylight saving.
const TZID = 'Asia/Dubai';
const VTIMEZONE = [
    'BEGIN:VTIMEZONE',
    `TZID:${TZID}`,
    'BEGIN:STANDARD',
    'DTSTART:19700101T000000',
    'TZOFFSETFROM:+0400',
    'TZOFFSETTO:+0400',
    'TZNAME:+04',
    'END:STANDARD',
    'END:VTIMEZONE',
];

// Sun is 0 to match Date.getDay(); ICS wants the two-letter codes.
const ICS_DAYS = { Sun: 'SU', Mon: 'MO', Tue: 'TU', Wed: 'WE', Thu: 'TH', Fri: 'FR', Sat: 'SA' };
const DAY_NUMBERS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function pad(n) {
    return String(n).padStart(2, '0');
}

// "2026-08-24" to a local Date, avoiding the UTC parsing of the string form.
function parseDate(text) {
    const [y, m, d] = String(text).split('-').map(Number);
    return new Date(y, m - 1, d);
}

function stampLocal(date, minutes) {
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(Math.floor(minutes / 60))}${pad(minutes % 60)}00`;
}

// UTC stamp, which is what RRULE's UNTIL takes. +04:00 all year, so 4 hours off.
function stampUtc(date, minutes) {
    const utc = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, minutes - 4 * 60);
    return `${utc.getUTCFullYear()}${pad(utc.getUTCMonth() + 1)}${pad(utc.getUTCDate())}T${pad(utc.getUTCHours())}${pad(utc.getUTCMinutes())}00Z`;
}

// Commas, semicolons, backslashes and newlines carry meaning in ICS text.
function escapeText(text) {
    return String(text || '')
        .replace(/\\/g, '\\\\')
        .replace(/;/g, '\\;')
        .replace(/,/g, '\\,')
        .replace(/\r?\n/g, '\\n');
}

// ICS lines are at most 75 octets; the rest continues after a space.
function foldLine(line) {
    const out = [];
    let rest = line;
    while (new TextEncoder().encode(rest).length > 75) {
        let cut = 74;
        while (new TextEncoder().encode(rest.slice(0, cut)).length > 74) cut -= 1;
        out.push(rest.slice(0, cut));
        rest = ` ${rest.slice(cut)}`;
    }
    out.push(rest);
    return out;
}

// The first day on or after `from` that falls on one of `days` (Sun = 0).
function firstOccurrence(from, days) {
    const date = new Date(from);
    for (let i = 0; i < 7; i++) {
        if (days.includes(date.getDay())) return date;
        date.setDate(date.getDate() + 1);
    }
    return null;
}

/**
 * Groups a schedule's blocks back into one entry per section: the same class on
 * Monday and Wednesday is one repeating event, not two.
 */
function groupBySection(blocks) {
    const groups = new Map();
    blocks.forEach(block => {
        const key = [block.crn || '', block.courseId, block.sectionNum || '', block.start, block.end].join('|');
        if (!groups.has(key)) groups.set(key, { ...block, days: [] });
        groups.get(key).days.push(block.day);
    });
    return [...groups.values()];
}

/**
 * Builds the file's text.
 *
 * blocks: [{ day, start, end, courseId, courseName, sectionNum, crn, instructor, location }]
 *         with start and end in minutes after midnight.
 * term:   { name, classesStart, classesEnd, noClassDates: ['2026-12-01', ...] }
 */
export function buildScheduleIcs({ blocks, term }) {
    const start = parseDate(term.classesStart);
    const end = parseDate(term.classesEnd);
    const holidays = (term.noClassDates || []).map(parseDate);
    const stamp = stampUtc(new Date(), new Date().getHours() * 60 + new Date().getMinutes());

    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//CourseMate//Schedule//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        `X-WR-CALNAME:${escapeText(term.name ? `Classes ${term.name}` : 'Classes')}`,
        `X-WR-TIMEZONE:${TZID}`,
        ...VTIMEZONE,
    ];

    groupBySection(blocks).forEach((entry, index) => {
        const dayNumbers = entry.days.map(d => DAY_NUMBERS[d]).filter(n => n !== undefined);
        const byDay = entry.days.map(d => ICS_DAYS[d]).filter(Boolean);
        if (!byDay.length) return;

        const first = firstOccurrence(start, dayNumbers);
        if (!first || first > end) return;

        // A holiday only matters when it lands on one of this class's days.
        const skipped = holidays
            .filter(h => h >= first && h <= end && dayNumbers.includes(h.getDay()))
            .map(h => stampLocal(h, entry.start));

        const description = [
            entry.sectionNum && `Section ${entry.sectionNum}`,
            entry.crn && `CRN ${entry.crn}`,
            entry.instructor && decodeHtmlEntities(entry.instructor),
            '',
            'Class times can change during Ramadan. Check Banner.',
            'Made with CourseMate.',
        ].filter(l => l !== undefined && l !== null && l !== false).join('\n');

        lines.push(
            'BEGIN:VEVENT',
            `UID:${entry.crn || `${entry.courseId}-${entry.sectionNum}`}-${index}@coursemate`,
            `DTSTAMP:${stamp}`,
            `DTSTART;TZID=${TZID}:${stampLocal(first, entry.start)}`,
            `DTEND;TZID=${TZID}:${stampLocal(first, entry.end)}`,
            `RRULE:FREQ=WEEKLY;BYDAY=${byDay.join(',')};UNTIL=${stampUtc(end, 23 * 60 + 59)}`,
            ...(skipped.length ? [`EXDATE;TZID=${TZID}:${skipped.join(',')}`] : []),
            `SUMMARY:${escapeText(entry.courseName ? `${entry.courseId} ${entry.courseName}` : entry.courseId)}`,
            ...(entry.location ? [`LOCATION:${escapeText(entry.location)}`] : []),
            `DESCRIPTION:${escapeText(description)}`,
            'END:VEVENT',
        );
    });

    lines.push('END:VCALENDAR');
    return lines.flatMap(foldLine).join('\r\n');
}

/**
 * Builds the file and saves it. Returns false when the term has no teaching
 * dates yet, which is the one thing the caller cannot work out on its own.
 */
export function downloadScheduleIcs({ blocks, term, fileName }) {
    if (!blocks.length || !term?.classesStart || !term?.classesEnd) return false;
    const text = buildScheduleIcs({ blocks, term });
    const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true;
}
