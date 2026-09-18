/**
 * A schedule as a PNG, laid out as a printable A4 sheet: the week's timetable
 * filling the page, with a one-line footer.
 *
 * Drawn straight onto a canvas from the schedule's data rather than
 * screenshotting the card, so the image comes out the same on every device and
 * theme. The blocks follow the design Karam supplied (course-schedule/), in
 * the app's own colors and fonts, without its lecture/lab tags, and with the
 * section number moved off the course-number line. That design's header and
 * course registry were dropped at his request.
 */
import { decodeHtmlEntities } from '@/lib/text';

// The schedule card's course colors, in the same order. Text uses a darker
// shade of each, since amber or teal text on its own tint is hard to read.
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
const TEXT_COLORS = ['#1D4ED8', '#047857', '#B45309', '#B91C1C', '#6D28D9', '#BE185D', '#0F766E', '#C2410C'];

// Light theme values from globals.css. An image gets shared and printed, so it
// does not follow the viewer's dark mode.
const INK_SECONDARY = '#475569';
const INK_MUTED = '#94A3B8';
const INK_FAINT = '#CBD5E1';
const LINE = '#E2E8F0';
const LINE_SOFT = '#F1F5F9';
const PAGE = '#FFFFFF';

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
    dayHeader: `700 9.5px ${SANS}`,
    freeTag: `700 7px ${SANS}`,
    hour: `500 9px ${SANS}`,
    code: `700 9.5px ${MONO}`,
    name: `800 11px ${SANS}`,
    detail: `600 9.5px ${SANS}`,
    blockBadge: `700 8.5px ${SANS}`,
    note: `500 9.5px ${SANS}`,
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

function drawSheet(sheet) {
    const { blocks, entries } = sheet;
    const measure = document.createElement('canvas').getContext('2d');
    const contentW = PAGE_W - PAD_X * 2;

    // ── Days and hours ──
    const used = new Set(blocks.map(b => b.day));
    const days = ALL_DAYS.filter(d => WEEKDAYS.includes(d) || used.has(d));
    // An hour of margin either side, but never before 8 AM unless a class is.
    const firstHour = Math.floor(Math.min(...blocks.map(b => b.start)) / 60);
    const startHour = Math.min(firstHour, Math.max(DAY_START_HOUR, firstHour - 1));
    const endHour = Math.min(24, Math.ceil(Math.max(...blocks.map(b => b.end)) / 60) + 1);
    const hours = endHour - startHour;

    // A section with no set time has no block, so it gets a line under the
    // grid rather than vanishing from the sheet.
    measure.font = F.note;
    const unscheduled = entries.filter(e => !/\d{1,2}:\d{2}/.test(e.classTime || ''));
    const noteLines = unscheduled.length
        ? wrap(measure, `No set time: ${unscheduled.map(e => [e.courseId, e.courseName, e.sectionNum && `Sec ${e.sectionNum}`].filter(Boolean).join(' ')).join(' · ')}`, contentW)
        : [];

    // ── Vertical budget: the timetable takes whatever A4 leaves ──
    const footerH = 24;
    const noteH = noteLines.length ? 10 + noteLines.length * 14 : 0;
    const fixed = PAD_TOP + DAY_HEADER + BODY_PAD * 2 + noteH + footerH + PAD_BOTTOM;
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

    // ── Timetable ──
    const gridX = PAD_X + GUTTER;
    const gridW = contentW - GUTTER;
    const colW = gridW / days.length;
    const gridTop = PAD_TOP;
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

    let y = bodyTop + gridBodyH + 10;
    if (noteLines.length) {
        ctx.font = F.note;
        ctx.fillStyle = INK_SECONDARY;
        noteLines.forEach(line => { ctx.fillText(line, PAD_X, y); y += 14; });
    }

    // ── Footer ──
    const season = seasonOf(sheet.termCode, sheet.termName);
    const ay = academicYear(sheet.termCode);
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
 *   termCode, termName (for the footer),
 *   blocks:  [{ day, start, end, courseId, courseName, sectionNum, instructor, location, colorIdx }]
 *            one per meeting, with start and end in minutes after midnight,
 *   entries: [{ courseId, courseName, sectionNum, classTime }]
 *            one per section; those with no set time are listed under the grid,
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
