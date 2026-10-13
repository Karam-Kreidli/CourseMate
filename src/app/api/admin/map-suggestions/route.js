import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';
import { MAP_BOUNDS, normalizePlace } from '@/app/map/places';

// Places and changes students have suggested, waiting for review, with who
// sent each and, for a change, the place as it is now.
export async function GET() {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
        .from('map_place_suggestions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const userIds = [...new Set(rows.map(r => r.user_id))];
    const { data: profiles } = userIds.length
        ? await supabase.from('profiles').select('id, name, email').in('id', userIds)
        : { data: [] };
    const byId = Object.fromEntries((profiles || []).map(p => [p.id, p]));

    return NextResponse.json({
        suggestions: rows.map(r => ({ ...r, submitter: byId[r.user_id] || null })),
    });
}

/**
 * { id, action: 'accept', place } puts the place, as the admin left it in the
 * review form, on the map: a new row, or over the place the suggestion was
 * for. { id, action: 'reject' } drops the suggestion.
 */
export async function POST(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const body = await request.json().catch(() => ({}));
    const { id, action } = body;
    if (!id || !['accept', 'reject'].includes(action)) {
        return NextResponse.json({ error: 'id and action required' }, { status: 400 });
    }

    let place;
    if (action === 'accept') {
        try {
            place = normalizePlace(body.place || {}, MAP_BOUNDS);
        } catch (e) {
            return NextResponse.json({ error: e.message }, { status: 400 });
        }
    }

    const supabase = createAdminClient();
    const reviewed = {
        status: action === 'accept' ? 'accepted' : 'rejected',
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
    };
    // Claimed while still pending, so two admins can't both accept it.
    const { data: suggestion, error: claimError } = await supabase
        .from('map_place_suggestions')
        .update(reviewed)
        .eq('id', id)
        .eq('status', 'pending')
        .select()
        .maybeSingle();
    if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 });
    if (!suggestion) return NextResponse.json({ error: 'Someone has already reviewed this suggestion' }, { status: 409 });

    if (action === 'reject') return NextResponse.json({ success: true });

    const write = suggestion.place_id
        ? supabase
            .from('map_places')
            .update({ ...place, updated_at: new Date().toISOString() })
            .eq('id', suggestion.place_id)
        : supabase.from('map_places').insert(place);
    const { data: saved, error } = await write.select().maybeSingle();
    if (error || !saved) {
        // Back in the queue, so it isn't lost.
        await supabase
            .from('map_place_suggestions')
            .update({ status: 'pending', reviewed_by: null, reviewed_at: null })
            .eq('id', id);
        return NextResponse.json({ error: error?.message || 'That place is no longer on the map' }, { status: error ? 500 : 404 });
    }
    return NextResponse.json({ place: saved });
}
