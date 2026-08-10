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

    // Course IDs must be 7 digits (CCCC + NNN); the classification columns are derived from them.
    const badId = cleanedNew.find(c => !/^\d{7}$/.test(c.course_id));
    if (badId) {
        return NextResponse.json(
            { error: `Invalid course ID "${badId.course_id}". Course IDs must be exactly 7 digits.` },
            { status: 400 }
        );
    }

    const supabase = createAdminClient();

    // 1. Upsert any new courses (won't overwrite existing if course_id matches)
    if (cleanedNew.length > 0) {
        // The courses table requires college_code/college_name/course_number (NOT NULL).
        // Derive code/number from the course_id (format CCCC + NNN), and borrow the
        // college_name from any existing course in the same college.
        const collegeCodes = [...new Set(cleanedNew.map(c => c.course_id.slice(0, 4)))];
        const { data: existingCourses } = await supabase
            .from('courses')
            .select('college_code, college_name')
            .in('college_code', collegeCodes);
        const nameByCollege = new Map();
        for (const row of existingCourses || []) {
            if (row.college_name && !nameByCollege.has(row.college_code)) {
                nameByCollege.set(row.college_code, row.college_name);
            }
        }

        const toInsert = cleanedNew.map(c => {
            const college_code = c.course_id.slice(0, 4);
            const course_number = c.course_id.slice(4);
            return {
                course_id: c.course_id,
                course_name: c.course_name,
                credit_hours: c.credit_hours ?? 0,
                college_code,
                course_number,
                college_name: nameByCollege.get(college_code) || 'Unknown College',
            };
        });

        const { error: courseErr } = await supabase
            .from('courses')
            .upsert(toInsert, { onConflict: 'course_id', ignoreDuplicates: true });
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
