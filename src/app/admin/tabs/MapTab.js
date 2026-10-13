'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import campus from '@/app/map/campus.json';
import { buildingInfo } from '@/app/map/buildings';
import { PLACE_KINDS, SUGGESTED_FIELDS, openStatus, placeChanges } from '@/app/map/places';
import PlaceIcon from '@/app/map/PlaceIcon';
import PlaceEditModal from './PlaceEditModal';
import styles from '../admin.module.css';
import own from './MapTab.module.css';

// Every building the map draws, with what the legend calls it.
const BUILDINGS = campus.buildings
    .filter(b => b.kind !== 'walkway')
    .map(b => ({ ...buildingInfo(b.id), id: b.id }));

// Sidebar entries that aren't one building.
const ALL = '__all';
const PINS_ONLY = '__pins';
const SUGGESTIONS = '__suggestions';

function buildingLabel(id) {
    const b = BUILDINGS.find(x => x.id === id);
    if (!b) return id;
    return [b.code || 'Hospital', b.name].filter(Boolean).join(' · ');
}

const Ctx = createContext(null);

function MapProvider({ children }) {
    const [places, setPlaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(ALL);
    // The kind of place the list is narrowed to, or null for every kind.
    const [kind, setKind] = useState(null);
    const [query, setQuery] = useState('');
    // The place in the editor: a row, a fresh draft ({}), or null when closed.
    const [editing, setEditing] = useState(null);
    // What students have suggested, waiting for review, and the one open in
    // the review form.
    const [suggestions, setSuggestions] = useState([]);
    const [reviewing, setReviewing] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const [placesRes, suggestionsRes] = await Promise.all([
                fetch('/api/admin/map-places'),
                fetch('/api/admin/map-suggestions'),
            ]);
            if (!placesRes.ok) throw new Error(await placesRes.text());
            if (!suggestionsRes.ok) throw new Error(await suggestionsRes.text());
            setPlaces((await placesRes.json()).places || []);
            setSuggestions((await suggestionsRes.json()).suggestions || []);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const counts = useMemo(() => {
        const c = {};
        for (const p of places) if (p.building_id) c[p.building_id] = (c[p.building_id] || 0) + 1;
        return c;
    }, [places]);

    const send = async (method, body) => {
        const res = await fetch('/api/admin/map-places', {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Something went wrong');
        return data;
    };

    const save = async (draft) => {
        const { place } = await send(draft.id ? 'PATCH' : 'POST', draft);
        setPlaces(prev => (draft.id ? prev.map(p => (p.id === place.id ? place : p)) : [...prev, place]));
        return place;
    };

    const toggleVisible = async (place) => {
        try {
            await save({ ...place, is_visible: !place.is_visible });
        } catch (e) {
            alert(e.message);
        }
    };

    const remove = async (place) => {
        if (!confirm(`Delete "${place.name}" from the map?`)) return;
        try {
            await send('DELETE', { id: place.id });
            setPlaces(prev => prev.filter(p => p.id !== place.id));
        } catch (e) {
            alert(e.message);
        }
    };

    const review = async (suggestion, action, draft) => {
        const res = await fetch('/api/admin/map-suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: suggestion.id, action, place: draft }),
        });
        const data = await res.json().catch(() => ({}));
        // Already reviewed elsewhere: it leaves the queue either way.
        if (res.status !== 409 && !res.ok) throw new Error(data.error || 'Something went wrong');
        setSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
        if (data.place) {
            setPlaces(prev => (prev.some(p => p.id === data.place.id)
                ? prev.map(p => (p.id === data.place.id ? data.place : p))
                : [...prev, data.place]));
        }
        if (res.status === 409) alert(data.error);
    };

    const reject = async (suggestion) => {
        if (!confirm(`Reject the suggestion "${suggestion.data.name}"?`)) return;
        try {
            await review(suggestion, 'reject');
        } catch (e) {
            alert(e.message);
        }
    };

    return (
        <Ctx.Provider value={{
            places, loading, error, counts,
            selected, setSelected, kind, setKind, query, setQuery,
            editing, setEditing, save, toggleVisible, remove,
            suggestions, reviewing, setReviewing, review, reject,
        }}>
            {children}
        </Ctx.Provider>
    );
}

function MapSidebar() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { places, counts, selected, setSelected, query, setQuery, suggestions } = ctx;

    const q = query.trim().toLowerCase();
    const matching = BUILDINGS.filter(b => !q
        || b.id.toLowerCase().startsWith(q)
        || (b.name || '').toLowerCase().includes(q));
    // Buildings that already have places come first.
    const withPlaces = matching.filter(b => counts[b.id]);
    const without = matching.filter(b => !counts[b.id]);
    const pinsOnly = places.filter(p => !p.building_id).length;

    const entry = (id, label, count, code, accent) => (
        <button
            key={id}
            type="button"
            className={`${styles.navBtn} ${own.navWide} ${selected === id ? styles.navBtnActive : ''}`}
            onClick={() => setSelected(id)}
        >
            <span className={own.navEntry}>
                {code && <span className={own.navCode}>{code}</span>}
                <span className={own.navName}>{label}</span>
            </span>
            {count > 0 && <span className={`${styles.navCount} ${accent ? own.navCountAccent : ''}`}>{count}</span>}
        </button>
    );

    return (
        <div className={styles.sidebarCard}>
            <p className={styles.sectionTitle}>Places on the map</p>
            <div className={styles.navList}>
                {entry(ALL, 'All places', places.length)}
                {entry(PINS_ONLY, 'Pins outside buildings', pinsOnly)}
                {entry(SUGGESTIONS, 'Suggestions from students', suggestions.length, null, true)}
            </div>

            <p className={styles.sectionTitle} style={{ marginTop: 14 }}>Buildings</p>
            <input
                className={styles.input}
                placeholder="Find a building"
                value={query}
                onChange={e => setQuery(e.target.value)}
            />
            <div className={`${styles.navList} ${own.buildingList}`}>
                {withPlaces.map(b => entry(b.id, b.name || `Building ${b.code}`, counts[b.id], b.code || 'H'))}
                {withPlaces.length > 0 && without.length > 0 && <div className={own.navSplit} />}
                {without.map(b => entry(b.id, b.name || `Building ${b.code}`, 0, b.code || 'H'))}
            </div>
        </div>
    );
}

function PlaceRow({ place }) {
    const { setEditing, toggleVisible, remove } = useContext(Ctx);
    const status = openStatus(place.hours);
    return (
        <div className={styles.row}>
            {place.logo_url
                ? <img src={place.logo_url} alt="" className={own.rowLogo} />
                : <PlaceIcon kind={place.kind} size={36} />}
            <div className={styles.rowMain}>
                <div className={styles.rowTitle}>
                    {place.name}
                    <span className={styles.badge}>{PLACE_KINDS[place.kind]?.label}</span>
                    {!place.is_visible && <span className={`${styles.badge} ${styles.badgeExpired}`}>hidden</span>}
                    {place.pin_x != null && <span className={styles.badge}>pin</span>}
                    {place.show_sign && <span className={`${styles.badge} ${styles.badgeAccent}`}>sign</span>}
                </div>
                <div className={styles.rowMeta}>
                    {[
                        place.building_id ? buildingLabel(place.building_id) : 'No building',
                        place.room && `Room ${place.room}`,
                        place.location_note,
                        status ? status.text : 'No hours yet',
                    ].filter(Boolean).join(' · ')}
                </div>
            </div>
            <div className={styles.rowActions}>
                <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setEditing(place)}>Edit</button>
                <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => toggleVisible(place)}>
                    {place.is_visible ? 'Hide' : 'Show'}
                </button>
                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => remove(place)}>Delete</button>
            </div>
        </div>
    );
}

const timeAgo = (iso) => {
    const mins = Math.round((Date.now() - new Date(iso)) / 60000);
    if (mins < 60) return `${Math.max(mins, 1)} min ago`;
    if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const submitterName = (s) => s.submitter?.name || s.submitter?.email || 'A student';

function SuggestionRow({ suggestion }) {
    const { places, setReviewing, reject } = useContext(Ctx);
    const { data } = suggestion;
    const current = suggestion.place_id && places.find(p => p.id === suggestion.place_id);
    const changed = current ? placeChanges(current, data) : [];
    return (
        <div className={styles.row}>
            {data.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={data.logo_url} alt="" className={own.rowLogo} />
                : <PlaceIcon kind={data.kind} size={36} />}
            <div className={styles.rowMain}>
                <div className={styles.rowTitle}>
                    {data.name}
                    <span className={`${styles.badge} ${styles.badgeAccent}`}>{current ? 'change' : 'new place'}</span>
                    <span className={styles.badge}>{PLACE_KINDS[data.kind]?.label}</span>
                </div>
                <div className={styles.rowMeta}>
                    {current
                        ? `Changes ${changed.map(k => SUGGESTED_FIELDS[k].toLowerCase()).join(', ') || 'nothing any more'}`
                        : [data.building_id ? buildingLabel(data.building_id) : 'Pin outside buildings', data.room && `Room ${data.room}`].filter(Boolean).join(' · ')}
                </div>
                <div className={styles.rowMeta}>
                    {submitterName(suggestion)} · {timeAgo(suggestion.created_at)}
                </div>
                {suggestion.note && <div className={own.suggestionNote}>&ldquo;{suggestion.note}&rdquo;</div>}
            </div>
            <div className={styles.rowActions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setReviewing(suggestion)}>Review</button>
                <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => reject(suggestion)}>Reject</button>
            </div>
        </div>
    );
}

/**
 * The review form: the suggestion laid over the place as it is now (or a new
 * place), for the admin to correct and accept, or reject.
 */
function SuggestionReview() {
    const { places, reviewing, setReviewing, review } = useContext(Ctx);
    const current = reviewing.place_id && places.find(p => p.id === reviewing.place_id);
    const changed = current ? placeChanges(current, reviewing.data) : [];
    const close = () => setReviewing(null);
    return (
        <PlaceEditModal
            place={current ? { ...current, ...reviewing.data } : { ...reviewing.data, is_visible: true }}
            buildings={BUILDINGS}
            title={current ? `Suggested change to ${current.name}` : 'Suggested place'}
            submitLabel={current ? 'Accept change' : 'Accept and add to the map'}
            intro={(
                <div className={own.reviewIntro}>
                    <div>
                        From <strong>{submitterName(reviewing)}</strong>
                        {reviewing.submitter?.email && reviewing.submitter.name && <> ({reviewing.submitter.email})</>}
                        {' · '}{timeAgo(reviewing.created_at)}
                    </div>
                    {current && (
                        <div>Changed: {changed.map(k => SUGGESTED_FIELDS[k]).join(', ') || 'nothing (the map already matches)'}</div>
                    )}
                    {reviewing.note && <div className={own.suggestionNote}>&ldquo;{reviewing.note}&rdquo;</div>}
                    <div>Fix anything that&apos;s off before accepting.</div>
                </div>
            )}
            onClose={close}
            onSave={async (draft) => { await review(reviewing, 'accept', draft); close(); }}
            onReject={async () => { await review(reviewing, 'reject'); close(); }}
        />
    );
}

function SuggestionsMain() {
    const { suggestions, loading, error, reviewing } = useContext(Ctx);
    return (
        <div className={styles.feedCard}>
            <div className={own.mainHead}>
                <div>
                    <div className={own.mainTitle}>Suggestions from students</div>
                    <div className={styles.rowMeta}>New places and changes to existing ones. Nothing shows on the map until you accept it.</div>
                </div>
            </div>
            {error && <div className={styles.error}>{error}</div>}
            {loading ? (
                <div className={styles.loading}><div className={styles.spinner} />Loading suggestions...</div>
            ) : suggestions.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyTitle}>No suggestions waiting</div>
                    <span>Students can suggest places and changes from the campus map.</span>
                </div>
            ) : (
                <div className={`${styles.feedList} ${own.placeList}`}>
                    {suggestions.map(s => <SuggestionRow key={s.id} suggestion={s} />)}
                </div>
            )}
            {reviewing && <SuggestionReview />}
        </div>
    );
}

function MapMain() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    if (ctx.selected === SUGGESTIONS) return <SuggestionsMain />;
    return <PlacesMain />;
}

function PlacesMain() {
    const { places, loading, error, selected, kind, setKind, editing, setEditing, save } = useContext(Ctx);

    const isBuilding = selected !== ALL && selected !== PINS_ONLY;
    // What the sidebar picked; the type chips narrow it further.
    const inScope = places.filter(p => (
        selected === ALL ? true : selected === PINS_ONLY ? !p.building_id : p.building_id === selected
    ));
    const shown = kind ? inScope.filter(p => p.kind === kind) : inScope;
    // A chip for every kind in this scope, plus the picked one even when the
    // scope has none of it, so it can still be turned off.
    const kinds = Object.keys(PLACE_KINDS).filter(k => k === kind || inScope.some(p => p.kind === k));
    const info = isBuilding ? BUILDINGS.find(b => b.id === selected) : null;
    const title = selected === ALL ? 'All places' : selected === PINS_ONLY ? 'Pins outside buildings' : buildingLabel(selected);
    // A new place starts in the building and type being looked at.
    const addPlace = () => setEditing({ building_id: isBuilding ? selected : null, ...(kind && { kind }) });

    const chip = (k, label, count) => {
        const on = kind === k;
        return (
            <button
                key={k || 'all'}
                type="button"
                className={`${own.kindChip} ${on ? own.kindChipOn : ''}`}
                style={k ? { '--kind': PLACE_KINDS[k].color } : undefined}
                aria-pressed={on}
                onClick={() => setKind(k)}
            >
                {k && <PlaceIcon kind={k} size={20} solid />}
                {label}
                <span className={own.kindCount}>{count}</span>
            </button>
        );
    };

    return (
        <div className={styles.feedCard}>
            <div className={own.mainHead}>
                <div>
                    <div className={own.mainTitle}>{title}</div>
                    <div className={styles.rowMeta}>
                        {isBuilding
                            ? [info?.zoneName, 'Departments, food, shops and services inside it'].filter(Boolean).join(' · ')
                            : 'Departments, food, shops and services shown on the campus map'}
                    </div>
                </div>
                <button
                    className={`${styles.btn} ${styles.btnPrimary} ${own.addBtn}`}
                    onClick={addPlace}
                >
                    Add place
                </button>
            </div>

            {!loading && kinds.length > 0 && (
                <div className={own.kindChips} role="group" aria-label="Filter by type">
                    {chip(null, 'All types', inScope.length)}
                    {kinds.map(k => chip(k, PLACE_KINDS[k].plural, inScope.filter(p => p.kind === k).length))}
                </div>
            )}

            {error && <div className={styles.error}>{error}</div>}
            {loading ? (
                <div className={styles.loading}><div className={styles.spinner} />Loading places...</div>
            ) : shown.length === 0 && kind && inScope.length > 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyTitle}>No {PLACE_KINDS[kind].plural.toLowerCase()} here</div>
                    <button type="button" className={own.linkBtn} onClick={() => setKind(null)}>Show all types</button>
                </div>
            ) : shown.length === 0 ? (
                <div className={styles.empty}>
                    <div className={styles.emptyTitle}>Nothing here yet</div>
                    <span>
                        {isBuilding
                            ? 'Add the departments, restaurants or shops inside this building.'
                            : 'Add a place, or pick a building on the left.'}
                    </span>
                </div>
            ) : (
                <div className={`${styles.feedList} ${own.placeList}`}>
                    {shown.map(p => <PlaceRow key={p.id} place={p} />)}
                </div>
            )}

            {/* The same button, floating, for screens where the header is far
                down the page. CSS shows one or the other. */}
            {createPortal(
                <button className={`${styles.btn} ${styles.btnPrimary} ${own.addFab}`} onClick={addPlace}>
                    Add place
                </button>,
                document.body,
            )}

            {editing && (
                <PlaceEditModal
                    place={editing}
                    buildings={BUILDINGS}
                    onClose={() => setEditing(null)}
                    onSave={async (draft) => { await save(draft); setEditing(null); }}
                />
            )}
        </div>
    );
}

const mapTab = { Provider: MapProvider, Sidebar: MapSidebar, Main: MapMain };
export default mapTab;
