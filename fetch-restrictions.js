/**
 * Backfill course restrictions from Banner's catalog.
 *
 * Restrictions are catalog data — per course, not per section — so this uses
 * the course-search module rather than the section endpoints. That is the
 * point: it works for courses we store no sections for, so every course can
 * carry its eligibility rules while only courses in a supported major get
 * sections.
 *
 * Catalog data barely changes between terms, so this is a backfill rather than
 * part of the regular sync.
 *
 * Usage:
 *   node fetch-restrictions.js [term_code] [--run] [--limit N] [--all]
 *
 *   --all    every course Banner lists (default: only courses already stored)
 *   --run    write to Supabase (omit for a dry run)
 */

const fs = require('fs');
const path = require('path');
const axios = require(path.join(__dirname, 'scraper/node_modules/axios'));
const qs = require('querystring');
const { createClient } = require('@supabase/supabase-js');

const BASE = 'https://reg-prod.ec.sharjah.ac.ae/StudentRegistrationSsb/ssb';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadEnv() {
    for (const line of fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8').split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const i = t.indexOf('=');
        if (i > 0) process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
    }
}

const strip = (h) => String(h)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, String.fromCharCode(39))
    .replace(/\s+/g, ' ')
    .trim();

// "Must be enrolled in one of the following Programs: Computer Science (BSC-COMPN) ..."
// Each heading opens a block; "Cannot be enrolled in" inverts it. Both modes
// matter — treating an exclusion as an allow-list admits exactly the wrong
// students.
function parseRestrictions(text) {
    const out = [];
    const re = /(Must be enrolled in|Cannot be enrolled in|Must be|Cannot be)\s+(?:one of the following\s+)?([A-Za-z ]+?):/g;
    const marks = [...text.matchAll(re)];

    for (let i = 0; i < marks.length; i++) {
        const start = marks[i].index + marks[i][0].length;
        const end = i + 1 < marks.length ? marks[i + 1].index : text.length;
        const body = text.slice(start, end).trim();
        const mode = marks[i][1].startsWith('Cannot') ? 'exclude' : 'include';
        const kind = marks[i][2].trim();

        for (const m of body.matchAll(/([^()]+?)\s*\(([^)]+)\)/g)) {
            const label = m[1].trim();
            const code = m[2].trim();
            if (code) out.push({ mode, kind, code, label: label || null });
        }
    }
    return out;
}

let jar = [];
const cookie = () => jar.join('; ');
const absorb = (r) => {
    for (const c of (r.headers['set-cookie'] || [])) {
        const kv = c.split(';')[0];
        const n = kv.split('=')[0];
        const i = jar.findIndex((e) => e.startsWith(n + '='));
        if (i >= 0) jar[i] = kv; else jar.push(kv);
    }
};
const hdrs = (extra) => ({ 'user-agent': UA, cookie: cookie(), 'x-requested-with': 'XMLHttpRequest', ...extra });
const FORM = { 'content-type': 'application/x-www-form-urlencoded; charset=UTF-8' };

// The catalog module is a separate Banner app from class search: its own term
// selection, its own results endpoint.
async function boot(term) {
    jar = [];
    absorb(await axios.get(`${BASE}/classSearch/classSearch`, { headers: { 'user-agent': UA }, maxRedirects: 0, validateStatus: () => true, timeout: 25000 }));
    absorb(await axios.get(`${BASE}/registration/registration`, { headers: hdrs(), validateStatus: () => true, timeout: 25000 }));
    await axios.get(`${BASE}/term/termSelection?mode=courseSearch`, { headers: hdrs(), validateStatus: () => true, timeout: 25000 });
    await axios.post(`${BASE}/term/search?mode=courseSearch`, qs.stringify({ term, studyPath: '', startDatepicker: '', endDatepicker: '' }), { headers: hdrs(FORM), validateStatus: () => true, timeout: 25000 });
}

async function retry(fn, label, term) {
    for (let i = 0; i < 4; i++) {
        try {
            return await fn();
        } catch (e) {
            if (i === 3) {
                console.log(`  !! gave up on ${label}: ${e.code || e.message}`);
                return null;
            }
            await sleep(2000 * (i + 1));
            try { await boot(term); } catch (_) { /* next attempt re-tries */ }
        }
    }
}

(async () => {
    loadEnv();
    const args = process.argv.slice(2);
    const execute = args.includes('--run');
    const all = args.includes('--all');
    const limitArg = args.indexOf('--limit');
    const limit = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;
    const term = args.find((a) => /^\d{6}$/.test(a)) || '202610';

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Default to courses we already store so a first run is small; --all walks
    // everything Banner lists in the scrape file.
    let targets;
    if (all) {
        const data = require(path.join(__dirname, 'scraper/data', `data_${term}.json`));
        const seen = new Map();
        for (const s of data[0].subjects) {
            for (const c of s.classes) {
                if (!seen.has(c.subjectCourse)) {
                    seen.set(c.subjectCourse, { course_id: c.subjectCourse, subject: c.subject, number: c.courseNumber });
                }
            }
        }
        targets = [...seen.values()];
    } else {
        const { data } = await supabase.from('courses').select('course_id').order('course_id');
        targets = (data || []).map((c) => ({
            course_id: c.course_id,
            subject: c.course_id.slice(0, 4),
            number: c.course_id.slice(4),
        }));
    }
    targets = targets.slice(0, limit);

    console.log(`Restrictions for ${targets.length} courses, term ${term}${execute ? '' : '  (DRY RUN)'}\n`);
    await boot(term);

    const rows = [];
    const kinds = {};
    let lastSubject = null;
    let withNone = 0;
    let done = 0;

    for (const t of targets) {
        if (t.subject !== lastSubject) {
            await retry(() => axios.get(
                `${BASE}/courseSearchResults/courseSearchResults?txt_subject=${t.subject}&txt_term=${term}&pageOffset=0&pageMaxSize=200`,
                { headers: hdrs(), validateStatus: () => true, timeout: 25000 },
            ), 'context ' + t.subject, term);
            lastSubject = t.subject;
        }

        const res = await retry(() => axios.post(
            `${BASE}/courseSearchResults/getRestrictions`,
            qs.stringify({ term, subjectCode: t.subject, courseNumber: t.number }),
            { headers: hdrs(FORM), validateStatus: () => true, timeout: 25000 },
        ), t.course_id, term);

        done++;
        if (!res) continue;

        const parsed = parseRestrictions(strip(typeof res.data === 'string' ? res.data : JSON.stringify(res.data)));
        if (parsed.length === 0) withNone++;

        for (const p of parsed) {
            const key = `${p.mode} ${p.kind}`;
            kinds[key] = (kinds[key] || 0) + 1;
            rows.push({ course_id: t.course_id, mode: p.mode, kind: p.kind, code: p.code, label: p.label, term_code: term });
        }

        if (done % 100 === 0) console.log(`  ... ${done}/${targets.length}  (${rows.length} rows)`);
        await sleep(150);
    }

    console.log(`\ncourses checked: ${done} | with no restrictions: ${withNone} | rows: ${rows.length}`);
    console.log('by type:');
    Object.entries(kinds).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`   ${String(v).padStart(5)}  ${k}`));

    if (!execute) {
        console.log('\nDry run — nothing written. Add --run to apply.');
        return;
    }

    // Replace this term's restrictions wholesale. A course that loses a rule
    // must lose the row too, and an upsert alone would leave the stale one
    // behind, quietly barring students who are now eligible.
    const courseIds = [...new Set(rows.map((r) => r.course_id))];
    for (let i = 0; i < courseIds.length; i += 200) {
        const batch = courseIds.slice(i, i + 200);
        const { error } = await supabase.from('course_restrictions').delete().eq('term_code', term).in('course_id', batch);
        if (error) { console.error('delete failed:', error.message); process.exit(1); }
    }

    let written = 0;
    for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error } = await supabase.from('course_restrictions').upsert(batch, {
            onConflict: 'course_id, mode, kind, code, term_code',
            ignoreDuplicates: true,
        });
        if (error) { console.error('insert failed:', error.message); process.exit(1); }
        written += batch.length;
        process.stdout.write('.');
    }
    console.log(`\nwrote ${written} restriction rows`);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
