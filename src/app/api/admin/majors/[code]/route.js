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

    const MANUAL_CATEGORIES = ['Core', 'Major Elective', 'Support Elective'];
    const BASKET_TYPES = ['Basket 1', 'Basket 2']; // university electives, shared across all majors
    const NEW_COURSE_TYPES = [...MANUAL_CATEGORIES, ...BASKET_TYPES];
    const cleanedNew = newCourses
        .map(c => ({
            course_id: (c.course_id || '').trim(),
            course_name: (c.course_name || '').trim(),
            credit_hours: Number.isFinite(+c.credit_hours) ? +c.credit_hours : null,
            type: NEW_COURSE_TYPES.includes((c.category || '').trim()) ? c.category.trim() : 'Core',
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

    if (cleanedNew.length > 0) {
        // The courses table requires college_code/college_name/course_number (NOT NULL).
        // Derive code/number from the course_id (format CCCC + NNN), and borrow the
        // college_name from any existing course in the same college.
        const collegeCodes = [...new Set(cleanedNew.map(c => c.course_id.slice(0, 4)))];
        const { data: existing } = await supabase
            .from('courses')
            .select('college_code, college_name')
            .in('college_code', collegeCodes);
        const nameByCollege = new Map();
        for (const row of existing || []) {
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
                university_elective_basket: BASKET_TYPES.includes(c.type) ? c.type : null,
            };
        });

        const { error } = await supabase
            .from('courses')
            .upsert(toInsert, { onConflict: 'course_id', ignoreDuplicates: true });
        if (error) return NextResponse.json({ error: `Insert courses failed: ${error.message}` }, { status: 500 });
    }

    // Manual links into THIS major: existing attaches default to 'Core'; new courses
    // carry their chosen manual type. Basket courses are handled separately below —
    // they belong to all majors as a University Elective, not to this major as a
    // per-major category (which would make a course both a basket and a major elective).
    const categoryByCourse = new Map();
    for (const id of attachIds.map(x => String(x).trim()).filter(Boolean)) {
        categoryByCourse.set(id, 'Core');
    }
    const basketNewCourses = [];
    for (const c of cleanedNew) {
        if (BASKET_TYPES.includes(c.type)) basketNewCourses.push(c.course_id);
        else categoryByCourse.set(c.course_id, c.type);
    }

    const toAttach = Array.from(categoryByCourse.keys());
    if (toAttach.length > 0) {
        const rows = toAttach.map(course_id => ({ major_code: code, course_id, category: categoryByCourse.get(course_id) || 'Core' }));
        const { error } = await supabase
            .from('major_courses')
            .upsert(rows, { onConflict: 'major_code,course_id', ignoreDuplicates: true });
        if (error) return NextResponse.json({ error: `Link courses failed: ${error.message}` }, { status: 500 });
    }

    // Basket (university-elective) new courses: shared across all majors.
    if (basketNewCourses.length > 0) {
        const { data: allMajors } = await supabase.from('majors').select('code');
        const majorCodes = (allMajors || []).map(m => m.code);
        const ueRows = [];
        for (const cid of basketNewCourses) {
            for (const mcode of majorCodes) {
                ueRows.push({ major_code: mcode, course_id: cid, category: 'University Elective' });
            }
        }
        if (ueRows.length > 0) {
            const { error } = await supabase
                .from('major_courses')
                .upsert(ueRows, { onConflict: 'major_code,course_id' });
            if (error) return NextResponse.json({ error: `Link basket courses failed: ${error.message}` }, { status: 500 });
        }
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
