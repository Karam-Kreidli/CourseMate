import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';

export async function GET(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get('q') || '').trim();

    const supabase = createAdminClient();
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
