import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';
import { decodeSectionInstructors } from '@/lib/text';

// Categories an admin sets by hand, per major.
const ALLOWED_CATEGORIES = ['Core', 'Major Elective', 'Support Elective'];
// Category that is derived from the course-level basket flag (not hand-edited).
const MANAGED_CATEGORY = 'University Elective';

export async function GET(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim().replace(/[,()*\\%]/g, '');
    const detail = searchParams.get('detail') === '1';
    const majorCode = (searchParams.get('major') || '').trim();
    const category = (searchParams.get('category') || '').trim();

    const supabase = createAdminClient();

    // ── Lightweight mode (used by the course picker) ──
    if (!detail) {
        let query = supabase
            .from('courses')
            .select('course_id, course_name, credit_hours')
            .order('course_id')
            .limit(30);

        if (q) {
            const like = `%${q}%`;
            query = query.or(`course_id.ilike.${like},course_name.ilike.${like}`);
        }

        const { data, error } = await query;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ courses: data || [] });
    }

    // ── Detail mode: courses with majors, sections, instructors, terms, campuses ──

    // Filter by major and/or category via the membership table. When both are set,
    // it's a course that has that category within that major (a true double filter).
    let restrictIds = null;
    if (majorCode || category) {
        let mcQuery = supabase.from('major_courses').select('course_id');
        if (majorCode) mcQuery = mcQuery.eq('major_code', majorCode);
        if (category) mcQuery = mcQuery.eq('category', category);
        const { data: mc, error } = await mcQuery;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        restrictIds = [...new Set((mc || []).map(r => r.course_id))];
        if (restrictIds.length === 0) return NextResponse.json({ courses: [] });
    }

    let query = supabase
        .from('courses')
        .select('course_id, course_name, college_name, course_number, credit_hours, university_elective_basket, restricted_majors')
        .order('course_id')
        .limit(2000);

    if (q) {
        const like = `%${q}%`;
        query = query.or(`course_id.ilike.${like},course_name.ilike.${like}`);
    }
    if (restrictIds) query = query.in('course_id', restrictIds);

    const { data: courses, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const ids = (courses || []).map(c => c.course_id);
    if (ids.length === 0) return NextResponse.json({ courses: [] });

    // Major memberships for these courses.
    const { data: mcRows } = await supabase
        .from('major_courses')
        .select('course_id, major_code, category')
        .in('course_id', ids);

    const majorCodes = [...new Set((mcRows || []).map(r => r.major_code))];
    let majorNameByCode = new Map();
    if (majorCodes.length > 0) {
        const { data: majorRows } = await supabase
            .from('majors')
            .select('code, name')
            .in('code', majorCodes);
        majorNameByCode = new Map((majorRows || []).map(m => [m.code, m.name]));
    }

    const majorsByCourse = new Map();
    for (const r of mcRows || []) {
        if (!majorsByCourse.has(r.course_id)) majorsByCourse.set(r.course_id, []);
        majorsByCourse.get(r.course_id).push({
            code: r.major_code,
            name: majorNameByCode.get(r.major_code) || r.major_code,
            category: r.category || null,
        });
    }

    // Sections for these courses.
    const { data: rawSecRows } = await supabase
        .from('sections')
        .select('course_id, section_num, crn, instructor, class_time, campus, term_code')
        .in('course_id', ids)
        .order('term_code', { ascending: false })
        .order('section_num');

    // Decoded here so both the per-section rows and the derived instructor list
    // below carry the readable name.
    const secRows = decodeSectionInstructors(rawSecRows || []);

    const sectionsByCourse = new Map();
    for (const s of secRows || []) {
        if (!sectionsByCourse.has(s.course_id)) sectionsByCourse.set(s.course_id, []);
        sectionsByCourse.get(s.course_id).push(s);
    }

    const result = (courses || []).map(c => {
        const sects = sectionsByCourse.get(c.course_id) || [];
        const instructors = [...new Set(sects.map(s => s.instructor).filter(Boolean))];
        const terms = [...new Set(sects.map(s => s.term_code).filter(Boolean))];
        const campuses = [...new Set(sects.map(s => s.campus).filter(Boolean))];
        return {
            ...c,
            majors: majorsByCourse.get(c.course_id) || [],
            section_count: sects.length,
            instructors,
            terms,
            campuses,
            sections: sects,
        };
    });

    return NextResponse.json({ courses: result });
}

// Create a brand-new course, with optional major memberships and university-elective basket.
export async function POST(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const body = await request.json();
    const supabase = createAdminClient();

    const courseId = String(body.course_id || '').trim();
    if (!/^\d{7}$/.test(courseId)) {
        return NextResponse.json({ error: 'Course ID must be exactly 7 digits.' }, { status: 400 });
    }
    const courseName = String(body.course_name || '').trim();
    if (!courseName) {
        return NextResponse.json({ error: 'Course name is required.' }, { status: 400 });
    }
    const creditHours = Number.isFinite(+body.credit_hours) ? +body.credit_hours : 0;
    const basket = String(body.university_elective_basket || '').trim() || null;
    const restrictedMajors = basket && Array.isArray(body.restricted_majors)
        ? [...new Set(body.restricted_majors.map(c => String(c).trim()).filter(Boolean))]
        : [];

    const { data: existing, error: existErr } = await supabase
        .from('courses')
        .select('course_id')
        .eq('course_id', courseId)
        .maybeSingle();
    if (existErr) return NextResponse.json({ error: existErr.message }, { status: 500 });
    if (existing) return NextResponse.json({ error: `Course ${courseId} already exists.` }, { status: 409 });

    // Same course name under a different code is still a duplicate — block it too.
    // Escape ILIKE wildcard/escape chars so the name is matched literally, not as a pattern.
    const escapedName = courseName.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: nameMatch, error: nameErr } = await supabase
        .from('courses')
        .select('course_id')
        .ilike('course_name', escapedName)
        .limit(1)
        .maybeSingle();
    if (nameErr) return NextResponse.json({ error: nameErr.message }, { status: 500 });
    if (nameMatch) {
        return NextResponse.json(
            { error: `A course named "${courseName}" already exists (${nameMatch.course_id}).` },
            { status: 409 }
        );
    }

    const majors = Array.isArray(body.majors) ? body.majors : [];
    const cleanedMajors = [];
    const seen = new Set();
    for (const m of majors) {
        const major_code = String(m.major_code || '').trim();
        const category = String(m.category || '').trim();
        if (!major_code || seen.has(major_code)) continue;
        if (!ALLOWED_CATEGORIES.includes(category)) {
            return NextResponse.json({ error: `Invalid category "${category}" for ${major_code}` }, { status: 400 });
        }
        seen.add(major_code);
        cleanedMajors.push({ major_code, course_id: courseId, category });
    }

    // The courses table requires college_code/college_name/course_number (NOT NULL).
    // Derive code/number from the course_id (format CCCC + NNN), and borrow the
    // college_name from any existing course in the same college.
    const collegeCode = courseId.slice(0, 4);
    const courseNumber = courseId.slice(4);
    const { data: sameCollege } = await supabase
        .from('courses')
        .select('college_name')
        .eq('college_code', collegeCode)
        .not('college_name', 'is', null)
        .limit(1)
        .maybeSingle();

    const { error: insertErr } = await supabase.from('courses').insert({
        course_id: courseId,
        course_name: courseName,
        credit_hours: creditHours,
        college_code: collegeCode,
        course_number: courseNumber,
        college_name: sameCollege?.college_name || 'Unknown College',
        university_elective_basket: basket,
        restricted_majors: restrictedMajors.length ? restrictedMajors : null,
    });
    if (insertErr) return NextResponse.json({ error: `Failed inserting course: ${insertErr.message}` }, { status: 500 });

    if (cleanedMajors.length > 0) {
        const { error } = await supabase.from('major_courses').upsert(cleanedMajors, { onConflict: 'major_code,course_id' });
        if (error) return NextResponse.json({ error: `Course created, but linking majors failed: ${error.message}` }, { status: 500 });
    }

    if (basket) {
        let targetMajors = restrictedMajors;
        if (targetMajors.length === 0) {
            const { data: allMajors } = await supabase.from('majors').select('code');
            targetMajors = (allMajors || []).map(m => m.code);
        }
        if (targetMajors.length > 0) {
            const rows = targetMajors.map(code => ({ major_code: code, course_id: courseId, category: MANAGED_CATEGORY }));
            const { error } = await supabase.from('major_courses').upsert(rows, { onConflict: 'major_code,course_id' });
            if (error) return NextResponse.json({ error: `Course created, but linking university elective failed: ${error.message}` }, { status: 500 });
        }
    }

    return NextResponse.json({ success: true, course_id: courseId });
}
