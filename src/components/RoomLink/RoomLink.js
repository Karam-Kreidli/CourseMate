'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { buildingOfRoom, floorOfRoom } from '@/app/map/buildings';
import styles from './RoomLink.module.css';

const PinIcon = () => (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.pin}>
        <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
        <circle cx="12" cy="9.5" r="2.5" />
    </svg>
);

/**
 * A room, or a few ("A3-007, A12-004"), as chips that open the campus map on
 * the building each one is in, labelled "Map" so they read as buttons. Old codes work too: Find My Prof's "M5-123"
 * office is in A9. Anything that names no building ("TBA", an online class)
 * stays plain text.
 *
 * `className` styles the whole thing, so it can stand in for the plain room
 * span a page already had.
 */
export default function RoomLink({ room, className = '' }) {
    if (!room) return null;
    const rooms = room.split(/\s*,\s*/).filter(Boolean);

    return (
        <span className={className}>
            {rooms.map((part, i) => {
                const building = buildingOfRoom(part);
                const floor = floorOfRoom(part);
                return (
                    <Fragment key={`${part}-${i}`}>
                        {i > 0 && ', '}
                        {building ? (
                            <Link
                                href={`/map?room=${encodeURIComponent(part)}`}
                                className={styles.link}
                                title={`Show ${building} on the campus map${floor ? `, ${floor.name}` : ''}`}
                                aria-label={`${part}: show on the campus map`}
                                // Rooms sit inside clickable rows (picking a section);
                                // opening the map shouldn't also pick the row.
                                onClick={e => e.stopPropagation()}
                            >
                                <PinIcon />
                                {part}
                                {/* Says outright that this opens the map: a room on its
                                    own didn't read as something to tap. */}
                                <span className={styles.cta} aria-hidden="true">Map ›</span>
                            </Link>
                        ) : part}
                    </Fragment>
                );
            })}
        </span>
    );
}
