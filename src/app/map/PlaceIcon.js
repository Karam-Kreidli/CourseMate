import { PLACE_KINDS } from './places';

// One line icon per kind of place, drawn on a 24 unit grid.
const PATHS = {
    department: (
        <>
            <rect x="4" y="3" width="16" height="18" rx="1.5" />
            <path d="M9 21v-4h6v4M8 7h2M14 7h2M8 11h2M14 11h2" />
        </>
    ),
    security: (
        <>
            <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
            <path d="M9 12l2 2 4-4" />
        </>
    ),
    library: (
        <>
            <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z" />
            <path d="M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3M9 7h6" />
        </>
    ),
    food: (
        <>
            <path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10" />
            <path d="M17 21V3c-2 1.5-3 4-3 7h3" />
        </>
    ),
    cafe: (
        <>
            <path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" />
            <path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3M12 3v3" />
        </>
    ),
    shop: (
        <>
            <path d="M5 8h14l-1 13H6z" />
            <path d="M9 11V6a3 3 0 0 1 6 0v5" />
        </>
    ),
    service: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6M12 7.5v.5" />
        </>
    ),
    other: (
        <>
            <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
            <circle cx="12" cy="9.5" r="2.5" />
        </>
    ),
};

/**
 * A kind's icon on a tinted disc in the kind's colour; `solid` fills the disc
 * with the colour and draws the icon white, for a pin on the map.
 */
export default function PlaceIcon({ kind, size = 32, solid = false }) {
    const color = (PLACE_KINDS[kind] || PLACE_KINDS.other).color;
    return (
        <span
            aria-hidden="true"
            style={{
                display: 'inline-grid',
                placeItems: 'center',
                flex: 'none',
                width: size,
                height: size,
                borderRadius: '50%',
                background: solid ? color : `${color}1f`,
                color: solid ? '#fff' : color,
            }}
        >
            <svg
                viewBox="0 0 24 24"
                width={size * 0.56}
                height={size * 0.56}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                {PATHS[kind] || PATHS.other}
            </svg>
        </span>
    );
}
