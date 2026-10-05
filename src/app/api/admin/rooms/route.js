import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';
import { fetchAllRows } from '@/lib/supabase/fetchAll';
import { decodeSectionInstructors } from '@/lib/text';

// Every active section that has a room, and the names of their courses, for
// the admin Rooms tab to group into a timetable per room.
export async function GET() {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const supabase = createAdminClient();
    const { data: sections, error } = await fetchAllRows(() => supabase
        .from('sections')
        .select('crn, course_id, section_num, class_time, location, instructor, term_code')
        .eq('is_active', true)
        .not('location', 'is', null)
        .order('crn'));
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // All of them: the thousand course ids in use would overflow the URL of an `in` filter.
    const { data: courses, error: courseError } = await fetchAllRows(() => supabase
        .from('courses')
        .select('course_id, course_name')
        .order('course_id'));
    if (courseError) return NextResponse.json({ error: courseError.message }, { status: 500 });

    const courseMap = {};
    for (const c of courses) courseMap[c.course_id] = { name: c.course_name };

    return NextResponse.json({ sections: decodeSectionInstructors(sections), courseMap });
}
