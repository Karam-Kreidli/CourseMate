import * as THREE from 'three';
import campus from './campus.json';
import { buildingInfo } from './buildings';

/*
 * Where the camera goes. Kept apart from the scene, which only loads in the
 * browser, so the page can import these while it renders on the server.
 *
 * campus.json is in map units with north as +y. The scene lays the map on
 * the ground plane, so a map point (x, y) sits at world (x, 0, -y).
 */
const toWorld = ([x, y], height = 0) => new THREE.Vector3(x, height, -y);

export const OVERVIEW_DISTANCE = 480;

export function findBuilding(id) {
    return campus.buildings.find(b => b.id === id) || null;
}

export const BUILDING_IDS = campus.buildings.filter(b => b.kind !== 'walkway').map(b => b.id);

/**
 * buildingInfo() plus a height for the buildings the legend doesn't name:
 * the bigger the footprint, the taller, so D1 doesn't lie flat.
 */
export function sizedInfo(b) {
    const info = buildingInfo(b.id);
    if (info.height == null) info.height = THREE.MathUtils.clamp(Math.min(...b.size) * 0.22, 1.4, 3);
    return info;
}

/**
 * Where the camera should look to show one building, in world units. With
 * panelBelow (a phone, where the building's panel covers the lower part of
 * the map) it aims a little south, which lifts the building up the screen.
 */
export function focusOnBuilding(id, { panelBelow = false } = {}) {
    const b = findBuilding(id);
    if (!b) return null;
    const info = sizedInfo(b);
    const distance = THREE.MathUtils.clamp(Math.max(...b.size) * 3.6, 58, 130);
    const target = toWorld(b.center, info.height / 2);
    if (panelBelow) target.z += distance * 0.22;
    return { target, distance };
}

/** Where the camera should look to show a pinned place. */
export function focusOnPin(x, y, { panelBelow = false } = {}) {
    const distance = 62;
    const target = toWorld([x, y]);
    if (panelBelow) target.z += distance * 0.22;
    return { target, distance };
}

/** The middle of a zone's buildings, and how far back to stand to see them all. */
export function focusOnZone(zone) {
    const list = campus.buildings.filter(b => (zone === 'E' ? b.id === 'HOSPITAL' || b.id[0] === 'E' : b.id[0] === zone));
    if (list.length === 0) return null;
    const box = new THREE.Box2();
    for (const b of list) {
        box.expandByPoint(new THREE.Vector2(b.center[0] - b.size[0] / 2, b.center[1] - b.size[1] / 2));
        box.expandByPoint(new THREE.Vector2(b.center[0] + b.size[0] / 2, b.center[1] + b.size[1] / 2));
    }
    const c = box.getCenter(new THREE.Vector2());
    const s = box.getSize(new THREE.Vector2());
    return { target: toWorld([c.x, c.y]), distance: THREE.MathUtils.clamp(Math.max(s.x, s.y) * 1.25, 60, 420) };
}

/**
 * The view that takes in a set of map points ([x, y]), like every coffee shop
 * when that filter is switched on. A single point gets a close look.
 */
export function focusOnPoints(points, { panelBelow = false } = {}) {
    if (points.length === 0) return null;
    const box = new THREE.Box2();
    for (const [x, y] of points) box.expandByPoint(new THREE.Vector2(x, y));
    const c = box.getCenter(new THREE.Vector2());
    const s = box.getSize(new THREE.Vector2());
    const distance = THREE.MathUtils.clamp(Math.max(s.x, s.y) * 1.5 + 40, 62, 420);
    const target = toWorld([c.x, c.y]);
    if (panelBelow) target.z += distance * 0.22;
    return { target, distance };
}

export function overview() {
    return { target: new THREE.Vector3(0, 0, 0), distance: OVERVIEW_DISTANCE };
}
