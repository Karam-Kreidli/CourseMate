'use client';

import { Children, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { decodeHtmlEntities } from '@/lib/text';
import { useSemester } from '@/lib/SemesterContext';
import PageShell from '@/components/PageShell';
import PageHeader from '@/components/PageHeader';
import { BUILDING_IDS, focusOnBuilding, focusOnPin, focusOnPoints, focusOnZone, overview, sizedInfo, findBuilding } from './view';
import { buildingOfRoom, floorOfRoom, fromOldCode } from './buildings';
import { PLACE_KINDS, openStatus } from './places';
import PlaceCard from './PlaceCard';
import PlaceIcon from './PlaceIcon';
import styles from './map.module.css';

// WebGL only exists in the browser.
const CampusScene = dynamic(() => import('./CampusScene'), {
    ssr: false,
    loading: () => <div className={styles.loading}>Loading the campus…</div>,
});

/**
 * The filter chips in one row that scrolls sideways, as Google Maps does it.
 * There are more chips than fit, so the row says so: arrows on whichever side
 * has more (on screens with a mouse), a fade at a cut edge, and the wheel
 * scrolls it sideways. `after` stays put at the row's end.
 */
function ChipRow({ label, children, after }) {
    const ref = useRef(null);
    const [more, setMore] = useState({ left: false, right: false });
    // Re-measured when chips come or go, not on every render of the page.
    const chipCount = Children.count(children);

    useEffect(() => {
        const row = ref.current;
        if (!row) return undefined;
        const measure = () => setMore({
            left: row.scrollLeft > 1,
            right: row.scrollLeft + row.clientWidth < row.scrollWidth - 1,
        });
        // A vertical wheel moves the row sideways. React's own wheel handler
        // is passive, so it couldn't stop the page scrolling at the same time.
        const onWheel = (e) => {
            if (row.scrollWidth <= row.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            e.preventDefault();
            row.scrollLeft += e.deltaY;
        };
        measure();
        row.addEventListener('scroll', measure, { passive: true });
        row.addEventListener('wheel', onWheel, { passive: false });
        const resize = new ResizeObserver(measure);
        resize.observe(row);
        for (const chip of row.children) resize.observe(chip);
        return () => {
            row.removeEventListener('scroll', measure);
            row.removeEventListener('wheel', onWheel);
            resize.disconnect();
        };
    }, [chipCount]);

    const page = (dir) => {
        const row = ref.current;
        row.scrollBy({ left: dir * row.clientWidth * 0.7, behavior: 'smooth' });
    };

    return (
        <div className={styles.filtersBar}>
            <div className={styles.filtersTrack}>
                <div
                    ref={ref}
                    className={`${styles.filters} ${more.left ? styles.fadeLeft : ''} ${more.right ? styles.fadeRight : ''}`}
                    role="group"
                    aria-label={label}
                >
                    {children}
                </div>
                {more.left && (
                    <button type="button" className={`${styles.filterArrow} ${styles.filterArrowLeft}`} onClick={() => page(-1)} aria-label="Earlier filters">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
                    </button>
                )}
                {more.right && (
                    <button type="button" className={`${styles.filterArrow} ${styles.filterArrowRight}`} onClick={() => page(1)} aria-label="More filters">
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
                    </button>
                )}
            </div>
            {after}
        </div>
    );
}

const ZONE_BUTTONS = [
    { zone: 'all', label: 'Campus' },
    { zone: 'A', label: "Men's" },
    { zone: 'B', label: 'Central' },
    { zone: 'C', label: "Women's" },
    { zone: 'E', label: 'Medical' },
];

// Below this width the building panel sits along the bottom of the map.
const PHONE_QUERY = '(max-width: 767px)';
const onPhone = () => window.matchMedia(PHONE_QUERY).matches;
const focusFor = (id) => focusOnBuilding(id, { panelBelow: onPhone() });

/** Where to fly for a place: its own pin if it has one, else its building. */
function focusForPlace(place) {
    if (place.pin_x != null) return focusOnPin(place.pin_x, place.pin_y, { panelBelow: onPhone() });
    return focusFor(place.building_id);
}

const INFOS = Object.fromEntries(BUILDING_IDS.map(id => [id, sizedInfo(findBuilding(id))]));

/** The 2019/2020 code a query uses ("M10", or the "M10" of "M10-102"), if any. */
function oldCodeIn(query) {
    const m = /^([MW]\d{1,2}[A-H]?)(?:-|$)/i.exec(query.trim());
    return m && fromOldCode(m[1]) ? m[1].toUpperCase() : null;
}

const placeWords = (place) => [place.name, place.description, place.room, place.location_note, PLACE_KINDS[place.kind]?.label]
    .filter(Boolean).join(' ').toLowerCase();

/**
 * What a search finds. Buildings match a code ("A3"), a room ("A3-007"),
 * words ("engineering") or an old code ("M10", "W13", which counts as a
 * search for today's). Places match their name or what they are ("grocery",
 * "registration", "coffee").
 */
function searchMap(query, places) {
    const q = query.trim().toLowerCase();
    if (!q) return { buildings: [], places: [] };
    const old = fromOldCode(q);
    if (old) return { buildings: old.filter(id => INFOS[id]), places: [] };
    // A room ("A3-007") finds its building, and any place in that very room.
    const room = buildingOfRoom(q);
    if (room && INFOS[room]) return { buildings: [room], places: places.filter(p => p.room?.toLowerCase() === q) };
    const buildings = BUILDING_IDS.filter(id => {
        const info = INFOS[id];
        if (id.toLowerCase() === q || (q.length >= 2 && id.toLowerCase().startsWith(q))) return true;
        const words = [info.name, info.note, info.zoneName, ...info.colleges].filter(Boolean).join(' ').toLowerCase();
        return q.length >= 3 && words.includes(q);
    }).slice(0, 8);
    const found = q.length >= 3 ? places.filter(p => placeWords(p).includes(q)).slice(0, 6) : [];
    return { buildings, places: found };
}

function titleOf(info) {
    return info.name || (info.code ? `Building ${info.code}` : 'Building');
}

/** "A5 · Students Center" for a place's building, or where it is without one. */
function whereIs(place) {
    if (!place.building_id) return place.location_note || 'On the campus map';
    const info = INFOS[place.building_id];
    return [place.room ? `Room ${place.room}` : info?.code || 'Hospital', info?.name].filter(Boolean).join(' · ');
}

/** A place's spot on the flat map: its pin, else the middle of its building. */
function pointOf(place) {
    if (place.pin_x != null) return [place.pin_x, place.pin_y];
    return findBuilding(place.building_id)?.center || null;
}

/**
 * Everything in the categories switched on, like a maps app's list of nearby
 * coffee shops: what each is, where, and whether it's open now.
 */
function ResultsPanel({ places, kinds, onPick, onClear }) {
    const title = kinds.map(k => PLACE_KINDS[k].plural).join(', ');
    return (
        <aside className={styles.panel} aria-label={title}>
            <div className={styles.panelHead}>
                <div className={styles.panelTitle}>
                    <h2>{title}</h2>
                    <p>{places.length} on the map</p>
                </div>
                <button type="button" className={styles.close} onClick={onClear} aria-label="Clear the filter">×</button>
            </div>
            <ul className={styles.resultList}>
                {places.map(place => {
                    const status = openStatus(place.hours);
                    return (
                        <li key={place.id}>
                            <button type="button" onClick={() => onPick(place)}>
                                {place.logo_url
                                    // eslint-disable-next-line @next/next/no-img-element
                                    ? <img src={place.logo_url} alt="" className={styles.resultLogo} />
                                    : <PlaceIcon kind={place.kind} size={34} />}
                                <span className={styles.resultText}>
                                    <strong>{place.name}</strong>
                                    <small>{whereIs(place)}</small>
                                    {status && (
                                        <small className={`${styles.resultStatus} ${status.open ? styles.isOpen : ''}`}>{status.text}</small>
                                    )}
                                </span>
                            </button>
                        </li>
                    );
                })}
            </ul>
        </aside>
    );
}

function BuildingPanel({ id, term, places, openPlace, room, onClose }) {
    const info = INFOS[id];
    const [classes, setClasses] = useState(null);

    useEffect(() => {
        if (!info.teaching || !term) return;
        let cancelled = false;
        setClasses(null);
        (async () => {
            const supabase = createClient();
            const { data: sections } = await supabase
                .from('sections')
                .select('course_id, location')
                .eq('term_code', term)
                .eq('is_active', true)
                .ilike('location', `${info.code}-%`);
            const ids = [...new Set((sections || []).map(s => s.course_id))];
            const { data: courses } = ids.length
                ? await supabase.from('courses').select('course_id, course_name').in('course_id', ids)
                : { data: [] };
            if (cancelled) return;
            // Banner titles arrive HTML-encoded ("Hadith and It&rsquo;s Sciences").
            const names = Object.fromEntries((courses || []).map(c => [c.course_id, decodeHtmlEntities(c.course_name)]));
            setClasses({
                sections: sections?.length || 0,
                rooms: new Set((sections || []).map(s => s.location)).size,
                courses: ids.map(cid => ({ id: cid, name: names[cid] || '' })).sort((a, b) => a.name.localeCompare(b.name)),
            });
        })();
        return () => { cancelled = true; };
    }, [info, term]);

    return (
        <aside className={styles.panel} aria-label={titleOf(info)}>
            <div className={styles.panelHead}>
                {info.code && <span className={`${styles.code} ${styles[`zone${info.zone}`] || ''}`}>{info.code}</span>}
                <div className={styles.panelTitle}>
                    <h2>{titleOf(info)}</h2>
                    <p>{[info.zoneName, info.note].filter(Boolean).join(' · ')}</p>
                </div>
                <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>
            </div>

            {/* Arrived from a room somewhere else in the app: say which. */}
            {room && (
                <p className={styles.roomBanner}>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
                        <circle cx="12" cy="9.5" r="2.5" />
                    </svg>
                    <span>
                        Room <strong>{room}</strong> is {floorOfRoom(room) ? `on the ${floorOfRoom(room).name} of` : 'in'} this building.
                    </span>
                </p>
            )}

            {info.colleges.length > 0 && (
                <ul className={styles.colleges}>
                    {info.colleges.map(c => <li key={c}>{c}</li>)}
                </ul>
            )}

            {places.length > 0 && (
                <section className={styles.insideSection}>
                    <h3>Inside</h3>
                    <ul className={styles.places}>
                        {places.map(p => <PlaceCard key={p.id} place={p} startOpen={p.id === openPlace} />)}
                    </ul>
                </section>
            )}

            {!info.name && (
                <p className={styles.muted}>The campus map&apos;s legend doesn&apos;t say what this building is.</p>
            )}

            {info.teaching && (
                <div className={styles.classes}>
                    {!classes ? (
                        <p className={styles.muted}>Looking up classes…</p>
                    ) : classes.sections === 0 ? (
                        <p className={styles.muted}>No classes meet here this term.</p>
                    ) : (
                        <>
                            <p className={styles.classesSummary}>
                                {classes.sections} section{classes.sections === 1 ? '' : 's'} of {classes.courses.length} course{classes.courses.length === 1 ? '' : 's'} meet here this term, in {classes.rooms} room{classes.rooms === 1 ? '' : 's'}.
                            </p>
                            <ul className={styles.courseList}>
                                {classes.courses.map(c => (
                                    <li key={c.id}>
                                        <span className={styles.courseId}>{c.id}</span>
                                        <span>{c.name}</span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            )}
        </aside>
    );
}

/** A place that isn't inside a building, like a corridor coffee shop. */
function PlacePanel({ place, onClose }) {
    return (
        <aside className={styles.panel} aria-label={place.name}>
            <div className={styles.panelHead}>
                {place.logo_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={place.logo_url} alt="" className={styles.placeLogo} />
                    : <PlaceIcon kind={place.kind} size={38} />}
                <div className={styles.panelTitle}>
                    <h2>{place.name}</h2>
                    <p>{[PLACE_KINDS[place.kind]?.label, place.room && `Room ${place.room}`, place.location_note].filter(Boolean).join(' · ')}</p>
                </div>
                <button type="button" className={styles.close} onClick={onClose} aria-label="Close">×</button>
            </div>
            <ul className={styles.places}>
                <PlaceCard place={place} startOpen bare />
            </ul>
        </aside>
    );
}

function CampusMap() {
    const router = useRouter();
    const params = useSearchParams();
    const { selectedTerm } = useSemester();

    const [ready, setReady] = useState(false);
    const [selected, setSelected] = useState(null);
    const [focus, setFocus] = useState(null);
    const [query, setQuery] = useState('');
    const [zone, setZone] = useState(null);
    // A turn request for the scene: `by` radians, or null to face north. A
    // fresh object each press, so pressing the same button twice turns twice.
    const [turn, setTurn] = useState(null);
    const needle = useRef(null);
    // Every visible row of map_places, which the admin Map tab edits.
    const [places, setPlaces] = useState([]);
    // The place a search or a pin opened: unfolded in its building's panel,
    // or in a panel of its own when it has no building.
    const [openPlace, setOpenPlace] = useState(null);
    // The categories switched on in the filter row. Their places get pins;
    // with none on, the map shows no pins at all.
    const [activeKinds, setActiveKinds] = useState(() => new Set());
    // The room a link elsewhere in the app came for (?room=A3-007), shown in
    // its building's panel until another building is picked.
    const [linkedRoom, setLinkedRoom] = useState(null);

    const results = useMemo(() => searchMap(query, places), [query, places]);
    const renamedFrom = oldCodeIn(query);
    const matched = [...results.buildings, ...results.places.map(p => p.building_id).filter(Boolean)];
    const highlight = matched.length > 0 ? new Set(matched) : null;
    const resultCount = results.buildings.length + results.places.length;

    const placesIn = (id) => places.filter(p => p.building_id === id);
    // Only the categories something is filed under get a chip.
    const kindsPresent = Object.keys(PLACE_KINDS).filter(k => places.some(p => p.kind === k));
    const filtered = places
        .filter(p => activeKinds.has(p.kind))
        .sort((a, b) => Object.keys(PLACE_KINDS).indexOf(a.kind) - Object.keys(PLACE_KINDS).indexOf(b.kind) || a.name.localeCompare(b.name));

    // Switching a category on frames all of its places, the way a maps app
    // zooms out to show every result.
    const toggleKind = (kind) => {
        const next = new Set(activeKinds);
        if (next.has(kind)) next.delete(kind);
        else {
            next.add(kind);
            const points = places.filter(p => next.has(p.kind)).map(pointOf).filter(Boolean);
            const view = focusOnPoints(points, { panelBelow: onPhone() });
            if (view) setFocus(view);
            setZone(null);
        }
        setActiveKinds(next);
        // The list of results takes the place of any open panel.
        setSelected(null);
        setOpenPlace(null);
    };
    const soloPlace = !selected && openPlace ? places.find(p => p.id === openPlace) : null;

    // Flying to one building leaves no area button lit.
    const select = (id) => {
        setSelected(id);
        setOpenPlace(null);
        setLinkedRoom(null);
        if (!id) return;
        setZone(null);
        setFocus(focusFor(id));
    };

    const selectPlace = (place) => {
        setSelected(place.building_id || null);
        setOpenPlace(place.id);
        setZone(null);
        setFocus(focusForPlace(place));
    };

    const showZone = (z) => {
        setZone(z);
        setFocus(z === 'all' ? overview() : focusOnZone(z));
    };

    useEffect(() => {
        const supabase = createClient();
        let cancelled = false;
        (async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { router.push('/auth'); return; }
            const { data: profile } = await supabase.from('profiles').select('gender').eq('id', user.id).single();
            if (cancelled) return;
            setReady(true);

            // A link can name a building (?b=A3) or a room (?room=A3-007).
            // Otherwise the map glides in to the student's own side of campus.
            const b = params.get('b') || '';
            const room = (params.get('room') || '').trim().toUpperCase();
            const linked = fromOldCode(b)?.[0] || b.toUpperCase() || buildingOfRoom(room);
            if (linked && INFOS[linked]) {
                setSelected(linked);
                setFocus(focusFor(linked));
                if (!b && room) setLinkedRoom(room);
            } else if (profile?.gender) {
                const own = profile.gender === 'male' ? 'A' : 'C';
                setZone(own);
                setFocus(focusOnZone(own));
            }

            const { data: rows } = await supabase
                .from('map_places')
                .select('*')
                .order('sort_order')
                .order('name');
            if (!cancelled) setPlaces(rows || []);
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pick = (id) => {
        setQuery('');
        select(id);
    };

    const pickPlace = (place) => {
        setQuery('');
        selectPlace(place);
    };

    const pickFirst = () => {
        if (results.buildings[0]) pick(results.buildings[0]);
        else if (results.places[0]) pickPlace(results.places[0]);
    };

    return (
        <PageShell width="wide">
            <PageHeader title="Campus map" subtitle="Tap a building to see what's in it" />

            <div className={styles.mapCard}>
                {ready && (
                    <CampusScene
                        selected={selected}
                        onSelect={select}
                        focus={focus}
                        turn={turn}
                        highlight={highlight}
                        needle={needle}
                        places={places}
                        openPlace={openPlace}
                        activeKinds={activeKinds}
                        onSelectPlace={(id) => {
                            const place = places.find(p => p.id === id);
                            if (place) selectPlace(place);
                        }}
                    />
                )}

                <div className={styles.topBar}>
                    <div className={styles.search}>
                        <input
                            type="search"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') pickFirst(); }}
                            placeholder="Search A3, C12-002, library, coffee…"
                            aria-label="Find a building, room or place"
                        />
                        {query.trim() && (
                            <ul className={styles.results}>
                                {resultCount === 0 && <li className={styles.noResult}>Nothing on the map matches that</li>}
                                {results.buildings.map(id => (
                                    <li key={id}>
                                        <button type="button" onClick={() => pick(id)}>
                                            <span className={`${styles.code} ${styles[`zone${INFOS[id].zone}`] || ''}`}>{INFOS[id].code || 'H'}</span>
                                            <span className={styles.resultText}>
                                                <strong>{titleOf(INFOS[id])}</strong>
                                                <small>
                                                    {/* Says why an old code found this, so a student
                                                        learns the building's name today. */}
                                                    {renamedFrom ? `Was ${renamedFrom} · ${INFOS[id].zoneName}` : INFOS[id].zoneName}
                                                </small>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                                {results.places.length > 0 && results.buildings.length > 0 && (
                                    <li className={styles.resultsLabel}>Places</li>
                                )}
                                {results.places.map(place => (
                                    <li key={place.id}>
                                        <button type="button" onClick={() => pickPlace(place)}>
                                            <PlaceIcon kind={place.kind} size={34} />
                                            <span className={styles.resultText}>
                                                <strong>{place.name}</strong>
                                                <small>{whereIs(place)}</small>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className={styles.zones} role="group" aria-label="Jump to an area">
                        {ZONE_BUTTONS.map(b => (
                            <button
                                key={b.label}
                                type="button"
                                className={zone === b.zone ? styles.zoneActive : ''}
                                onClick={() => showZone(b.zone)}
                            >
                                {b.label}
                            </button>
                        ))}
                    </div>
                    {kindsPresent.length > 0 && (
                        <ChipRow
                            label="Show places on the map"
                            after={activeKinds.size > 0 && (
                                <button type="button" className={styles.filterClear} onClick={() => { setActiveKinds(new Set()); }}>
                                    Clear
                                </button>
                            )}
                        >
                            {kindsPresent.map(kind => {
                                const on = activeKinds.has(kind);
                                const count = places.filter(p => p.kind === kind).length;
                                return (
                                    <button
                                        key={kind}
                                        type="button"
                                        className={`${styles.filter} ${on ? styles.filterOn : ''}`}
                                        style={{ '--kind': PLACE_KINDS[kind].color }}
                                        aria-pressed={on}
                                        onClick={(e) => {
                                            toggleKind(kind);
                                            // Clear appearing narrows the row; keep this chip in full view.
                                            const chip = e.currentTarget;
                                            requestAnimationFrame(() => chip.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }));
                                        }}
                                    >
                                        <PlaceIcon kind={kind} size={22} solid={on} />
                                        {PLACE_KINDS[kind].plural}
                                        <span className={styles.filterCount}>{count}</span>
                                    </button>
                                );
                            })}
                        </ChipRow>
                    )}
                </div>

                <div className={styles.turnControls} role="group" aria-label="Turn the map">
                    <button
                        type="button"
                        className={styles.compass}
                        onClick={() => setTurn({ by: null })}
                        aria-label="Face north"
                        title="Face north"
                    >
                        <span ref={needle} className={styles.needle}>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M12 2.5 16 12h-8z" className={styles.needleNorth} />
                                <path d="M12 21.5 8 12h8z" className={styles.needleSouth} />
                            </svg>
                            <span className={styles.needleLetter}>N</span>
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setTurn({ by: -Math.PI / 4 })}
                        aria-label="Turn left"
                        title="Turn left (or Shift + drag the map)"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>
                    </button>
                    <button
                        type="button"
                        onClick={() => setTurn({ by: Math.PI / 4 })}
                        aria-label="Turn right"
                        title="Turn right (or Shift + drag the map)"
                    >
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>
                    </button>
                </div>

                {selected && (
                    <BuildingPanel
                        key={`${selected}:${openPlace || ''}`}
                        id={selected}
                        term={selectedTerm}
                        places={placesIn(selected)}
                        openPlace={openPlace}
                        room={linkedRoom}
                        onClose={() => select(null)}
                    />
                )}
                {soloPlace && <PlacePanel key={soloPlace.id} place={soloPlace} onClose={() => setOpenPlace(null)} />}
                {!selected && !soloPlace && filtered.length > 0 && (
                    <ResultsPanel
                        places={filtered}
                        kinds={kindsPresent.filter(k => activeKinds.has(k))}
                        onPick={selectPlace}
                        onClear={() => setActiveKinds(new Set())}
                    />
                )}
            </div>
        </PageShell>
    );
}

export default function MapPage() {
    // useSearchParams needs a boundary to render statically.
    return (
        <Suspense fallback={null}>
            <CampusMap />
        </Suspense>
    );
}
