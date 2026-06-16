import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';

export async function GET(request, { params }) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { code } = await params;
    const supabase = createAdminClient();

    const { data: major, error: majorErr } = await supabase
        .from('majors')
        .select('code, name, dept_electives_count, support_electives_count')
        .eq('code', code)
        .single();

    if (majorErr) return NextResponse.json({ error: majorErr.message }, { status: 500 });

    const { data: junction, error: jErr } = await supabase
        .from('major_courses')
        .select('course_id')
        .eq('major_code', code);

    if (jErr) return NextResponse.json({ error: jErr.message }, { status: 500 });

    const courseIds = (junction || []).map(j => j.course_id);
    let courses = [];
    if (courseIds.length > 0) {
        const { data: courseData, error: cErr } = await supabase
            .from('courses')
            .select('course_id, course_name, credit_hours')
            .in('course_id', courseIds)
            .order('course_id');
        if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
        courses = courseData || [];
    }

    return NextResponse.json({ major, courses });
}

export async function PATCH(request, { params }) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { code } = await params;
    const body = await request.json();

    const update = {};
    if (typeof body.name === 'string') update.name = body.name.trim();
    if (body.dept_electives_count !== undefined) update.dept_electives_count = +body.dept_electives_count || 0;
    if (body.support_electives_count !== undefined) update.support_electives_count = +body.support_electives_count || 0;

    const supabase = createAdminClient();

    if (Object.keys(update).length > 0) {
        const { error } = await supabase.from('majors').update(update).eq('code', code);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Attach new courses (existing IDs and/or new course rows)
    const attachIds = Array.isArray(body.attach_course_ids) ? body.attach_course_ids : [];
    const newCourses = Array.isArray(body.new_courses) ? body.new_courses : [];

    const cleanedNew = newCourses
        .map(c => ({
            course_id: (c.course_id || '').trim(),
            course_name: (c.course_name || '').trim(),
            credit_hours: Number.isFinite(+c.credit_hours) ? +c.credit_hours : null,
        }))
        .filter(c => c.course_id && c.course_name);

    if (cleanedNew.length > 0) {
        const { error } = await supabase
            .from('courses')
            .upsert(cleanedNew, { onConflict: 'course_id', ignoreDuplicates: true });
        if (error) return NextResponse.json({ error: `Insert courses failed: ${error.message}` }, { status: 500 });
    }

    const toAttach = Array.from(new Set([
        ...attachIds.map(id => String(id).trim()).filter(Boolean),
        ...cleanedNew.map(c => c.course_id),
    ]));

    if (toAttach.length > 0) {
        const rows = toAttach.map(course_id => ({ major_code: code, course_id }));
        const { error } = await supabase
            .from('major_courses')
            .upsert(rows, { onConflict: 'major_code,course_id', ignoreDuplicates: true });
        if (error) return NextResponse.json({ error: `Link courses failed: ${error.message}` }, { status: 500 });
    }

    // Detach courses
    const detachIds = Array.isArray(body.detach_course_ids) ? body.detach_course_ids : [];
    if (detachIds.length > 0) {
        const { error } = await supabase
            .from('major_courses')
            .delete()
            .eq('major_code', code)
            .in('course_id', detachIds);
        if (error) return NextResponse.json({ error: `Detach courses failed: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
