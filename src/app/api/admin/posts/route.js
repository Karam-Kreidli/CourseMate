import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';

export async function GET(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('q') || '').trim().replace(/[,()*\\%]/g, '');
    const status = searchParams.get('status');
    const term = searchParams.get('term');

    const supabase = createAdminClient();
    let query = supabase
        .from('posts')
        .select('*, profile:profiles!posts_user_id_fkey(id, name, student_id, email)')
        .order('created_at', { ascending: false })
        .limit(300);

    if (status && status !== 'all') query = query.eq('status', status);
    if (term) query = query.eq('term_code', term);
    if (search) {
        const like = `%${search}%`;
        query = query.or(`course_code.ilike.${like},course_name.ilike.${like}`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ posts: data || [] });
}

export async function PATCH(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { id, status } = await request.json();
    if (!id || !status) return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });

    const supabase = createAdminClient();
    const { error } = await supabase.from('posts').update({ status }).eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}

export async function DELETE(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = createAdminClient();
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
