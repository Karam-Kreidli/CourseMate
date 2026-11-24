import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';
import { fetchAllRows } from '@/lib/supabase/fetchAll';
import { decodeSectionInstructors } from '@/lib/text';
import { fromOldCode } from '@/app/map/buildings';

/**
 * Location patterns that narrow a room search on the server. Loose on purpose:
 * the tab applies its exact matching (old codes, "a3 007" spellings) to what
 * comes back, so this only has to avoid sending every room in the term.
 * Null means no narrowing, for "every room" in the free-room search.
 */
function locationPatterns(q) {
    const text = (q || '').trim();
    if (!text) return null;
    // An old code ("M10-102") lives in the building that replaced it.
    const old = /^([MW]\d{1,2}[A-H]?)\b/i.exec(text);
    const now = old && fromOldCode(old[1]);
    if (now) return now.map(b => `${b}%`);
    // Any spelling of "A3-007" ("a3 007", "A3007") as a subsequence.
    const chars = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    return chars ? [`%${chars.split('').join('%')}%`] : null;
}

// The admin Rooms tab. Without a term this answers only which semesters there
// are, so opening the tab costs one small query. With one, it returns that
// term's sections whose room matches q, and the names of their courses.
export async function GET(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const supabase = createAdminClient();
    const params = new URL(request.url).searchParams;
    const term = params.get('term');

    if (!term) {
        const { data: semesters, error } = await supabase
            .from('semesters')
            .select('term_code, name')
            .eq('is_active', true)
            .order('term_code', { ascending: false });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ semesters });
    }

    const patterns = locationPatterns(params.get('q'));
    const { data: sections, error } = await fetchAllRows(() => {
        let query = supabase
            .from('sections')
            .select('crn, course_id, section_num, class_time, location, instructor, term_code')
            .eq('term_code', term)
            .eq('is_active', true)
            .not('location', 'is', null);
        // Patterns hold only letters, digits, "%" and "-", so they are safe
        // inside PostgREST's comma-separated or() syntax.
        if (patterns) query = query.or(patterns.map(p => `location.ilike.${p}`).join(','));
        return query.order('crn');
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Names only for the courses in the result, in chunks so a whole-term
    // search does not overflow the URL of one `in` filter.
    const ids = [...new Set(sections.map(s => s.course_id))];
    const chunks = [];
    for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
    const results = await Promise.all(chunks.map(chunk => supabase
        .from('courses').select('course_id, course_name').in('course_id', chunk)));
    const failed = results.find(r => r.error);
    if (failed) return NextResponse.json({ error: failed.error.message }, { status: 500 });

    const courseMap = {};
    for (const { data } of results) for (const c of data) courseMap[c.course_id] = { name: c.course_name };

    return NextResponse.json({ sections: decodeSectionInstructors(sections), courseMap });
}
