import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';

// Matches that no longer hold a claim on their posts.
const TERMINAL_MATCH_STATUSES = ['declined', 'expired', 'completed'];
const LIVE_MATCH_STATUSES = ['pending', 'accepted'];

export async function GET(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { searchParams } = new URL(request.url);
    const search = (searchParams.get('q') || '').trim().replace(/[,()*\%]/g, '');
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

    // match_participants.post_id is ON DELETE NO ACTION (conversations and
    // post_interests both cascade), so any post that was ever part of a match
    // blocks a plain delete with a foreign-key violation. The user-facing path
    // solves this with the cancel_post RPC, but that is SECURITY DEFINER and
    // checks auth.uid() against the post owner — an admin deleting someone
    // else's post would be rejected — so the same cleanup is done here.
    const { data: liveRows, error: liveErr } = await supabase
        .from('match_participants')
        .select('match_id, matches!inner(status)')
        .eq('post_id', id)
        .in('matches.status', LIVE_MATCH_STATUSES);
    if (liveErr) return NextResponse.json({ error: liveErr.message }, { status: 500 });

    if (liveRows && liveRows.length > 0) {
        return NextResponse.json(
            { error: 'This post is part of an active match. Force-expire the match first, then delete.' },
            { status: 409 }
        );
    }

    // Clear only rows belonging to terminal matches, named explicitly rather
    // than "everything that isn't live", so a status added later blocks the
    // delete loudly instead of having its participant row quietly removed.
    const { data: staleRows, error: staleErr } = await supabase
        .from('match_participants')
        .select('match_id, matches!inner(status)')
        .eq('post_id', id)
        .in('matches.status', TERMINAL_MATCH_STATUSES);
    if (staleErr) return NextResponse.json({ error: staleErr.message }, { status: 500 });

    if (staleRows && staleRows.length > 0) {
        const { error: cleanupErr } = await supabase
            .from('match_participants')
            .delete()
            .eq('post_id', id)
            .in('match_id', staleRows.map(r => r.match_id));
        if (cleanupErr) {
            return NextResponse.json(
                { error: `Could not clear old match references: ${cleanupErr.message}` },
                { status: 500 }
            );
        }
    }

    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
