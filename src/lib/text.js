/**
 * The university registry serves instructor names HTML-encoded — "Mheidat,
 * Mo&#39;ath" rather than "Mheidat, Mo'ath" — and the section import stores
 * them exactly as received. Every place a name reaches the screen has to
 * decode it, so the decoder lives here rather than being copied per page.
 *
 * Handles named entities plus numeric ones in decimal (&#39;) and hex (&#x27;)
 * form. Anything that isn't a recognised entity is left alone, so a literal
 * ampersand in a name survives untouched.
 */

const NAMED_ENTITIES = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
};

export function decodeHtmlEntities(text) {
    if (typeof text !== 'string' || !text.includes('&')) return text;

    return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body) => {
        if (body[0] === '#') {
            const code = body[1] === 'x' || body[1] === 'X'
                ? parseInt(body.slice(2), 16)
                : parseInt(body.slice(1), 10);
            if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return whole;
            return String.fromCodePoint(code);
        }
        const named = NAMED_ENTITIES[body.toLowerCase()];
        return named === undefined ? whole : named;
    });
}

/** Decode the instructor on a section row, leaving everything else as it was. */
export function decodeSectionInstructor(section) {
    if (!section || typeof section !== 'object') return section;
    return { ...section, instructor: decodeHtmlEntities(section.instructor) };
}

/** Decode the instructor on every row of a section list. */
export function decodeSectionInstructors(sections) {
    if (!Array.isArray(sections)) return sections;
    return sections.map(decodeSectionInstructor);
}
