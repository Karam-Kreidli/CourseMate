import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/admin';
import { MAP_BOUNDS, normalizePlace, placeChanges } from '@/app/map/places';

// Enough for someone adding a few places at once, not for flooding the queue.
const MAX_PENDING_PER_USER = 10;
const MAX_NOTE = 500;

/**
 * A student suggests a new place for the map, or a change to one already on
 * it (place_id). It waits in map_place_suggestions until an admin accepts or
 * rejects it; nothing reaches the map from here.
 *
 * Who sent it stays between the student and the admins: user_id lives only in
 * map_place_suggestions (RLS on, no policies, so only the service role reads
 * it), accepting copies the place's own fields into map_places and nothing
 * else, and this answers with no more than success.
 */
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in to suggest a place' }, { status: 401 });

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Expected a place' }, { status: 400 });

    let place;
    try {
        place = normalizePlace(body, MAP_BOUNDS);
    } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 400 });
    }
    // Showing, ordering and signs are the admin's to decide.
    delete place.is_visible;
    delete place.sort_order;
    delete place.show_sign;

    const note = typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) || null : null;
    const placeId = body.place_id || null;

    const admin = createAdminClient();

    if (placeId) {
        const { data: current } = await admin
            .from('map_places')
            .select('*')
            .eq('id', placeId)
            .eq('is_visible', true)
            .maybeSingle();
        if (!current) return NextResponse.json({ error: 'That place is no longer on the map' }, { status: 404 });
        if (placeChanges(current, place).length === 0) {
            return NextResponse.json({ error: 'Nothing has changed from what the map shows' }, { status: 400 });
        }
    }

    const { count, error: countError } = await admin
        .from('map_place_suggestions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'pending');
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    if (count >= MAX_PENDING_PER_USER) {
        return NextResponse.json({
            error: `You have ${count} suggestions waiting for review. Try again once some are looked at.`,
        }, { status: 429 });
    }

    const { error } = await admin
        .from('map_place_suggestions')
        .insert({ user_id: user.id, place_id: placeId, data: place, note });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
