import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';

// Returns the list of users who dismissed a given announcement.
export async function GET(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { searchParams } = new URL(request.url);
    const announcementId = (searchParams.get('id') || '').trim();
    if (!announcementId) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = createAdminClient();
    const { data: rows, error } = await supabase
        .from('announcement_dismissals')
        .select('user_id, dismissed_at')
        .eq('announcement_id', announcementId)
        .order('dismissed_at', { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const userIds = (rows || []).map(r => r.user_id);
    let profilesById = new Map();
    if (userIds.length > 0) {
        const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name, email, student_id')
            .in('id', userIds);
        profilesById = new Map((profiles || []).map(p => [p.id, p]));
    }

    const users = (rows || []).map(r => {
        const p = profilesById.get(r.user_id) || {};
        return {
            id: r.user_id,
            name: p.name || null,
            email: p.email || null,
            student_id: p.student_id || null,
            dismissed_at: r.dismissed_at,
        };
    });

    return NextResponse.json({ users });
}
