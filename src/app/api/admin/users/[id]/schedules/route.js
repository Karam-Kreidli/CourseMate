import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';

export async function GET(request, { params }) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Missing user id' }, { status: 400 });

    const supabase = createAdminClient();

    const { data: savedData, error: savedError } = await supabase
        .from('saved_schedules')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: true });

    if (savedError) return NextResponse.json({ error: savedError.message }, { status: 500 });
    if (!savedData || savedData.length === 0) return NextResponse.json({ schedules: [] });

    const allCrns = new Set();
    const allCourseIds = new Set();
    savedData.forEach(row => {
        const sd = row.schedule_data || {};
        (sd.courseGroups || []).forEach(g => {
            (g.sections || []).forEach(crn => allCrns.add(crn));
        });
        (sd.selectedCourses || []).forEach(c => allCourseIds.add(c.course_id));
    });

    const [{ data: liveSections }, { data: coursesData }] = await Promise.all([
        supabase.from('sections').select('*').in('crn', Array.from(allCrns)),
        supabase.from('courses').select('course_id, course_name, credit_hours').in('course_id', Array.from(allCourseIds)),
    ]);

    const sectionMap = {};
    (liveSections || []).forEach(s => { sectionMap[s.crn] = s; });

    const courseMap = {};
    (coursesData || []).forEach(c => {
        courseMap[c.course_id] = { name: c.course_name, credits: c.credit_hours };
    });

    const schedules = savedData.map(row => {
        const sd = row.schedule_data || {};
        const reconstructedGroups = (sd.courseGroups || []).map(g => {
            const mappedSections = (g.sections || []).map(crn => sectionMap[crn] || {
                crn,
                course_id: g.courseId,
                section_num: 'CLOSED',
                class_time: 'MISSING',
                instructor: 'Section Unavailable',
                isMissing: true,
            });
            return {
                courseId: g.courseId,
                originalCourseId: g.originalCourseId,
                sections: mappedSections,
            };
        });

        return {
            id: row.id,
            term_code: row.term_code,
            created_at: row.created_at,
            score: sd.score,
            warnings: sd.warnings || [],
            selectedCourses: sd.selectedCourses || [],
            schedule: reconstructedGroups,
        };
    });

    return NextResponse.json({ schedules, courseMap });
}
