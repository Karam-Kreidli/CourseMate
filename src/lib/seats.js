// Seat availability, as Banner reports it.
//
// Banner allows enrollment past a section's capacity, so seatsAvailable is
// genuinely negative on ~30% of sections (down to -48 this term). A student
// only needs to know they cannot join, so anything at or below zero reads as
// "Full" -- never a negative number.
//
// null means the section has never been fetched (an older term synced before
// seat tracking existed), which is different from "no seats" and renders as
// nothing at all rather than a misleading zero.

export function seatStatus(section) {
    const available = section?.seats_available;
    if (available === null || available === undefined) return null;

    const capacity = section.max_enrollment;
    const ofCapacity = capacity ? ` of ${capacity}` : '';

    if (available <= 0) {
        return {
            tone: 'full',
            label: 'Full',
            // Spelled out wherever there is room. "Full" alone does not say
            // whether the section is at capacity or over it.
            detail: capacity ? `Full — 0 of ${capacity} seats` : 'Full — no seats',
            title: capacity ? `No seats open, capacity ${capacity}` : 'No seats open'
        };
    }

    // Always "seats left", never a bare number: "2" beside a section number
    // reads as part of the section, not as availability.
    const noun = available === 1 ? 'seat' : 'seats';
    return {
        tone: available <= 5 ? 'low' : 'open',
        label: `${available} ${noun} left`,
        // With a capacity the plural follows the capacity, not the remainder:
        // "1 of 30 seats left", never "1 of 30 seat left".
        detail: capacity ? `${available} of ${capacity} seats left` : `${available} ${noun} left`,
        title: capacity ? `${available} of ${capacity} seats open` : `${available} seats open`
    };
}

// "as of 3 minutes ago" for the freshness note next to seat counts.
export function seatsAge(section) {
    const stamp = section?.seats_updated_at;
    if (!stamp) return null;
    const then = new Date(stamp).getTime();
    if (Number.isNaN(then)) return null;

    const minutes = Math.floor((Date.now() - then) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return days === 1 ? 'yesterday' : `${days} days ago`;
}
