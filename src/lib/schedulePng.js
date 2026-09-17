/**
 * A schedule as a PNG. Drawn straight onto a canvas from the schedule's data
 * rather than screenshotting the card, so the image comes out the same on every
 * device and theme, and it carries what a student needs at registration (CRNs,
 * times, rooms, instructors), which the card keeps behind "Show details".
 */
import { decodeHtmlEntities } from '@/lib/text';

// The schedule card's course colors, in the same order.
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

// Light theme values from globals.css. An image gets shared and printed, so it
// does not follow the viewer's dark mode.
const INK = '#0F1729';
const INK_SECONDARY = '#475569';
const INK_MUTED = '#94A3B8';
const ACCENT = '#00C389';
const LINE = '#E2E8F0';
const LINE_SOFT = '#F1F5F9';
const PAGE = '#F5F7FA';
const PANEL = '#FFFFFF';

const SANS = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';

const WIDTH = 1000;
const SCALE = 2;
const PAD = 40;
const AXIS = 64;
const DAY_HEADER = 40;
const PX_PER_MIN = 1.1;

function colorFor(idx) {
    return COLORS[(((idx || 0) % COLORS.length) + COLORS.length) % COLORS.length];
}

function withAlpha(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function hourLabel(h) {
    const period = h >= 12 ? 'PM' : 'AM';
    const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
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

function detailText(row) {
    return [
        row.sectionNum && `Section ${row.sectionNum}`,
        row.crn && `CRN ${row.crn}`,
        row.classTime,
        row.instructor && decodeHtmlEntities(row.instructor),
        row.location,
    ].filter(Boolean).join('  ·  ');
}

function drawSchedule({ title, subtitle, blocks, rows }) {
    const days = DAYS.filter(d => blocks.some(b => b.day === d));
    const startHour = Math.floor(Math.min(...blocks.map(b => b.start)) / 60);
    const endHour = Math.ceil(Math.max(...blocks.map(b => b.end)) / 60);
    const gridHeight = (endHour - startHour) * 60 * PX_PER_MIN;
    const inner = WIDTH - PAD * 2;

    // Work out every height first; a canvas cannot grow once drawn on.
    const measure = document.createElement('canvas').getContext('2d');
    measure.font = `500 14px ${SANS}`;
    const listRows = rows.map(row => ({ ...row, details: wrap(measure, detailText(row), inner - 40) }));

    const gridTop = PAD + 80;
    const listTop = gridTop + DAY_HEADER + gridHeight + 36;
    let y = listTop + 30;
    listRows.forEach(row => {
        row.y = y;
        row.h = 14 + 22 + row.details.length * 20 + 12;
        y += row.h + 10;
    });
    const footerY = y + 8;
    const height = footerY + 16 + PAD;

    const canvas = document.createElement('canvas');
    canvas.width = WIDTH * SCALE;
    canvas.height = Math.ceil(height * SCALE);
    const ctx = canvas.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = 'top';

    ctx.fillStyle = PAGE;
    ctx.fillRect(0, 0, WIDTH, height);

    // Header: title and summary, CourseMate on the right.
    ctx.fillStyle = INK;
    ctx.font = `800 30px ${SANS}`;
    ctx.fillText(fit(ctx, title, inner - 180), PAD, PAD);
    ctx.fillStyle = INK_SECONDARY;
    ctx.font = `500 16px ${SANS}`;
    ctx.fillText(fit(ctx, subtitle, inner), PAD, PAD + 42);
    ctx.fillStyle = ACCENT;
    ctx.font = `800 18px ${SANS}`;
    ctx.textAlign = 'right';
    ctx.fillText('CourseMate', WIDTH - PAD, PAD + 8);
    ctx.textAlign = 'left';

    // Timetable panel.
    const bodyTop = gridTop + DAY_HEADER;
    const colW = (inner - AXIS) / days.length;
    ctx.save();
    roundedRect(ctx, PAD, gridTop, inner, DAY_HEADER + gridHeight, 14);
    ctx.fillStyle = PANEL;
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = LINE_SOFT;
    ctx.fillRect(PAD, gridTop, inner, DAY_HEADER);

    for (let h = startHour; h < endHour; h++) {
        const lineY = bodyTop + (h - startHour) * 60 * PX_PER_MIN;
        ctx.fillStyle = LINE;
        ctx.fillRect(PAD, lineY, inner, 1);
        ctx.fillStyle = LINE_SOFT;
        ctx.fillRect(PAD + AXIS, lineY + 30 * PX_PER_MIN, inner - AXIS, 1);
        ctx.fillStyle = INK_MUTED;
        ctx.font = `600 12px ${SANS}`;
        ctx.textAlign = 'right';
        ctx.fillText(hourLabel(h), PAD + AXIS - 10, lineY + 6);
        ctx.textAlign = 'left';
    }

    days.forEach((day, i) => {
        const colX = PAD + AXIS + i * colW;
        ctx.fillStyle = LINE;
        ctx.fillRect(colX, gridTop, 1, DAY_HEADER + gridHeight);
        ctx.fillStyle = INK_SECONDARY;
        ctx.font = `700 14px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.fillText(day, colX + colW / 2, gridTop + 13);
        ctx.textAlign = 'left';
    });

    blocks.forEach(block => {
        const col = days.indexOf(block.day);
        if (col === -1) return;
        const color = colorFor(block.colorIdx);
        const bx = PAD + AXIS + col * colW + 4;
        const bw = colW - 8;
        const by = bodyTop + (block.start - startHour * 60) * PX_PER_MIN + 1;
        const bh = (block.end - block.start) * PX_PER_MIN - 2;

        ctx.save();
        roundedRect(ctx, bx, by, bw, bh, 8);
        ctx.fillStyle = PANEL;
        ctx.fill();
        ctx.fillStyle = withAlpha(color, 0.14);
        ctx.fill();
        ctx.clip();
        ctx.fillStyle = color;
        ctx.fillRect(bx, by, 4, bh);

        const tx = bx + 12;
        const tw = bw - 18;
        ctx.fillStyle = color;
        ctx.font = `700 14px ${MONO}`;
        ctx.fillText(fit(ctx, block.courseId, tw), tx, by + 8);

        // The section line sits at the bottom; the name takes the whole lines
        // left between, so text is never cut through the middle.
        const bottomLine = [block.sectionNum && `Sec ${block.sectionNum}`, block.location].filter(Boolean).join('  ·  ');
        const hasBottom = bottomLine && bh >= 48;
        const nameTop = by + 28;
        const nameBottom = hasBottom ? by + bh - 26 : by + bh - 6;
        if (block.courseName) {
            ctx.fillStyle = INK;
            ctx.font = `600 12px ${SANS}`;
            wrap(ctx, block.courseName, tw, Math.floor((nameBottom - nameTop) / 16)).forEach((line, li) => {
                ctx.fillText(line, tx, nameTop + li * 16);
            });
        }
        if (hasBottom) {
            ctx.fillStyle = INK_SECONDARY;
            ctx.font = `600 12px ${SANS}`;
            ctx.fillText(fit(ctx, bottomLine, tw), tx, by + bh - 22);
        }
        ctx.restore();
    });
    ctx.restore();

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    roundedRect(ctx, PAD + 0.5, gridTop + 0.5, inner - 1, DAY_HEADER + gridHeight - 1, 14);
    ctx.stroke();

    // Section list.
    ctx.fillStyle = INK_MUTED;
    ctx.font = `700 13px ${SANS}`;
    ctx.fillText('SECTIONS', PAD, listTop);

    listRows.forEach(row => {
        const color = colorFor(row.colorIdx);
        ctx.save();
        roundedRect(ctx, PAD, row.y, inner, row.h, 10);
        ctx.fillStyle = PANEL;
        ctx.fill();
        ctx.strokeStyle = LINE;
        ctx.stroke();
        ctx.clip();
        ctx.fillStyle = color;
        ctx.fillRect(PAD, row.y, 5, row.h);
        ctx.restore();

        const tx = PAD + 22;
        ctx.fillStyle = color;
        ctx.font = `700 15px ${MONO}`;
        ctx.fillText(row.courseId, tx, row.y + 14);
        const idWidth = ctx.measureText(row.courseId).width;
        if (row.courseName) {
            ctx.fillStyle = INK;
            ctx.font = `700 15px ${SANS}`;
            ctx.fillText(fit(ctx, row.courseName, inner - 40 - idWidth - 10), tx + idWidth + 10, row.y + 14);
        }
        ctx.fillStyle = INK_SECONDARY;
        ctx.font = `500 14px ${SANS}`;
        row.details.forEach((line, li) => ctx.fillText(line, tx, row.y + 36 + li * 20));
    });

    ctx.fillStyle = INK_MUTED;
    ctx.font = `500 12px ${SANS}`;
    ctx.fillText('Made with CourseMate. Seats and times can change, so check Banner before you register.', PAD, footerY);

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
 * blocks: [{ day, start, end, courseId, courseName, sectionNum, location, colorIdx }]
 *         with start and end in minutes after midnight.
 * rows:   [{ courseId, courseName, sectionNum, crn, classTime, instructor, location, colorIdx }]
 */
export async function downloadSchedulePng({ title, subtitle, blocks, rows, fileName }) {
    if (!blocks.length) return;
    // The page already uses these fonts; waiting makes sure the canvas does too.
    if (document.fonts?.load) {
        await Promise.all(
            [`800 30px ${SANS}`, `600 12px ${SANS}`, `700 14px ${MONO}`].map(f => document.fonts.load(f).catch(() => null)),
        );
    }
    const canvas = drawSchedule({ title, subtitle, blocks, rows });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('The browser could not create the image.');
    await deliver(blob, fileName, title);
}
