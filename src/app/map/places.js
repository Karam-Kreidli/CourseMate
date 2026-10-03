/**
 * Places on the campus map (the map_places table): what they can be, their
 * weekly hours, and the checks the admin API runs before saving one. Shared
 * by the map, the admin Map tab and the API, so it must not touch the DOM.
 */

import { buildingOfRoom } from './buildings';

// In the order the map's filter chips list them. `plural` names the chip.
export const PLACE_KINDS = {
    cafe: { label: 'Coffee shop', plural: 'Coffee shops', color: '#A16207' },
    food: { label: 'Restaurant', plural: 'Restaurants', color: '#F97316' },
    shop: { label: 'Shop', plural: 'Shops', color: '#E11D48' },
    bank: { label: 'Bank', plural: 'Banks', color: '#0891B2' },
    vending: { label: 'Vending machine', plural: 'Vending machines', color: '#16A34A' },
    pharmacy: { label: 'Pharmacy', plural: 'Pharmacies', color: '#DC2626' },
    library: { label: 'Library', plural: 'Libraries', color: '#0D9488' },
    prayer: { label: 'Prayer', plural: 'Prayer', color: '#4D7C0F' },
    sports: { label: 'Sports', plural: 'Sports', color: '#C026D3' },
    charging: { label: 'Charging station', plural: 'Charging', color: '#CA8A04' },
    security: { label: 'Security', plural: 'Security', color: '#1E3A8A' },
    department: { label: 'Department or office', plural: 'Departments', color: '#3B82F6' },
    service: { label: 'Service', plural: 'Services', color: '#8B5CF6' },
    other: { label: 'Other', plural: 'Other', color: '#64748B' },
};

// Monday first; the keys are what the hours column stores.
export const DAYS = [
    ['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'],
    ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun'],
];

// Hours are the campus's own clock, wherever the student's phone thinks it is.
const CAMPUS_TIME_ZONE = 'Asia/Dubai';
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_RANGES_PER_DAY = 4;

const toMinutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

// A place that shuts at 00:00 is open until midnight, which reads better.
const closing = (hhmm) => (hhmm === '00:00' ? 'midnight' : hhmm);

/**
 * Cleans a weekly schedule: { mon: [["08:00", "15:00"]], ... } with every day
 * present (an empty list is closed) and each day's ranges in order. Null
 * stays null, meaning nobody has entered hours. Throws on anything malformed.
 */
export function normalizeHours(hours) {
    if (hours == null) return null;
    if (typeof hours !== 'object' || Array.isArray(hours)) throw new Error('Hours must be a weekly schedule');
    const out = {};
    for (const [key, label] of DAYS) {
        const ranges = hours[key] ?? [];
        if (!Array.isArray(ranges) || ranges.length > MAX_RANGES_PER_DAY) {
            throw new Error(`${label}: at most ${MAX_RANGES_PER_DAY} time ranges`);
        }
        out[key] = ranges.map(range => {
            const [open, close] = Array.isArray(range) ? range : [];
            if (!TIME_RE.test(open || '') || !TIME_RE.test(close || '')) {
                throw new Error(`${label}: times must look like 08:00`);
            }
            if (open === close) throw new Error(`${label}: opening and closing times are the same`);
            return [open, close];
        }).sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]));
    }
    return out;
}

/** The day and minute of the day on campus right now. */
function campusNow(date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: CAMPUS_TIME_ZONE,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    }).formatToParts(date);
    const part = (type) => parts.find(p => p.type === type)?.value;
    const day = DAYS.findIndex(([, label]) => label === part('weekday'));
    return { day, minutes: Number(part('hour')) * 60 + Number(part('minute')) };
}

/**
 * Whether a place is open, as a short line for the map: "Open until 15:00",
 * "Closed, opens 16:00", "Closed, opens Mon 08:00". Null when there are no
 * hours to go on. A range that closes before it opens runs past midnight.
 */
export function openStatus(hours, date = new Date()) {
    if (!hours) return null;
    const { day, minutes } = campusNow(date);
    if (day < 0) return null;
    const rangesOn = (offset) => hours[DAYS[(day + offset + 7) % 7][0]] || [];

    for (const [open, close] of rangesOn(0)) {
        const o = toMinutes(open);
        const c = toMinutes(close);
        if (c > o ? minutes >= o && minutes < c : minutes >= o) return { open: true, text: `Open until ${closing(close)}` };
    }
    // Last night's late opening still going.
    for (const [open, close] of rangesOn(-1)) {
        if (toMinutes(close) <= toMinutes(open) && minutes < toMinutes(close)) {
            return { open: true, text: `Open until ${closing(close)}` };
        }
    }

    const laterToday = rangesOn(0).find(([open]) => toMinutes(open) > minutes);
    if (laterToday) return { open: false, text: `Closed, opens ${laterToday[0]}` };
    for (let offset = 1; offset <= 7; offset++) {
        const [first] = rangesOn(offset);
        if (first) {
            const when = offset === 1 ? 'tomorrow' : DAYS[(day + offset) % 7][1];
            return { open: false, text: `Closed, opens ${when} ${first[0]}` };
        }
    }
    return { open: false, text: 'Closed' };
}

/** One day's ranges for display: "08:00–15:00, 16:00–midnight", or "Closed". */
export function formatDay(ranges) {
    if (!ranges || ranges.length === 0) return 'Closed';
    return ranges.map(([open, close]) => `${open}–${closing(close)}`).join(', ');
}

/** Today's key in the hours object, on campus time. */
export function todayKey(date = new Date()) {
    const { day } = campusNow(date);
    return day < 0 ? null : DAYS[day][0];
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-.\s]{5,30}$/;

function text(value, max, field) {
    if (value == null) return null;
    if (typeof value !== 'string') throw new Error(`${field} must be text`);
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > max) throw new Error(`${field} is too long (max ${max} characters)`);
    return trimmed;
}

/**
 * A place from the admin form, checked and cleaned for the database. Throws
 * an Error whose message can go straight back to the admin.
 *
 * `map` is { buildingIds: Set, width, height } from campus.json, so a place
 * can only belong to a building the map has, and a pin must be on the map.
 */
export function normalizePlace(input, map) {
    const place = {};

    place.name = text(input.name, 120, 'Name');
    if (!place.name) throw new Error('Name is required');

    place.kind = input.kind || 'other';
    if (!PLACE_KINDS[place.kind]) throw new Error('Unknown kind of place');

    place.building_id = text(input.building_id, 20, 'Building');
    if (place.building_id && !map.buildingIds.has(place.building_id)) {
        throw new Error(`There is no building ${place.building_id} on the map`);
    }

    // A room code names its building ("A3-007" is in A3): it fills in a
    // missing building, and can't disagree with the one chosen.
    place.room = text(input.room, 30, 'Room')?.toUpperCase() || null;
    const roomBuilding = place.room && buildingOfRoom(place.room);
    if (roomBuilding && map.buildingIds.has(roomBuilding)) {
        if (!place.building_id) place.building_id = roomBuilding;
        else if (place.building_id !== roomBuilding) {
            throw new Error(`Room ${place.room} is in ${roomBuilding}, not ${place.building_id}`);
        }
    }

    const hasPin = input.pin_x != null || input.pin_y != null;
    if (hasPin) {
        const x = Number(input.pin_x);
        const y = Number(input.pin_y);
        if (!Number.isFinite(x) || !Number.isFinite(y)
            || Math.abs(x) > map.width / 2 || Math.abs(y) > map.height / 2) {
            throw new Error('The pin is not on the map');
        }
        place.pin_x = Math.round(x * 100) / 100;
        place.pin_y = Math.round(y * 100) / 100;
    } else {
        place.pin_x = null;
        place.pin_y = null;
    }
    if (!place.building_id && !hasPin) throw new Error('Choose a building, drop a pin, or both');

    place.description = text(input.description, 500, 'Description');
    place.location_note = text(input.location_note, 200, 'Where inside');
    place.hours_note = text(input.hours_note, 200, 'Hours note');
    place.link_label = text(input.link_label, 60, 'Link text');

    place.email = text(input.email, 120, 'Email');
    if (place.email && !EMAIL_RE.test(place.email)) throw new Error('That email address doesn\'t look right');

    place.phone = text(input.phone, 30, 'Phone');
    if (place.phone && !PHONE_RE.test(place.phone)) throw new Error('That phone number doesn\'t look right');

    place.link_url = text(input.link_url, 500, 'Link');
    if (place.link_url && !/^https?:\/\//i.test(place.link_url)) throw new Error('The link must start with http:// or https://');

    // Uploaded logos are full URLs; the co-op's ships with the site.
    place.logo_url = text(input.logo_url, 500, 'Logo');
    if (place.logo_url && !/^(https?:\/\/|\/map\/)/i.test(place.logo_url)) throw new Error('The logo must be an uploaded image');

    place.hours = normalizeHours(input.hours);
    place.show_sign = !!input.show_sign && !!place.logo_url;
    place.is_visible = input.is_visible !== false;
    place.sort_order = Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : 0;

    return place;
}
