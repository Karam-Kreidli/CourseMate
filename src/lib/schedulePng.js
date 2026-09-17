/**
 * A schedule as a PNG. Drawn straight onto a canvas from the schedule's data
 * rather than screenshotting the card, so the image comes out the same on every
 * device and theme. Just the timetable: each class block shows the course
 * code, name, room and instructor.
 */
import { decodeHtmlEntities } from '@/lib/text';

// The schedule card's course colors, in the same order. Text uses a darker
// shade of each, since amber or teal text on its own tint is hard to read.
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
const TEXT_COLORS = ['#1D4ED8', '#047857', '#B45309', '#B91C1C', '#6D28D9', '#BE185D', '#0F766E', '#C2410C'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

// Light theme values from globals.css. An image gets shared and printed, so it
// does not follow the viewer's dark mode.
const INK = '#0F1729';
const INK_SECONDARY = '#475569';
const INK_MUTED = '#94A3B8';
const LINE = '#E2E8F0';
const LINE_SOFT = '#F1F5F9';
const PAGE = '#F5F7FA';
const PANEL = '#FFFFFF';

const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

const SCALE = 2;
const PAD = 36;
const AXIS = 56;
const DAY_HEADER = 40;
// Space above the first hour line and below the last, so their labels are not
// cut in half by the panel's edges.
const BODY_PAD = 12;
// Columns keep one width, so the image only gets wider with more days.
const COL_W = 160;
// A 75-minute class is 120px: room for the code, a two-line name, the room
// and the instructor, with space between them.
const PX_PER_MIN = 1.6;

function paletteIndex(idx) {
    return (((idx || 0) % COLORS.length) + COLORS.length) % COLORS.length;
}

function withAlpha(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function hourLabel(h) {
    const period = h >= 12 && h < 24 ? 'PM' : 'AM';
    const display = h % 12 === 0 ? 12 : h % 12;
    return `${display} ${period}`;
}

function roundedRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
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

const ID_FONT = `700 13px ${MONO}`;
const NAME_FONT = `600 12px ${SANS}`;
const DETAIL_FONT = `500 11.5px ${SANS}`;
const FOOTER_FONT = `500 11px ${SANS}`;
const FOOTER = 'Made with CourseMate. Seats and times can change, so check Banner before you register.';
// Text is drawn 15px tall; `gap` is the space above a line.
const TEXT_H = 15;

/**
 * The lines one class block shows. When the block is too short for all of
 * them, lines are kept in priority order (code, first name line, room,
 * instructor, second name line) and then drawn in reading order.
 */
function blockLines(ctx, block, textWidth, room) {
    ctx.font = NAME_FONT;
    const nameLines = block.courseName ? wrap(ctx, block.courseName, textWidth, 2) : [];
    const lines = [
        { key: 'id', order: 0, priority: 0, gap: 0, text: block.courseId, font: ID_FONT, color: TEXT_COLORS[paletteIndex(block.colorIdx)] },
        { key: 'name0', order: 1, priority: 1, gap: 5, text: nameLines[0], font: NAME_FONT, color: INK },
        { key: 'name1', order: 2, priority: 4, gap: 1, text: nameLines[1], font: NAME_FONT, color: INK },
        { key: 'room', order: 3, priority: 2, gap: 7, text: block.location, font: DETAIL_FONT, color: INK_SECONDARY },
        { key: 'prof', order: 4, priority: 3, gap: 3, text: block.instructor && decodeHtmlEntities(block.instructor), font: DETAIL_FONT, color: INK_SECONDARY },
    ].filter(l => l.text);

    const kept = [];
    let used = 0;
    for (const line of [...lines].sort((a, b) => a.priority - b.priority)) {
        if (used + line.gap + TEXT_H > room) break;
        kept.push(line);
        used += line.gap + TEXT_H;
    }
    // A second name line without the first would read as a stray fragment.
    const keys = new Set(kept.map(l => l.key));
    return kept
        .filter(l => l.key !== 'name1' || keys.has('name0'))
        // A name cut to one line says so, rather than passing for the full name.
        .map(l => (l.key === 'name0' && nameLines[1] && !keys.has('name1') ? { ...l, text: `${l.text}…` } : l))
        .sort((a, b) => a.order - b.order);
}

function drawSchedule({ blocks, unscheduled }) {
    const days = DAYS.filter(d => blocks.some(b => b.day === d));
    // An hour of margin either side, so the day does not look cut off at the
    // first and last class.
    const startHour = Math.max(0, Math.floor(Math.min(...blocks.map(b => b.start)) / 60) - 1);
    const endHour = Math.min(24, Math.ceil(Math.max(...blocks.map(b => b.end)) / 60) + 1);
    const gridHeight = (endHour - startHour) * 60 * PX_PER_MIN + BODY_PAD * 2;
    const gridWidth = AXIS + days.length * COL_W;
    const width = gridWidth + PAD * 2;
    const inner = width - PAD * 2;

    // Work out every height first; a canvas cannot grow once drawn on.
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = `500 13px ${SANS}`;
    const extraLines = unscheduled.flatMap(sec => wrap(measure, [sec.courseId, sec.courseName].filter(Boolean).join(' · '), inner));
    measure.font = FOOTER_FONT;
    const footerLines = wrap(measure, FOOTER, inner);

    const gridTop = PAD;
    let y = gridTop + DAY_HEADER + gridHeight + 22;
    const extraTop = y;
    if (extraLines.length) y += 22 + extraLines.length * 19 + 12;
    const footerY = y;
    const height = footerY + footerLines.length * 16 + PAD;

    const canvas = document.createElement('canvas');
    canvas.width = width * SCALE;
    canvas.height = Math.ceil(height * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = 'top';

    ctx.fillStyle = PAGE;
    ctx.fillRect(0, 0, width, height);

    const gx = PAD;
    const bodyTop = gridTop + DAY_HEADER + BODY_PAD;
    ctx.save();
    roundedRect(ctx, gx, gridTop, gridWidth, DAY_HEADER + gridHeight, 14);
    ctx.fillStyle = PANEL;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = LINE_SOFT;
    ctx.fillRect(gx, gridTop, gridWidth, DAY_HEADER);
    ctx.fillStyle = LINE;
    ctx.fillRect(gx, gridTop + DAY_HEADER - 1, gridWidth, 1);

    for (let h = startHour; h <= endHour; h++) {
        const lineY = bodyTop + (h - startHour) * 60 * PX_PER_MIN;
        if (h < endHour) {
            ctx.fillStyle = LINE_SOFT;
            ctx.fillRect(gx + AXIS, lineY + 30 * PX_PER_MIN, gridWidth - AXIS, 1);
        }
        ctx.fillStyle = LINE;
        ctx.fillRect(gx + AXIS - 6, lineY, gridWidth - AXIS + 6, 1);
        // Labels sit on their hour line, as on the site's own timetable.
        ctx.fillStyle = INK_MUTED;
        ctx.font = `600 11px ${SANS}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(hourLabel(h), gx + AXIS - 10, lineY);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    days.forEach((day, i) => {
        const colX = gx + AXIS + i * COL_W;
        ctx.fillStyle = LINE;
        ctx.fillRect(colX, gridTop, 1, DAY_HEADER + gridHeight);
        ctx.fillStyle = INK_SECONDARY;
        ctx.font = `700 14px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText(day, colX + COL_W / 2, gridTop + 13);
        ctx.textAlign = 'left';
    });

    blocks.forEach(block => {
        const col = days.indexOf(block.day);
        if (col === -1) return;
        const color = COLORS[paletteIndex(block.colorIdx)];
        const bx = gx + AXIS + col * COL_W + 4;
        const bw = COL_W - 7;
        const by = bodyTop + (block.start - startHour * 60) * PX_PER_MIN + 1;
        const bh = (block.end - block.start) * PX_PER_MIN - 2;

        ctx.save();
        roundedRect(ctx, bx, by, bw, bh, 8);
        ctx.fillStyle = PANEL;
        ctx.fill();
        ctx.fillStyle = withAlpha(color, 0.16);
        ctx.fill();
        ctx.clip();
        ctx.fillStyle = color;
        ctx.fillRect(bx, by, 4, bh);

        const tx = bx + 11;
        const tw = bw - 17;
        let ty = by + 8;
        blockLines(ctx, block, tw, bh - 14).forEach((line, i) => {
            if (i > 0) ty += line.gap;
            ctx.fillStyle = line.color;
            ctx.font = line.font;
            ctx.fillText(fit(ctx, line.text, tw), tx, ty);
            ty += TEXT_H;
        });
        ctx.restore();
    });
    ctx.restore();

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    roundedRect(ctx, gx + 0.5, gridTop + 0.5, gridWidth - 1, DAY_HEADER + gridHeight - 1, 14);
    ctx.stroke();

    if (extraLines.length) {
        ctx.fillStyle = INK_MUTED;
        ctx.font = `700 12px ${SANS}`;
        ctx.fillText('NO SET TIME', PAD, extraTop);
        ctx.fillStyle = INK_SECONDARY;
        ctx.font = `500 13px ${SANS}`;
        extraLines.forEach((line, i) => ctx.fillText(line, PAD, extraTop + 22 + i * 19));
    }

    ctx.fillStyle = INK_MUTED;
    ctx.font = FOOTER_FONT;
    footerLines.forEach((line, i) => ctx.fillText(line, PAD, footerY + i * 16));

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

/**
 * Draws the schedule and saves it as a PNG.
 *
 * title:       names the image in the share sheet.
 * blocks:      [{ day, start, end, courseId, courseName, instructor, location, colorIdx }]
 *              with start and end in minutes after midnight.
 * unscheduled: [{ courseId, courseName }] for sections with no set time.
 */
export async function downloadSchedulePng({ title, blocks, unscheduled = [], fileName }) {
    if (!blocks.length) return;
    // The page already uses these fonts; waiting makes sure the canvas does too.
    if (document.fonts?.load) {
        await Promise.all(
            [ID_FONT, NAME_FONT, DETAIL_FONT, FOOTER_FONT].map(f => document.fonts.load(f).catch(() => null)),
        );
    }
    const canvas = drawSchedule({ blocks, unscheduled });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The browser could not create the image.');
    await deliver(blob, fileName, title);
}
