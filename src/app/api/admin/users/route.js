import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';

export async function GET(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { searchParams } = new URL(request.url);
    const rawSearch = (searchParams.get('q') || '').trim();
    const search = rawSearch.replace(/[,()*\\%]/g, '');
    const major = (searchParams.get('major') || '').trim();
    const gender = (searchParams.get('gender') || '').trim();

    const supabase = createAdminClient();
    let query = supabase
        .from('profiles')
        .select('id, name, email, student_id, phone, major, gender, created_at')
        .order('created_at', { ascending: false })
        .limit(200);

    if (search) {
        const like = `%${search}%`;
        query = query.or(`name.ilike.${like},email.ilike.${like},student_id.ilike.${like}`);
    }
    if (major) query = query.eq('major', major);
    if (gender) query = query.eq('gender', gender);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ users: data || [] });
}

export async function DELETE(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    if (id === admin.id) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });

    const supabase = createAdminClient();
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
