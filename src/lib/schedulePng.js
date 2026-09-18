/**
 * A schedule as a PNG, laid out as a printable A4 sheet: a header with the
 * semester and a summary, the week's timetable, a card per section (the
 * "course registry"), and a footer.
 *
 * Drawn straight onto a canvas from the schedule's data rather than
 * screenshotting the card, so the image comes out the same on every device and
 * theme. The layout follows the design Karam supplied (course-schedule/), in
 * the app's own colors and fonts, without its lecture/lab tags, and with the
 * section number moved off the course-number line.
 */
import { decodeHtmlEntities } from '@/lib/text';

// The schedule card's course colors, in the same order. Text uses a darker
// shade of each, since amber or teal text on its own tint is hard to read.
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
const TEXT_COLORS = ['#1D4ED8', '#047857', '#B45309', '#B91C1C', '#6D28D9', '#BE185D', '#0F766E', '#C2410C'];

// Light theme values from globals.css. An image gets shared and printed, so it
// does not follow the viewer's dark mode.
const INK = '#0F1729';
const INK_SECONDARY = '#475569';
const INK_MUTED = '#94A3B8';
const INK_FAINT = '#CBD5E1';
const ACCENT_TEXT = '#047857';
const ACCENT_TINT = 'rgba(0, 195, 137, 0.12)';
const LINE = '#E2E8F0';
const LINE_SOFT = '#F1F5F9';
const PAGE = '#FFFFFF';
const CHIP_BG = '#F5F7FA';

const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

// A4 at 96 dpi. The sheet only grows taller than this when the timetable
// would otherwise squeeze a class block below what its text needs.
const PAGE_W = 794;
const PAGE_H = 1123;
const SCALE = 2.5;
const PAD_X = 38;
const PAD_TOP = 30;
const PAD_BOTTOM = 26;
const GUTTER = 52;
const DAY_HEADER = 28;
const BODY_PAD = 8;
// A 75-minute class with a two-line name needs about 100px to show everything,
// so it keeps its instructor like the one-line names do.
const MIN_PX_PER_HOUR = 82;
const DAY_START_HOUR = 8;

// Monday to Thursday are always drawn, so a free weekday shows as free; any
// other day appears only when a class meets on it.
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu'];
const ALL_DAYS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
const DAY_NAMES = { Sat: 'Saturday', Sun: 'Sunday', Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' };

const SEASONS = { 10: 'Fall', 20: 'Spring', 30: 'Summer' };

function paletteIndex(idx) {
    return (((idx || 0) % COLORS.length) + COLORS.length) % COLORS.length;
}

function withAlpha(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function clock12(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const period = h >= 12 && h < 24 ? 'PM' : 'AM';
    return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${period}`;
}

function hourLabel(h) {
    const period = h >= 12 && h < 24 ? 'PM' : 'AM';
    return `${h % 12 === 0 ? 12 : h % 12} ${period}`;
}

// "Mon/Wed 11:00-12:15" to "Mon, Wed · 11:00 AM – 12:15 PM".
function readableClassTime(classTime) {
    const m = /^(.+?)\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(String(classTime || '').trim());
    if (!m) return null;
    const days = m[1].split(/[\s/]+/).filter(Boolean).join(', ');
    return `${days} · ${clock12(+m[2] * 60 + +m[3])} – ${clock12(+m[4] * 60 + +m[5])}`;
}

// UOS term codes start with the academic year: 202610 is Fall of 2026/2027.
function academicYear(termCode) {
    const year = Number(String(termCode || '').slice(0, 4));
    return year ? `${year}/${year + 1}` : null;
}

function seasonOf(termCode, termName) {
    return SEASONS[String(termCode || '').slice(4)] || String(termName || '').split(' ')[0] || 'Semester';
}

function roundedRect(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
}

// Letter spacing where the browser supports it on canvas (not Safari); the
// text reads fine without it.
function spaced(ctx, px) {
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

// Shortens text with an ellipsis until it fits in maxWidth.
function fit(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let s = text.replace(/…$/, '');
    while (s && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
}

// Word-wraps text to maxWidth; past maxLines the last line ends in an ellipsis.
function wrap(ctx, text, maxWidth, maxLines = Infinity) {
    if (maxLines < 1) return [];
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > maxWidth) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) {
        lines.length = maxLines;
        lines[maxLines - 1] = `${lines[maxLines - 1]}…`;
    }
    return lines.map(l => fit(ctx, l, maxWidth));
}

// Small line icons from the design, drawn rather than taken from a font.
function drawClockIcon(ctx, x, y, size, color) {
    const r = size / 2;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x + r, y + r, r - 0.5, 0, Math.PI * 2);
    ctx.moveTo(x + r, y + r * 0.45);
    ctx.lineTo(x + r, y + r);
    ctx.lineTo(x + r * 1.45, y + r * 1.35);
    ctx.stroke();
    ctx.restore();
}

function drawPersonIcon(ctx, x, y, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size * 0.3, size * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + size / 2, y + size * 0.95, size * 0.42, size * 0.36, 0, Math.PI, 0);
    ctx.fill();
    ctx.restore();
}

// A pill of text with a faint fill and border, as the design uses for rooms.
function measureBadge(ctx, text) {
    return ctx.measureText(text).width + 8;
}

function drawBadge(ctx, x, y, text, color, height) {
    const w = measureBadge(ctx, text);
    roundedRect(ctx, x, y, w, height, 3);
    ctx.fillStyle = 'rgba(15, 23, 41, 0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(15, 23, 41, 0.10)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 4, y + height / 2 + 0.5);
    ctx.textBaseline = 'top';
    return w;
}

const F = {
    badge: `700 9px ${SANS}`,
    title: `800 36px ${SANS}`,
    program: `500 12.5px ${SANS}`,
    pillLabel: `700 10.5px ${SANS}`,
    pillSub: `500 8px ${SANS}`,
    deco: `600 8px ${SANS}`,
    dayHeader: `700 9.5px ${SANS}`,
    freeTag: `700 7px ${SANS}`,
    hour: `500 9px ${SANS}`,
    code: `700 9.5px ${MONO}`,
    name: `800 11px ${SANS}`,
    detail: `600 9.5px ${SANS}`,
    blockBadge: `700 8.5px ${SANS}`,
    legendTitle: `700 9.5px ${SANS}`,
    legendCredits: `500 9.5px ${SANS}`,
    cardName: `700 10.5px ${SANS}`,
    chip: `600 8.5px ${SANS}`,
    cardInstructor: `500 9px ${SANS}`,
    footer: `500 8.5px ${SANS}`,
};

/**
 * What one class block shows, fitted to its height.
 *
 * The top holds the course code, the name and the instructor; the bottom holds
 * the time and a row of badges (section, room). When the block is short, parts
 * go in this order: the divider, the instructor, the second name line, the
 * badges. The code, the first name line and the time always stay.
 */
function planBlock(ctx, block, innerW, innerH) {
    ctx.font = F.name;
    const nameLines = block.courseName ? wrap(ctx, block.courseName, innerW, 2) : [];
    const parts = {
        code: 12,
        name0: nameLines[0] ? 14 : 0,
        name1: nameLines[1] ? 13 : 0,
        divider: 7,
        instructor: block.instructor ? 13 : 0,
        time: 13,
        badges: (block.sectionNum || block.location) ? 16 : 0,
    };
    const dropOrder = ['divider', 'instructor', 'name1', 'badges'];
    const total = () => Object.values(parts).reduce((a, b) => a + b, 0);
    for (const key of dropOrder) {
        if (total() <= innerH) break;
        parts[key] = 0;
    }
    // Without the instructor there is nothing for the divider to separate.
    if (!parts.instructor) parts.divider = 0;
    return { parts, nameLines };
}

function drawBlock(ctx, block, x, y, w, h) {
    const idx = paletteIndex(block.colorIdx);
    const color = COLORS[idx];
    const text = TEXT_COLORS[idx];

    ctx.save();
    // A soft drop shadow, as in the design.
    ctx.shadowColor = 'rgba(15, 23, 41, 0.08)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 1.5;
    roundedRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = PAGE;
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundedRect(ctx, x, y, w, h, 6);
    ctx.fillStyle = withAlpha(color, 0.12);
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 3, h);

    const tx = x + 9;
    const tw = w - 14;
    const top = y + 5;
    const { parts, nameLines } = planBlock(ctx, block, tw, h - 10);

    let cy = top;
    ctx.fillStyle = withAlpha(text, 0.75);
    ctx.font = F.code;
    spaced(ctx, 0.5);
    ctx.fillText(fit(ctx, block.courseId, tw), tx, cy);
    spaced(ctx, 0);
    cy += parts.code;

    ctx.fillStyle = text;
    ctx.font = F.name;
    if (parts.name0) {
        const first = parts.name1 || !nameLines[1] ? nameLines[0] : fit(ctx, `${nameLines[0]}…`, tw);
        ctx.fillText(first, tx, cy);
        cy += parts.name0;
    }
    if (parts.name1) {
        ctx.fillText(nameLines[1], tx, cy);
        cy += parts.name1;
    }
    if (parts.divider) {
        ctx.fillStyle = withAlpha(text, 0.15);
        ctx.fillRect(tx, cy + 2, tw, 1);
        cy += parts.divider;
    }
    if (parts.instructor) {
        ctx.font = F.detail;
        drawPersonIcon(ctx, tx, cy + 1, 8, withAlpha(text, 0.7));
        ctx.fillStyle = withAlpha(text, 0.85);
        ctx.fillText(fit(ctx, decodeHtmlEntities(block.instructor), tw - 12), tx + 12, cy);
    }

    // The time and badges sit at the bottom of the block.
    let by = y + h - 5;
    if (parts.badges) {
        by -= 14;
        ctx.font = F.blockBadge;
        let bx = tx;
        const items = [block.sectionNum && `Sec ${block.sectionNum}`, block.location].filter(Boolean);
        for (const item of items) {
            const label = fit(ctx, item, tw - (bx - tx) - 8);
            if (bx + measureBadge(ctx, label) > tx + tw + 0.5) break;
            bx += drawBadge(ctx, bx, by, label, text, 14) + 4;
        }
        by -= 2;
    }
    by -= 12;
    ctx.font = F.detail;
    drawClockIcon(ctx, tx, by + 1.5, 8, withAlpha(text, 0.7));
    ctx.fillStyle = withAlpha(text, 0.75);
    ctx.fillText(fit(ctx, `${clock12(block.start)} – ${clock12(block.end)}`, tw - 12), tx + 12, by);
    ctx.restore();
}

/**
 * Lays out one registry card: the course name, a row of chips and the
 * instructor. Returns the height it needs; `draw` is false when measuring.
 */
function registryCard(ctx, entry, x, y, w, draw) {
    const idx = paletteIndex(entry.colorIdx);
    const inner = w - 4 - 12;
    const cx = x + 4 + 6;
    let cy = y + 6;

    ctx.font = F.cardName;
    const nameLines = wrap(ctx, entry.courseName || entry.courseId, inner, 2);

    ctx.font = F.chip;
    const chips = [
        entry.courseId,
        entry.crn && `CRN ${entry.crn}`,
        entry.sectionNum && `Sec ${entry.sectionNum}`,
        entry.location,
        entry.credits ? `${entry.credits} cr` : null,
        readableClassTime(entry.classTime) || 'No set time',
    ].filter(Boolean);
    const chipH = 14;
    const rows = [[]];
    let rowW = 0;
    for (const chip of chips) {
        const label = fit(ctx, chip, inner - 8);
        const cw = ctx.measureText(label).width + 8;
        if (rowW && rowW + cw > inner) { rows.push([]); rowW = 0; }
        rows[rows.length - 1].push({ label, cw });
        rowW += cw + 3;
    }

    const height = 6 + nameLines.length * 13 + 3 + rows.length * (chipH + 3) + (entry.instructor ? 13 : 0) + 5;
    if (!draw) return height;

    roundedRect(ctx, x, y, w, height, 4);
    ctx.fillStyle = PAGE;
    ctx.fill();
    ctx.strokeStyle = withAlpha(COLORS[idx], 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.save();
    roundedRect(ctx, x, y, w, height, 4);
    ctx.clip();
    ctx.fillStyle = COLORS[idx];
    ctx.fillRect(x, y, 4, height);
    ctx.restore();

    ctx.fillStyle = INK;
    ctx.font = F.cardName;
    nameLines.forEach(line => { ctx.fillText(line, cx, cy); cy += 13; });
    cy += 3;

    ctx.font = F.chip;
    for (const row of rows) {
        let chipX = cx;
        for (const { label, cw } of row) {
            roundedRect(ctx, chipX, cy, cw, chipH, 3);
            ctx.fillStyle = CHIP_BG;
            ctx.fill();
            ctx.strokeStyle = LINE;
            ctx.stroke();
            ctx.fillStyle = INK_SECONDARY;
            ctx.textBaseline = 'middle';
            ctx.fillText(label, chipX + 4, cy + chipH / 2 + 0.5);
            ctx.textBaseline = 'top';
            chipX += cw + 3;
        }
        cy += chipH + 3;
    }

    if (entry.instructor) {
        ctx.fillStyle = INK_SECONDARY;
        ctx.font = F.cardInstructor;
        ctx.fillText(fit(ctx, decodeHtmlEntities(entry.instructor), inner), cx, cy + 1);
    }
    return height;
}

function drawSheet(sheet) {
    const { blocks, entries } = sheet;
    const measure = document.createElement('canvas').getContext('2d');
    const contentW = PAGE_W - PAD_X * 2;

    // ── Days and hours ──
    const used = new Set(blocks.map(b => b.day));
    const days = ALL_DAYS.filter(d => WEEKDAYS.includes(d) || used.has(d));
    const freeDays = days.filter(d => !used.has(d));
    // An hour of margin either side, but never before 8 AM unless a class is.
    const firstHour = Math.floor(Math.min(...blocks.map(b => b.start)) / 60);
    const startHour = Math.min(firstHour, Math.max(DAY_START_HOUR, firstHour - 1));
    const endHour = Math.min(24, Math.ceil(Math.max(...blocks.map(b => b.end)) / 60) + 1);
    const hours = endHour - startHour;

    // ── Registry cards, three to a row ──
    const cols = 3;
    const cardGap = 5;
    const cardW = (contentW - cardGap * (cols - 1)) / cols;
    const cardRows = [];
    entries.forEach((entry, i) => {
        if (i % cols === 0) cardRows.push([]);
        cardRows[cardRows.length - 1].push({ entry, h: registryCard(measure, entry, 0, 0, cardW, false) });
    });
    const rowHeights = cardRows.map(row => Math.max(...row.map(c => c.h)));
    const legendH = 12 + 18 + rowHeights.reduce((a, b) => a + b + cardGap, 0);

    // ── Vertical budget ──
    const headerH = 92;
    const footerH = 24;
    const fixed = PAD_TOP + headerH + 12 + DAY_HEADER + BODY_PAD * 2 + legendH + footerH + PAD_BOTTOM;
    const pxPerHour = Math.max(MIN_PX_PER_HOUR, (PAGE_H - fixed) / hours);
    const gridBodyH = hours * pxPerHour + BODY_PAD * 2;
    const pageH = Math.ceil(fixed - BODY_PAD * 2 + gridBodyH);

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(PAGE_W * SCALE);
    canvas.height = Math.round(pageH * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = 'top';
    ctx.fillStyle = PAGE;
    ctx.fillRect(0, 0, PAGE_W, pageH);

    // ── Header ──
    let y = PAD_TOP;
    const season = seasonOf(sheet.termCode, sheet.termName);
    const ay = academicYear(sheet.termCode);
    const badgeText = `${season} Semester${ay ? ` ${ay}` : ''}`.toUpperCase();
    ctx.font = F.badge;
    spaced(ctx, 1);
    const badgeW = ctx.measureText(badgeText).width + 14;
    roundedRect(ctx, PAD_X, y, badgeW, 17, 3);
    ctx.fillStyle = ACCENT_TINT;
    ctx.fill();
    ctx.fillStyle = ACCENT_TEXT;
    ctx.textBaseline = 'middle';
    ctx.fillText(badgeText, PAD_X + 7, y + 9);
    ctx.textBaseline = 'top';
    spaced(ctx, 0);

    ctx.fillStyle = INK;
    ctx.font = F.title;
    spaced(ctx, -1);
    ctx.fillText('Course Schedule', PAD_X, y + 24);
    spaced(ctx, 0);
    if (sheet.programName) {
        ctx.fillStyle = INK_SECONDARY;
        ctx.font = F.program;
        ctx.fillText(fit(ctx, sheet.programName, contentW - 260), PAD_X, y + 66);
    }

    // Summary pills, two by two on the right.
    const courseCount = new Set(entries.map(e => e.courseId)).size;
    const credits = entries.reduce((sum, e) => sum + (e.credits || 0), 0);
    const activeDays = days.filter(d => used.has(d));
    const pills = [
        { icon: '◼', label: `${courseCount} ${courseCount === 1 ? 'Course' : 'Courses'}`, sub: 'this schedule' },
        { icon: '◈', label: credits ? `${credits} Credits` : 'Credits', sub: 'total load' },
        {
            icon: '◷',
            label: activeDays.length >= 3 && activeDays.every((d, i) => i === 0 || ALL_DAYS.indexOf(d) === ALL_DAYS.indexOf(activeDays[i - 1]) + 1)
                ? `${activeDays[0]} – ${activeDays[activeDays.length - 1]}`
                : activeDays.join(', '),
            sub: 'on campus',
        },
        {
            icon: '✦',
            label: freeDays.length === 0 ? 'No free day' : freeDays.length === 1 ? `${DAY_NAMES[freeDays[0]]} free` : `${freeDays.join(', ')} free`,
            sub: freeDays.length ? 'no classes' : 'every weekday',
        },
    ];
    const pillW = 118;
    const pillH = 30;
    const pillsX = PAGE_W - PAD_X - pillW * 2 - 5;
    pills.forEach((pill, i) => {
        const px = pillsX + (i % 2) * (pillW + 5);
        const py = y + Math.floor(i / 2) * (pillH + 5);
        roundedRect(ctx, px, py, pillW, pillH, 6);
        ctx.fillStyle = PAGE;
        ctx.fill();
        ctx.strokeStyle = LINE;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.fillStyle = ACCENT_TEXT;
        ctx.font = `700 12px ${SANS}`;
        ctx.fillText(pill.icon, px + 8, py + 8);
        ctx.fillStyle = INK;
        ctx.font = F.pillLabel;
        ctx.fillText(fit(ctx, pill.label, pillW - 32), px + 26, py + 5);
        ctx.fillStyle = INK_MUTED;
        ctx.font = F.pillSub;
        ctx.fillText(pill.sub, px + 26, py + 18);
    });
    if (ay) {
        const decoY = y + pillH * 2 + 5 + 10;
        ctx.font = F.deco;
        spaced(ctx, 1.2);
        const label = `AY ${ay.replace('/', '-')}`;
        const lw = ctx.measureText(label).width;
        const right = PAGE_W - PAD_X;
        ctx.fillStyle = INK_MUTED;
        ctx.globalAlpha = 0.6;
        ctx.fillRect(right - 18, decoY + 4, 18, 1);
        ctx.fillText(label, right - 18 - 6 - lw, decoY);
        ctx.fillRect(right - 18 - 6 - lw - 6 - 18, decoY + 4, 18, 1);
        ctx.globalAlpha = 1;
        spaced(ctx, 0);
    }

    y += headerH;
    ctx.fillStyle = INK;
    ctx.fillRect(PAD_X, y, contentW, 1.5);
    y += 12;

    // ── Timetable ──
    const gridX = PAD_X + GUTTER;
    const gridW = contentW - GUTTER;
    const colW = gridW / days.length;
    const gridTop = y;
    const bodyTop = gridTop + DAY_HEADER;
    const hourY = (h) => bodyTop + BODY_PAD + (h - startHour) * pxPerHour;

    ctx.save();
    roundedRect(ctx, gridX, gridTop, gridW, DAY_HEADER + gridBodyH, 6);
    ctx.fillStyle = PAGE;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = LINE_SOFT;
    ctx.fillRect(gridX, gridTop, gridW, DAY_HEADER);
    ctx.fillStyle = LINE;
    ctx.fillRect(gridX, bodyTop - 1.5, gridW, 1.5);

    for (let h = startHour; h <= endHour; h++) {
        ctx.fillStyle = LINE;
        ctx.fillRect(gridX, hourY(h), gridW, 1);
        if (h < endHour) {
            ctx.fillStyle = LINE_SOFT;
            ctx.fillRect(gridX, hourY(h) + pxPerHour / 2, gridW, 1);
        }
    }

    days.forEach((day, i) => {
        const colX = gridX + i * colW;
        if (i > 0) {
            ctx.fillStyle = LINE;
            ctx.fillRect(colX, gridTop, 1, DAY_HEADER + gridBodyH);
        }
        const free = !used.has(day);
        ctx.font = F.dayHeader;
        spaced(ctx, 1);
        const label = day.toUpperCase();
        const lw = ctx.measureText(label).width;
        let tagW = 0;
        if (free) {
            ctx.font = F.freeTag;
            tagW = ctx.measureText('FREE').width + 8 + 5;
        }
        const startX = colX + (colW - lw - tagW) / 2;
        ctx.font = F.dayHeader;
        ctx.fillStyle = free ? INK_FAINT : INK_SECONDARY;
        ctx.fillText(label, startX, gridTop + 10);
        if (free) {
            ctx.font = F.freeTag;
            const tx = startX + lw + 5;
            roundedRect(ctx, tx, gridTop + 8, tagW - 5, 12, 2);
            ctx.strokeStyle = LINE;
            ctx.stroke();
            ctx.fillStyle = INK_MUTED;
            ctx.fillText('FREE', tx + 4, gridTop + 11);
        }
        spaced(ctx, 0);
    });

    blocks.forEach(block => {
        const col = days.indexOf(block.day);
        if (col === -1) return;
        const bx = gridX + col * colW + 3;
        const top = hourY(startHour) + (block.start - startHour * 60) / 60 * pxPerHour + 1;
        const height = (block.end - block.start) / 60 * pxPerHour - 2;
        drawBlock(ctx, block, bx, top, colW - 6, height);
    });
    ctx.restore();

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    roundedRect(ctx, gridX + 0.5, gridTop + 0.5, gridW - 1, DAY_HEADER + gridBodyH - 1, 6);
    ctx.stroke();

    // Hour labels in the gutter, centred on their lines.
    ctx.font = F.hour;
    ctx.fillStyle = INK_MUTED;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let h = startHour; h <= endHour; h++) ctx.fillText(hourLabel(h), gridX - 7, hourY(h));
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    y = bodyTop + gridBodyH + 12;

    // ── Course registry ──
    ctx.fillStyle = LINE;
    ctx.fillRect(PAD_X, y, contentW, 1);
    y += 12;
    ctx.fillStyle = INK_SECONDARY;
    ctx.font = F.legendTitle;
    spaced(ctx, 1.2);
    ctx.fillText('COURSE REGISTRY', PAD_X, y);
    spaced(ctx, 0);
    ctx.fillStyle = INK_MUTED;
    ctx.font = F.legendCredits;
    ctx.textAlign = 'right';
    ctx.fillText(`Total: ${credits} credit hours · ${courseCount} ${courseCount === 1 ? 'course' : 'courses'}`, PAGE_W - PAD_X, y);
    ctx.textAlign = 'left';
    y += 18;

    cardRows.forEach((row, r) => {
        row.forEach(({ entry }, c) => registryCard(ctx, entry, PAD_X + c * (cardW + cardGap), y, cardW, true));
        y += rowHeights[r] + cardGap;
    });

    // ── Footer ──
    y = pageH - PAD_BOTTOM - footerH + 6;
    ctx.fillStyle = LINE;
    ctx.fillRect(PAD_X, y, contentW, 1);
    y += 10;
    ctx.font = F.footer;
    ctx.fillStyle = INK_MUTED;
    ctx.fillText(`Made with CourseMate · ${season}${ay ? ` ${ay}` : ''}`, PAD_X, y);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK_FAINT;
    ctx.fillText('◆', PAGE_W / 2, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = INK_MUTED;
    ctx.fillText('Seats and times can change; check Banner before you register', PAGE_W - PAD_X, y);
    ctx.textAlign = 'left';

    return canvas;
}

async function deliver(blob, fileName, title) {
    const file = new File([blob], fileName, { type: 'image/png' });
    // On a phone the share sheet is how an image reaches the photo library;
    // a plain download there ends up in Files.
    const touch = window.matchMedia?.('(pointer: coarse)').matches;
    if (touch && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title });
            return;
        } catch (err) {
            if (err?.name === 'AbortError') return;
            // Anything else (the browser refusing to share) falls back to a download.
        }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function renderBlob(sheet) {
    // The page already uses these fonts; waiting makes sure the canvas does too.
    if (document.fonts?.load) {
        await Promise.all(Object.values(F).map(f => document.fonts.load(f).catch(() => null)));
    }
    const canvas = drawSheet(sheet);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The browser could not create the image.');
    return blob;
}

/**
 * Draws the schedule sheet and saves it as a PNG.
 *
 * sheet: {
 *   termCode, termName, programName,
 *   blocks:  [{ day, start, end, courseId, courseName, sectionNum, instructor, location, colorIdx }]
 *            one per meeting, with start and end in minutes after midnight,
 *   entries: [{ courseId, courseName, sectionNum, crn, classTime, instructor, location, credits, colorIdx }]
 *            one per section, for the registry; credits only on a course's first section,
 * }
 * title names the image in the share sheet.
 */
export async function downloadSchedulePng({ title, fileName, ...sheet }) {
    if (!sheet.blocks?.length) return;
    await deliver(await renderBlob(sheet), fileName, title);
}

/**
 * Copies the schedule sheet to the clipboard, ready to paste into a chat.
 *
 * Returns 'copied', or 'unsupported' when the browser has no image clipboard
 * (Firefox, and any page not served over HTTPS), so the caller can offer the
 * download instead.
 */
export async function copySchedulePng(sheet) {
    if (!sheet.blocks?.length) return 'unsupported';
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return 'unsupported';
    // Safari only allows a write during the click that asked for it, so the
    // item takes the promise rather than a blob awaited first.
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderBlob(sheet) })]);
    return 'copied';
}
