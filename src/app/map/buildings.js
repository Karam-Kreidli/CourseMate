/**
 * What each building on the campus map is, from the legend of the
 * university's 2025/2026 campus map. The shapes themselves come from
 * campus.json (see scripts/extract_campus_map.py); this file is the part a
 * person edits.
 *
 * Heights are invented: the map is flat. They are in map units, where one
 * unit is roughly six metres on the ground, so 3 is a four-storey block.
 */

const CLASSROOMS = { name: 'Classrooms', kind: 'classrooms' };

export const BUILDINGS = {
    A1: { name: 'Ibn Rushd Building', colleges: ['College of Sharia and Islamic Studies'], kind: 'college' },
    A2: { name: 'Ibn Khaldun Building', colleges: ['College of Arts, Humanities and Social Sciences', 'College of Law'], kind: 'college' },
    A3: { name: 'Ibn Al-Haytham Building', colleges: ['College of Graduate Studies'], kind: 'college' },
    A4: { name: 'Dining Hall', kind: 'dining' },
    A5: { name: 'Students Center', kind: 'center' },
    A6: { name: 'Students Forum', kind: 'forum' },
    A7: { name: 'Library', kind: 'library' },
    A8: CLASSROOMS,
    A9: { name: 'Business and Computing', colleges: ['College of Business Administration', 'College of Computing and Informatics'], kind: 'college' },
    A10: CLASSROOMS,
    A11: { name: 'College of Sciences', colleges: ['College of Sciences'], kind: 'college' },
    A12: CLASSROOMS,
    A13: { name: 'College of Engineering', colleges: ['College of Engineering'], kind: 'college' },
    A14: CLASSROOMS,
    A15: { name: 'Mosque', kind: 'mosque' },
    A16: { name: 'Sports Complex', kind: 'sports' },
    A17: { name: 'Innovation Hub', kind: 'center' },
    A19: { name: 'University of Sharjah Stadium', kind: 'stadium' },
    A20: CLASSROOMS,

    B1: { name: 'University of Sharjah', note: 'Administration', kind: 'admin' },
    B2: { name: 'Office of the Registrar', kind: 'admin' },
    B3: { name: 'Central Laboratories', kind: 'labs' },
    B4: { name: 'Central Laboratories', kind: 'labs' },

    C1: { name: 'Sharia and Law', colleges: ['College of Sharia and Islamic Studies', 'College of Law'], kind: 'college' },
    C2: { name: 'Arts and Public Policy', colleges: ['College of Arts, Humanities and Social Sciences', 'College of Public Policy'], kind: 'college' },
    C3: { name: 'Arts, Humanities and Social Sciences', colleges: ['College of Arts, Humanities and Social Sciences'], kind: 'college' },
    C4: { name: 'Dining Hall', kind: 'dining' },
    C5: { name: 'Students Center', kind: 'center' },
    C6: { name: 'Students Forum', kind: 'forum' },
    C7: { name: 'Library', kind: 'library' },
    C8: CLASSROOMS,
    C9: { name: 'College of Computing and Informatics', colleges: ['College of Computing and Informatics'], kind: 'college' },
    C10: { name: 'College of Business Administration', colleges: ['College of Business Administration'], kind: 'college' },
    C11: { name: 'College of Communication', colleges: ['College of Communication'], kind: 'college' },
    C12: CLASSROOMS,
    C13: { name: 'College of Engineering', colleges: ['College of Engineering'], kind: 'college' },
    C14: CLASSROOMS,
    C15: { name: 'Sports Complex', kind: 'sports' },
    C16: CLASSROOMS,

    E1: { name: 'College of Pharmacy and Health Sciences', colleges: ['College of Pharmacy and Health Sciences'], kind: 'college' },
    E2: { name: 'Al Razi Auditorium', kind: 'center' },
    E3: { name: 'Medical and Health Sciences Colleges', note: 'Administration', kind: 'admin' },
    E4: { name: 'Library', kind: 'library' },
    E5: { name: 'College of Medicine', colleges: ['College of Medicine'], kind: 'college' },
    E6: { name: 'Research Institute for Medical and Health Sciences', kind: 'labs' },
    E7: { name: 'Clinical Surgical Training Center', note: 'Also the Diabetes Center', kind: 'labs' },
    E8: { name: 'Dining Hall', kind: 'dining' },
    E9: { name: 'College of Dental Medicine', colleges: ['College of Dental Medicine'], kind: 'college' },
    // Unnamed in the 2025/2026 legend; the 2019/2020 map calls it the mosque (M30).
    E10: { name: 'Mosque', kind: 'mosque' },
    E11: { name: 'University Dental Hospital Sharjah', kind: 'hospital' },
    HOSPITAL: { name: 'University Hospital Sharjah', kind: 'hospital' },

    F1: { name: 'Medical Student Dormitories (Women)', kind: 'dorm' },
    F2: { name: 'Medical Student Dormitories (Women)', kind: 'dorm' },
    F3: { name: 'Medical Student Dormitories (Women)', kind: 'dorm' },

    G6: { name: 'Students Dormitories Administration (Men)', kind: 'admin' },
    H10: { name: 'Students Dormitories Administration (Women)', kind: 'admin' },
};

for (const n of [1, 2, 3, 4, 5]) BUILDINGS[`G${n}`] = { name: "Men's Dormitory Compound", kind: 'dorm' };
for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) BUILDINGS[`H${n}`] = { name: "Women's Dormitory Compound", kind: 'dorm' };

export const ZONES = {
    A: { name: "Men's campus", short: 'Men' },
    // Administration (B1, B2) and the central labs (B3, B4), between the two sides.
    B: { name: 'Central buildings', short: 'Central' },
    C: { name: "Women's campus", short: 'Women' },
    D: { name: 'Zone D', short: 'D' },
    E: { name: 'Medical campus', short: 'Medical' },
    F: { name: 'Medical student housing', short: 'Housing' },
    G: { name: "Men's housing", short: 'Housing' },
    H: { name: "Women's housing", short: 'Housing' },
};

const HEIGHTS = {
    college: 3,
    classrooms: 2.6,
    library: 3.4,
    admin: 3.2,
    labs: 2.8,
    dining: 2,
    center: 2.2,
    forum: 1.8,
    sports: 2.4,
    stadium: 1.1,
    mosque: 2,
    dorm: 3,
    hospital: 4.4,
};
export const HOUSING_HEIGHT = 1.3;
export const UNNAMED_HEIGHT = 2.2;

/** Everything the map shows about one building, whether or not the legend names it. */
export function buildingInfo(id) {
    const known = BUILDINGS[id];
    const zone = id === 'HOSPITAL' ? 'E' : id[0];
    const kind = known?.kind || 'other';
    return {
        id,
        code: id === 'HOSPITAL' ? null : id,
        name: known?.name || null,
        note: known?.note || null,
        colleges: known?.colleges || [],
        kind,
        zone,
        zoneName: ZONES[zone]?.name || null,
        // Null for a building the legend doesn't name; the scene sizes those.
        height: HEIGHTS[kind] ?? null,
        // Whether Banner rooms can be in it: the colleges, classrooms and labs
        // of the A, B and C buildings. Mosques, libraries, dining halls and
        // the like never hold timetabled classes, so they don't say "none".
        teaching: /^[ABC]\d/.test(id) && ['college', 'classrooms', 'labs'].includes(kind),
    };
}

/**
 * Codes from the 2019/2020 campus map, which some people still use: M for the
 * men's side and the medical campus, W for the women's side. Search takes
 * them to today's building; the map itself never shows them.
 *
 * Mostly from the red labels on "UoS Map (with New CodesNames).pdf". The ones
 * marked "by position" weren't labelled there, and are the building standing
 * in the same place on the 2025/2026 map.
 */
export const OLD_CODES = {
    // South campus and community
    M1: 'A1', M1A: 'A1', M2: 'A2', M3: 'A3', M3A: 'A3',
    M20: 'A4', M20A: 'A6', M21: 'A5',
    M13A: 'G5', M13B: 'G4', M13C: 'G2', M13D: 'G3', M13E: 'G1', M14: 'G6',
    M15: 'A16',
    M15A: 'A17', M17: 'A19', M19: 'A18', M50: 'A15', // by position

    // Central campus
    M4: 'A8', M5: 'A9', M6: 'A10', M7: 'A11', M7A: 'A20', M8: 'A14', M9: 'A13', M10: 'A12',
    M11: 'B1', M11A: 'B2', M12: 'B3', M16: 'A7',
    W4: 'C8', W5: 'C9', W6: 'C10', W7: 'C11', W7A: 'C16', W8: 'C14', W9: 'C13', W10: 'C12',
    W12: 'B4', W16: 'C7',

    // North campus and community
    W1: 'C1', W2: 'C2', W3: 'C3', W15: 'C15', W20: 'C4', W20A: 'C6', W21: 'C5',
    W13A: 'H1', W13B: 'H2', W13C: 'H3', W13D: 'H4', W13E: 'H6', W13F: 'H5', W13G: 'H7', W13H: 'H8',
    W14: 'H10',

    // Fine Arts and the medical campus. The annotated map marks M30 as E11,
    // but M30 is the small angled mosque, which the 2025/2026 map calls E10
    // (E11 is the Dental Hospital beside it).
    M22: 'D1',
    M23: 'E1', M24: 'E2', M25: 'E3', M26: 'E4', M27: 'E5', M28: 'E9', M29: 'E8', M30: 'E10',
    M31: 'E7', M32: 'E6', M33A: 'F1', M33B: 'F2', M33C: 'F3',

    // Each housing compound also went by one code for the whole group.
    M13: ['G1', 'G2', 'G3', 'G4', 'G5'],
    W13: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7', 'H8'],
    M33: ['F1', 'F2', 'F3'],
};

/** Today's building ids for an old code ("M10", "w13"), or null if it isn't one. */
export function fromOldCode(code) {
    const now = OLD_CODES[(code || '').trim().toUpperCase()];
    return now ? [].concat(now) : null;
}

const FLOORS = ['ground', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'];

/**
 * The floor a room is on: the first digit of its three-digit room number,
 * 0 for the ground floor. The number is the last three digits after the
 * building code, so "C14-W8-004" (wing W8) is on the ground floor and
 * "C9-TH106D" on the first. Null when there is no such number to go on.
 */
export function floorOfRoom(room) {
    const m = /^[A-HMW]\d{1,2}[A-H]?-(.+)$/i.exec((room || '').trim());
    const numbers = m && m[1].match(/\d{3}/g);
    if (!numbers) return null;
    const level = Number(numbers[numbers.length - 1][0]);
    return { level, name: `${FLOORS[level]} floor` };
}

/**
 * "A3-007", "C14-W8-004" or an old-style "M10-102" to today's building id.
 * Null for anything that names no building.
 */
export function buildingOfRoom(room) {
    const m = /^([A-HMW]\d{1,2}[A-H]?)-/i.exec((room || '').trim());
    if (!m) return null;
    const code = m[1].toUpperCase();
    return fromOldCode(code)?.[0] || code;
}
