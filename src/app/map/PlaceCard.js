'use client';

import { useEffect, useRef, useState } from 'react';
import { DAYS, PLACE_KINDS, formatDay, openStatus, todayKey } from './places';
import PlaceIcon from './PlaceIcon';
import styles from './map.module.css';

/**
 * One place inside a building (or on a pin): what it is, whether it's open
 * right now, and how to reach it. The week's hours fold away until asked for.
 *
 * startOpen unfolds the hours and scrolls the card into view: it is the place
 * a search or a pin asked for. bare drops the name, for a panel that already
 * has it as its title.
 */
export default function PlaceCard({ place, startOpen = false, bare = false }) {
    const [showHours, setShowHours] = useState(startOpen);
    const card = useRef(null);

    useEffect(() => {
        if (startOpen) card.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, [startOpen]);

    const status = openStatus(place.hours);
    const today = todayKey();
    const kind = PLACE_KINDS[place.kind] || PLACE_KINDS.other;

    return (
        <li ref={card} className={`${styles.place} ${startOpen && !bare ? styles.placeFocused : ''} ${bare ? styles.placeBare : ''}`}>
            {!bare && <div className={styles.placeHead}>
                {place.logo_url
                    // Logos come in any shape; next/image wants a fixed one.
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={place.logo_url} alt="" className={styles.placeLogo} />
                    : <PlaceIcon kind={place.kind} size={34} />}
                <div className={styles.placeTitle}>
                    <strong>{place.name}</strong>
                    <small>{[kind.label, place.room && `Room ${place.room}`, place.location_note].filter(Boolean).join(' · ')}</small>
                </div>
            </div>}

            {status && (
                <p className={`${styles.placeStatus} ${status.open ? styles.isOpen : ''}`}>
                    <span className={styles.statusDot} aria-hidden="true" />
                    {status.text}
                </p>
            )}

            {place.description && <p className={styles.placeText}>{place.description}</p>}

            {(place.hours || place.hours_note) && (
                <>
                    {place.hours && (
                        <button type="button" className={styles.placeToggle} onClick={() => setShowHours(s => !s)} aria-expanded={showHours}>
                            {showHours ? 'Hide hours' : 'Opening hours'}
                        </button>
                    )}
                    {showHours && place.hours && (
                        <table className={styles.hoursTable}>
                            <tbody>
                                {DAYS.map(([key, label]) => (
                                    <tr key={key} className={key === today ? styles.today : ''}>
                                        <th scope="row">{label}</th>
                                        <td>{formatDay(place.hours[key])}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {place.hours_note && <p className={styles.placeNote}>{place.hours_note}</p>}
                </>
            )}

            {(place.email || place.phone || place.link_url) && (
                <div className={styles.placeLinks}>
                    {place.email && <a href={`mailto:${place.email}`}>{place.email}</a>}
                    {place.phone && <a href={`tel:${place.phone.replace(/[^\d+]/g, '')}`}>{place.phone}</a>}
                    {place.link_url && (
                        <a href={place.link_url} target="_blank" rel="noopener noreferrer">
                            {place.link_label || 'More information'}
                        </a>
                    )}
                </div>
            )}
        </li>
    );
}
