'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import RoomLink from '@/components/RoomLink';
import { buildingInfo, buildingOfRoom, fromOldCode } from '@/app/map/buildings';
import { Timetable } from './UserSchedulesModal';
import styles from '../admin.module.css';
import own from './MapTab.module.css';

// "A3-007", "a3 007" and "A3007" all find the same room.
const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const Ctx = createContext(null);

function RoomsProvider({ children }) {
    const [sections, setSections] = useState([]);
    const [courseMap, setCourseMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selected, setSelected] = useState(null);
    const [query, setQuery] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch('/api/admin/rooms');
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();
                setSections(data.sections || []);
                setCourseMap(data.courseMap || {});
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Room code to its sections, rooms in natural order (A3-007 before A12-004).
    const rooms = useMemo(() => {
        const byRoom = new Map();
        for (const s of sections) {
            const room = s.location.trim();
            if (!byRoom.has(room)) byRoom.set(room, []);
            byRoom.get(room).push(s);
        }
        for (const list of byRoom.values()) {
            list.sort((a, b) => a.course_id.localeCompare(b.course_id) || a.section_num.localeCompare(b.section_num, undefined, { numeric: true }));
        }
        return new Map([...byRoom].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })));
    }, [sections]);

    return (
        <Ctx.Provider value={{ rooms, courseMap, loading, error, selected, setSelected, query, setQuery }}>
            {children}
        </Ctx.Provider>
    );
}

function RoomsSidebar() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { rooms, loading, selected, setSelected, query, setQuery } = ctx;

    const q = squash(query);
    // An old building code ("M10-102", "w8 004") finds the room in the
    // building that replaced it (A12-102, C14-W8-004). No room today starts
    // with M or W, so plain text matching would only find stray hits like
    // "COM106" for "M10".
    const old = /^\s*([MW]\d{1,2}[A-H]?)\b[\s-]*(.*)$/i.exec(query);
    const now = old && fromOldCode(old[1]);
    const matches = (room) => (now
        ? now.includes(buildingOfRoom(room)) && squash(room.replace(/^[^-]+-/, '')).includes(squash(old[2]))
        : squash(room).includes(q));
    const matching = [...rooms].filter(([room]) => matches(room));

    return (
        <div className={styles.sidebarCard}>
            <p className={styles.sectionTitle}>Rooms</p>
            <input
                className={styles.input}
                placeholder="Find a room, like A3-007 or M3-007"
                value={query}
                onChange={e => setQuery(e.target.value)}
            />
            {now && (
                <div className={styles.rowMeta} style={{ marginTop: 6 }}>
                    {old[1].toUpperCase()} is now {now.join(', ')}
                </div>
            )}
            <div className={`${styles.navList} ${own.buildingList}`}>
                {!loading && matching.length === 0 && <div className={styles.rowMeta}>No room matches.</div>}
                {matching.map(([room, list]) => (
                    <button
                        key={room}
                        type="button"
                        className={`${styles.navBtn} ${selected === room ? styles.navBtnActive : ''}`}
                        onClick={() => setSelected(room)}
                    >
                        <span className={own.navName}>{room}</span>
                        <span className={styles.navCount}>{list.length}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function RoomsMain() {
    const ctx = useContext(Ctx);
    if (!ctx) return null;
    const { rooms, courseMap, loading, error, selected } = ctx;
    const list = (selected && rooms.get(selected)) || [];

    // One timetable colour per course, as on a student's schedule.
    const groups = [];
    for (const s of list) {
        const group = groups.find(g => g.courseId === s.course_id);
        if (group) group.sections.push(s);
        else groups.push({ courseId: s.course_id, sections: [s] });
    }

    const code = selected && buildingOfRoom(selected);
    const building = code && buildingInfo(code);

    return (
        <div className={styles.feedCard}>
            {error && <div className={styles.error}>{error}</div>}
            {loading ? (
                <div className={styles.loading}><div className={styles.spinner} />Loading rooms...</div>
            ) : !selected ? (
                <div className={styles.empty}>
                    <div className={styles.emptyTitle}>Pick a room</div>
                    <span>Its week of classes this term shows here, like a student&apos;s schedule.</span>
                </div>
            ) : (
                <>
                    <div className={own.mainHead} style={{ flexWrap: 'wrap' }}>
                        <div>
                            <div className={own.mainTitle}>{selected}</div>
                            <div className={styles.rowMeta}>
                                {[building?.name, `${list.length} section${list.length === 1 ? '' : 's'} this term`].filter(Boolean).join(' · ')}
                            </div>
                        </div>
                        <RoomLink room={selected} />
                    </div>

                    <Timetable schedule={groups} courseMap={courseMap} />

                    <div className={styles.feedList} style={{ marginTop: 14 }}>
                        {list.map(s => (
                            <div key={s.crn} className={styles.row}>
                                <div className={styles.rowMain}>
                                    <div className={styles.rowTitle}>
                                        {s.course_id}
                                        {courseMap[s.course_id]?.name && ` · ${courseMap[s.course_id].name}`}
                                        <span className={styles.badge}>Section {s.section_num}</span>
                                    </div>
                                    <div className={styles.rowMeta}>
                                        {[s.class_time || 'No time set', s.instructor, `CRN ${s.crn}`].filter(Boolean).join(' · ')}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

const roomsTab = { Provider: RoomsProvider, Sidebar: RoomsSidebar, Main: RoomsMain };
export default roomsTab;
