import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';

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
    const { data: secRows } = await supabase
        .from('sections')
        .select('course_id, section_num, crn, instructor, class_time, campus, term_code')
        .in('course_id', ids)
        .order('term_code', { ascending: false })
        .order('section_num');

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
