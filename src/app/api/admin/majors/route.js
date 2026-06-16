import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';

export async function GET() {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('majors')
        .select('code, name, dept_electives_count, support_electives_count')
        .order('name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ majors: data || [] });
}

export async function POST(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const body = await request.json();
    const code = (body.code || '').trim();
    const name = (body.name || '').trim();
    const deptCount = Number.isFinite(+body.dept_electives_count) ? +body.dept_electives_count : 0;
    const supportCount = Number.isFinite(+body.support_electives_count) ? +body.support_electives_count : 0;
    const existingCourseIds = Array.isArray(body.existing_course_ids) ? body.existing_course_ids : [];
    const newCourses = Array.isArray(body.new_courses) ? body.new_courses : [];

    if (!code || !name) {
        return NextResponse.json({ error: 'code and name are required' }, { status: 400 });
    }

    const cleanedNew = newCourses
        .map(c => ({
            course_id: (c.course_id || '').trim(),
            course_name: (c.course_name || '').trim(),
            credit_hours: Number.isFinite(+c.credit_hours) ? +c.credit_hours : null,
        }))
        .filter(c => c.course_id && c.course_name);

    const supabase = createAdminClient();

    // 1. Upsert any new courses (won't overwrite existing if course_id matches)
    if (cleanedNew.length > 0) {
        const { error: courseErr } = await supabase
            .from('courses')
            .upsert(cleanedNew, { onConflict: 'course_id', ignoreDuplicates: true });
        if (courseErr) {
            return NextResponse.json({ error: `Failed inserting courses: ${courseErr.message}` }, { status: 500 });
        }
    }

    // 2. Insert the major
    const { error: majorErr } = await supabase
        .from('majors')
        .insert({
            code,
            name,
            dept_electives_count: deptCount,
            support_electives_count: supportCount,
        });
    if (majorErr) {
        return NextResponse.json({ error: `Failed inserting major: ${majorErr.message}` }, { status: 500 });
    }

    // 3. Build the junction rows
    const allCourseIds = Array.from(new Set([
        ...existingCourseIds.map(id => String(id).trim()).filter(Boolean),
        ...cleanedNew.map(c => c.course_id),
    ]));

    if (allCourseIds.length > 0) {
        const junctionRows = allCourseIds.map(course_id => ({ major_code: code, course_id }));
        const { error: linkErr } = await supabase
            .from('major_courses')
            .insert(junctionRows);
        if (linkErr) {
            return NextResponse.json({
                error: `Major created, but linking courses failed: ${linkErr.message}`,
            }, { status: 500 });
        }
    }

    return NextResponse.json({ success: true, code });
}

export async function DELETE(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'code required' }, { status: 400 });

    const supabase = createAdminClient();

    // Remove junction rows first to avoid FK issues
    const { error: jErr } = await supabase.from('major_courses').delete().eq('major_code', code);
    if (jErr) return NextResponse.json({ error: jErr.message }, { status: 500 });

    const { error } = await supabase.from('majors').delete().eq('code', code);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
