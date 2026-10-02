"""
Builds the 3D campus map's data from the university's campus map PDF.

    pip install pymupdf pillow
    python scripts/extract_campus_map.py "path/to/UoSMap 2026.pdf"

The map on page 1 is pure vector art, so nothing is traced by hand:

  - Every building is a filled shape in its zone's colour (navy for A, blue
    for C and so on), and the label printed on it (A3, C12) names it. Those
    outlines go to src/app/map/campus.json as SVG path data, which the page
    extrudes into blocks.
  - The rest of the drawing (roads, greenery, car parks, gates) is rendered
    as the ground the blocks stand on, to public/map/ground-N.webp.
  - A square of the middle of campus becomes the home page's minimap button,
    public/map/minimap.webp.

Coordinates in the JSON are PDF points measured from the middle of the map,
with y flipped so north is +y. The page negates y back when it lays the
shapes on the ground. Re-run this when the university publishes a new map.
"""

import json
import math
import os
import re
import sys

import pymupdf
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JSON_OUT = os.path.join(ROOT, 'src', 'app', 'map', 'campus.json')
GROUND_DIR = os.path.join(ROOT, 'public', 'map')

# The map panel on page 1, legend excluded.
PANEL = pymupdf.Rect(124.8, 141.6, 257.4, 752.4)

# The minimap: the B buildings in the middle, the women's side above and the
# men's below. Map units from the panel's centre (north up), and the size of
# the square image.
MINIMAP_CENTER = (-12, -122)
MINIMAP_HALF = 46
MINIMAP_PX = 320

# Ground texture density and the tallest tile we hand a phone's GPU.
PX_PER_PT = 12
MAX_TILE_PX = 4096

# Fill colours (rounded to 2 places) that mark a building, by zone.
ZONE_COLORS = {
    (0.25, 0.23, 0.38): 'A',
    (0.95, 0.42, 0.24): 'B',
    (0.19, 0.36, 0.67): 'C',
    (0.47, 0.37, 0.28): 'D',
    (0.0, 0.75, 0.55): 'E',
    (0.3, 0.47, 0.55): 'G',
    (0.54, 0.3, 0.62): 'H',
}
# The grey blocks of the housing complexes (Al Zahrawi, Ibn Khaldun, Al
# Khawarzmi) and the medical students' dorms (F). They carry no labels.
HOUSING_COLORS = {(0.25, 0.25, 0.26), (0.3, 0.3, 0.31), (0.43, 0.43, 0.44), (0.59, 0.6, 0.61)}
# The covered walkways that join the academic buildings, one compound shape.
WALKWAY_COLOR = (0.72, 0.73, 0.74)

LABEL_RE = re.compile(r'^[A-H]\d{1,2}A?$')
# Words that may sit on a building without making it a sign or a badge.
BUILDING_WORDS = {'University', 'Hospital', 'UDHS'}


def rgb(fill):
    return tuple(round(c, 2) for c in fill)


def hex_color(fill):
    return '#' + ''.join(f'{round(c * 255):02x}' for c in fill)


def to_local(pt):
    """PDF point to map coordinates: origin at the panel's middle, y up."""
    return (round(pt.x - PANEL.x0 - PANEL.width / 2, 2),
            round(-(pt.y - PANEL.y0 - PANEL.height / 2), 2))


def path_data(drawing):
    """A get_drawings() entry as an SVG path string, in map coordinates."""
    out, here = [], None

    def move(pt):
        nonlocal here
        if here is None or abs(here.x - pt.x) > 0.01 or abs(here.y - pt.y) > 0.01:
            if out:
                out.append('Z')
            out.append('M%s %s' % to_local(pt))
        here = pt

    for item in drawing['items']:
        kind = item[0]
        if kind == 'l':
            move(item[1])
            out.append('L%s %s' % to_local(item[2]))
            here = item[2]
        elif kind == 'c':
            move(item[1])
            c1, c2, end = (to_local(p) for p in item[2:5])
            out.append('C%s %s %s %s %s %s' % (*c1, *c2, *end))
            here = item[4]
        elif kind in ('re', 'qu'):
            quad = item[1].quad if kind == 're' else item[1]
            corners = [quad.ul, quad.ur, quad.lr, quad.ll]
            if out:
                out.append('Z')
            out.append('M%s %s' % to_local(corners[0]))
            out.extend('L%s %s' % to_local(c) for c in corners[1:])
            here = None
    out.append('Z')
    return ''.join(out)


def polygon(drawing):
    """A rough outline (curves reduced to their end points), for hit tests."""
    pts = []
    for item in drawing['items']:
        if item[0] == 'l':
            pts += [item[1], item[2]]
        elif item[0] == 'c':
            pts += [item[1], item[4]]
        elif item[0] == 're':
            q = item[1].quad
            pts += [q.ul, q.ur, q.lr, q.ll]
        elif item[0] == 'qu':
            pts += [item[1].ul, item[1].ur, item[1].lr, item[1].ll]
    return pts


def inside(pt, poly):
    hit = False
    for i in range(len(poly)):
        a, b = poly[i], poly[i - 1]
        if (a.y > pt.y) != (b.y > pt.y):
            x = a.x + (pt.y - a.y) * (b.x - a.x) / (b.y - a.y)
            if pt.x < x:
                hit = not hit
    return hit


def main(pdf_path):
    page = pymupdf.open(pdf_path)[0]

    words = []
    for w in page.get_text('words'):
        rect = pymupdf.Rect(w[:4])
        if rect.intersects(PANEL):
            words.append((w[4], (rect.tl + rect.br) / 2))
    labels = [(text, centre) for text, centre in words if LABEL_RE.match(text)]

    parts = []
    for d in page.get_drawings():
        if not d['fill'] or not d['rect'].intersects(PANEL):
            continue
        colour, rect = rgb(d['fill']), d['rect']
        area = rect.width * rect.height

        if colour == WALKWAY_COLOR and area > 1000:
            parts.append({'id': 'walkways', 'kind': 'walkway', 'drawing': d})
            continue

        zone = ZONE_COLORS.get(colour)
        housing = colour in HOUSING_COLORS
        if not zone and not housing:
            continue

        # Car park badges, gate signs and compound banners share the zone
        # colours. They are the shapes with other English words printed on
        # them (the hospital also carries its name in Arabic, so that is let by).
        poly = polygon(d)
        on_it = [t for t, c in words if c in rect and inside(c, poly) and t.isascii()]
        if any(not LABEL_RE.match(t) and t not in BUILDING_WORDS for t in on_it):
            continue

        if housing:
            # The dark grey also draws the walkway outlines and the F dorms'
            # banner; only building-sized pieces are kept.
            if area > 600 or area < 2:
                continue
            fid = next((t for t in on_it if t.startswith('F')), None)
            parts.append({'id': fid, 'kind': 'dorm' if fid else 'housing', 'zone': 'F' if fid else None, 'drawing': d})
            continue

        # Too small to stand up, or a long thin sign down the map's edge.
        if area < 4 or max(rect.width, rect.height) > 8 * min(rect.width, rect.height):
            continue
        name = next((t for t in on_it if LABEL_RE.match(t)), None)
        if 'Hospital' in on_it:
            name = 'HOSPITAL'
        if name is None:
            # Annexes print no label of their own: they take the nearest
            # label of their zone, if it is close.
            centre = (rect.tl + rect.br) / 2
            near = [(abs(c - centre), t) for t, c in labels if t[0] == zone and abs(c - centre) < 9]
            name = min(near)[1] if near else None
        parts.append({'id': name, 'kind': 'building' if name else 'unnamed', 'zone': zone, 'drawing': d})

    buildings = {}
    loose = []
    for part in parts:
        d = part['drawing']
        shape = {'d': path_data(d), 'evenOdd': bool(d.get('even_odd'))}
        if part['id'] is None:
            loose.append({'kind': part['kind'], 'color': hex_color(d['fill']), **shape})
            continue
        b = buildings.setdefault(part['id'], {
            'id': part['id'],
            'kind': part['kind'],
            'zone': part.get('zone'),
            'color': hex_color(d['fill']),
            'shapes': [],
            '_rect': pymupdf.Rect(d['rect']),
        })
        b['shapes'].append(shape)
        b['_rect'] |= d['rect']

    for b in buildings.values():
        r = b.pop('_rect')
        b['center'] = list(to_local((r.tl + r.br) / 2))
        b['size'] = [round(r.width, 2), round(r.height, 2)]

    # The ground: the whole map panel, cut into tiles a phone can load.
    pix = page.get_pixmap(clip=PANEL, matrix=pymupdf.Matrix(PX_PER_PT, PX_PER_PT))
    image = Image.frombytes('RGB', (pix.width, pix.height), pix.samples)
    os.makedirs(GROUND_DIR, exist_ok=True)
    count = math.ceil(image.height / MAX_TILE_PX)
    step = math.ceil(image.height / count)
    ground = []
    for n in range(count):
        top, bottom = n * step, min(image.height, (n + 1) * step)
        image.crop((0, top, image.width, bottom)).save(
            os.path.join(GROUND_DIR, f'ground-{n}.webp'), quality=82, method=6)
        # Where the tile sits, in the same map coordinates as the buildings.
        ground.append({
            'src': f'/map/ground-{n}.webp',
            'top': round(PANEL.height / 2 - top / PX_PER_PT, 2),
            'bottom': round(PANEL.height / 2 - bottom / PX_PER_PT, 2),
        })

    mx = PANEL.x0 + PANEL.width / 2 + MINIMAP_CENTER[0]
    my = PANEL.y0 + PANEL.height / 2 - MINIMAP_CENTER[1]
    clip = pymupdf.Rect(mx - MINIMAP_HALF, my - MINIMAP_HALF, mx + MINIMAP_HALF, my + MINIMAP_HALF)
    zoom = MINIMAP_PX / clip.width
    mini = page.get_pixmap(clip=clip, matrix=pymupdf.Matrix(zoom, zoom))
    Image.frombytes('RGB', (mini.width, mini.height), mini.samples).save(
        os.path.join(GROUND_DIR, 'minimap.webp'), quality=85, method=6)

    missing = sorted({t for t, _ in labels} - set(buildings))
    data = {
        'source': os.path.basename(pdf_path),
        'width': round(PANEL.width, 2),
        'height': round(PANEL.height, 2),
        'ground': ground,
        'buildings': sorted(buildings.values(), key=lambda b: (b['id'][0], len(b['id']), b['id'])),
        'blocks': loose,
    }
    os.makedirs(os.path.dirname(JSON_OUT), exist_ok=True)
    with open(JSON_OUT, 'w', encoding='utf-8') as f:
        json.dump(data, f, separators=(',', ':'))

    print(f'{len(buildings)} buildings, {len(loose)} unlabelled blocks, {count} ground tiles of {image.width}x{step}')
    if missing:
        print('labels with no shape found:', ', '.join(missing))


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
