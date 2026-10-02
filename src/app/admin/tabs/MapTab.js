'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import campus from '@/app/map/campus.json';
import { buildingInfo } from '@/app/map/buildings';
import { PLACE_KINDS, openStatus } from '@/app/map/places';
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
    const [query, setQuery] = useState('');
    // The place in the editor: a row, a fresh draft ({}), or null when closed.
    const [editing, setEditing] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/admin/map-places');
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setPlaces(data.places || []);
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

    return (
        <Ctx.Provider value={{
            places, loading, error, counts,
            selected, setSelected, query, setQuery,
            editing, setEditing, save, toggleVisible, remove,
        }}>
            {children}
        </Ctx.Provider>
    );
}

function MapSidebar() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { places, counts, selected, setSelected, query, setQuery } = ctx;

    const q = query.trim().toLowerCase();
    const matching = BUILDINGS.filter(b => !q
        || b.id.toLowerCase().startsWith(q)
        || (b.name || '').toLowerCase().includes(q));
    // Buildings that already have places come first.
    const withPlaces = matching.filter(b => counts[b.id]);
    const without = matching.filter(b => !counts[b.id]);
    const pinsOnly = places.filter(p => !p.building_id).length;

    const entry = (id, label, count, code) => (
        <button
            key={id}
            type="button"
            className={`${styles.navBtn} ${selected === id ? styles.navBtnActive : ''}`}
            onClick={() => setSelected(id)}
        >
            <span className={own.navEntry}>
                {code && <span className={own.navCode}>{code}</span>}
                <span className={own.navName}>{label}</span>
            </span>
            {count > 0 && <span className={styles.navCount}>{count}</span>}
        </button>
    );

    return (
        <div className={styles.sidebarCard}>
            <p className={styles.sectionTitle}>Places on the map</p>
            <div className={styles.navList}>
                {entry(ALL, 'All places', places.length)}
                {entry(PINS_ONLY, 'Pins outside buildings', pinsOnly)}
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

function MapMain() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { places, loading, error, selected, editing, setEditing, save } = ctx;

    const isBuilding = selected !== ALL && selected !== PINS_ONLY;
    const shown = places.filter(p => (
        selected === ALL ? true : selected === PINS_ONLY ? !p.building_id : p.building_id === selected
    ));
    const info = isBuilding ? BUILDINGS.find(b => b.id === selected) : null;
    const title = selected === ALL ? 'All places' : selected === PINS_ONLY ? 'Pins outside buildings' : buildingLabel(selected);

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
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    onClick={() => setEditing({ building_id: isBuilding ? selected : null })}
                >
                    Add place
                </button>
            </div>

            {error && <div className={styles.error}>{error}</div>}
            {loading ? (
                <div className={styles.loading}><div className={styles.spinner} />Loading places...</div>
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
                <div className={styles.feedList}>
                    {shown.map(p => <PlaceRow key={p.id} place={p} />)}
                </div>
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
