/**
 * Office hours from Find My Prof (uos-findmyprof.vercel.app). fetch-office-hours.js
 * stores them in the faculty and faculty_office_hours tables, and they join to
 * sections through sections.instructor_email. Shared by the schedule builder
 * and the instructor finder so both read and draw them the same way.
 */

// Find My Prof numbers days 1 = Monday ... 7 = Sunday. Days the timetables have
// no column for (Fri, Sat) are dropped.
export const OFFICE_HOUR_DAYS = { 0: 'Sun', 7: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu' };

// "09:30:00" (a Postgres time) to minutes after midnight.
export function timeToMinutes(t) {
    const [h, m] = String(t).split(':').map(Number);
    return h * 60 + (m || 0);
}

// 24-hour, to match class_time strings like "Tue/Thu 12:30-13:45".
export function formatClock(minutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

// "Mon/Wed 11:00-12:40 (A9-219); Tue 09:30-11:00 (A9-219)"
export function describeOfficeHours(entry) {
    return entry.hours
        .map(h => {
            const days = h.days.map(d => OFFICE_HOUR_DAYS[d]).filter(Boolean).join('/');
            if (!days) return null;
            return `${days} ${formatClock(h.start)}-${formatClock(h.end)}${h.location ? ` (${h.location})` : ''}`;
        })
        .filter(Boolean)
        .join('; ');
}

/**
 * email -> { name, office, hours: [{ days, start, end, location }] } for the
 * given instructor emails. Only instructors Find My Prof lists with weekly
 * hours still running appear; entries past their end date are last semester's.
 */
export async function fetchOfficeHours(supabase, emails) {
    const list = [...new Set((emails || []).filter(Boolean))];
    if (list.length === 0) return {};

    const [{ data: people }, { data: hours }] = await Promise.all([
        supabase.from('faculty').select('email, name, office').eq('listed', true).in('email', list),
        supabase.from('faculty_office_hours').select('email, days, start_time, end_time, location, end_date').in('email', list),
    ]);
    if (!people || !hours) return {};

    const today = new Date().toISOString().slice(0, 10);
    const map = {};
    for (const p of people) map[p.email] = { name: p.name, office: p.office, hours: [] };
    for (const h of hours) {
        if (!map[h.email] || (h.end_date && h.end_date < today)) continue;
        map[h.email].hours.push({
            days: h.days,
            start: timeToMinutes(h.start_time),
            end: timeToMinutes(h.end_time),
            location: h.location,
        });
    }
    for (const email of Object.keys(map)) {
        if (map[email].hours.length === 0) delete map[email];
        else map[email].hours.sort((a, b) => (a.days[0] - b.days[0]) || (a.start - b.start));
    }
    return map;
}

/**
 * Where to draw office hours on a day grid. Blocks are { day, start, end, ... }
 * in minutes; other fields are carried through.
 *
 * Each office-hour slot keeps only the time no class occupies (a student in
 * class cannot go), pieces under 20 minutes are dropped rather than drawn as
 * empty slivers, and pieces that overlap each other sit side by side: `lane` is
 * a piece's column and `lanes` how many columns its overlapping group needs.
 */
export function layoutOfficeHours(classBlocks, officeBlocks) {
    const MIN_MINUTES = 20;
    const segments = [];
    const byDay = {};
    officeBlocks.forEach(b => { (byDay[b.day] = byDay[b.day] || []).push(b); });

    Object.entries(byDay).forEach(([day, list]) => {
        const classes = classBlocks.filter(b => b.day === day).sort((a, b) => a.start - b.start);
        const pieces = [];
        list.forEach(b => {
            let cursor = b.start;
            for (const c of classes) {
                if (c.end <= cursor || c.start >= b.end) continue;
                if (c.start - cursor >= MIN_MINUTES) pieces.push({ ...b, start: cursor, end: c.start });
                cursor = Math.max(cursor, c.end);
            }
            if (b.end - cursor >= MIN_MINUTES) pieces.push({ ...b, start: cursor, end: b.end });
        });

        pieces.sort((a, b) => (a.start - b.start) || (a.end - b.end));
        let group = [];
        let groupEnd = -1;
        const flush = () => {
            const laneEnds = [];
            group.forEach(p => {
                let lane = laneEnds.findIndex(end => end <= p.start);
                if (lane === -1) { lane = laneEnds.length; laneEnds.push(p.end); } else laneEnds[lane] = p.end;
                p.lane = lane;
            });
            group.forEach(p => { p.lanes = laneEnds.length; segments.push(p); });
            group = [];
            groupEnd = -1;
        };
        pieces.forEach(p => {
            if (group.length && p.start >= groupEnd) flush();
            group.push(p);
            groupEnd = Math.max(groupEnd, p.end);
        });
        if (group.length) flush();
    });

    return segments;
}
