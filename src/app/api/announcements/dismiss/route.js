import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { announcement_id, all } = await request.json();

    if (all) {
        const { data: active, error: fetchErr } = await supabase.rpc('get_my_active_announcements');
        if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
        if (!active || active.length === 0) return NextResponse.json({ success: true });

        const rows = active.map(a => ({ announcement_id: a.id, user_id: user.id }));
        const { error } = await supabase
            .from('announcement_dismissals')
            .upsert(rows, { onConflict: 'announcement_id,user_id' });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
    }

    if (!announcement_id) return NextResponse.json({ error: 'Missing announcement_id' }, { status: 400 });

    const { error } = await supabase
        .from('announcement_dismissals')
        .upsert(
            { announcement_id, user_id: user.id },
            { onConflict: 'announcement_id,user_id' }
        );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
