import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';
import { MAP_BOUNDS, normalizePlace } from '@/app/map/places';

async function readPlace(request) {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') throw new Error('Expected a place');
    return { id: body.id, place: normalizePlace(body, MAP_BOUNDS) };
}

// Every place, hidden ones included, for the admin Map tab.
export async function GET() {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('map_places')
        .select('*')
        .order('sort_order')
        .order('name');

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ places: data || [] });
}

export async function POST(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    let place;
    try {
        ({ place } = await readPlace(request));
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase.from('map_places').insert(place).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ place: data });
}

// Replaces a place with what the form holds; the form always sends all of it.
export async function PATCH(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    let id, place;
    try {
        ({ id, place } = await readPlace(request));
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('map_places')
        .update({ ...place, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ place: data });
}

export async function DELETE(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { id } = await request.json().catch(() => ({}));
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabase = createAdminClient();
    const { error } = await supabase.from('map_places').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
