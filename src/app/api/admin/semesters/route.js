import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';

export async function GET() {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('semesters')
        .select('*')
        .order('term_code', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ semesters: data || [] });
}

export async function POST(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { term_code, name, is_active } = await request.json();
    if (!term_code || !name) return NextResponse.json({ error: 'term_code and name required' }, { status: 400 });

    const supabase = createAdminClient();
    const { error } = await supabase
        .from('semesters')
        .insert({ term_code, name, is_active: !!is_active });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}

export async function PATCH(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { term_code, is_active, name } = await request.json();
    if (!term_code) return NextResponse.json({ error: 'term_code required' }, { status: 400 });

    const update = {};
    if (typeof is_active === 'boolean') update.is_active = is_active;
    if (typeof name === 'string') update.name = name;

    const supabase = createAdminClient();
    const { error } = await supabase.from('semesters').update(update).eq('term_code', term_code);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}

export async function DELETE(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { term_code } = await request.json();
    if (!term_code) return NextResponse.json({ error: 'term_code required' }, { status: 400 });

    const supabase = createAdminClient();
    const { error } = await supabase.from('semesters').delete().eq('term_code', term_code);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
