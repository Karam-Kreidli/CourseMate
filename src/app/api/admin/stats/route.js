import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';

const tally = (rows, key) => {
    const m = {};
    for (const r of rows) {
        const k = r[key] || 'unknown';
        m[k] = (m[k] || 0) + 1;
    }
    return m;
};

const sortedEntries = (obj) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([key, count]) => ({ key, count }));

export async function GET() {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const supabase = createAdminClient();
    const now = Date.now();
    const since = (days) => new Date(now - days * 86400000);
    const countSince = (rows, days) => rows.filter(r => r.created_at && new Date(r.created_at) >= since(days)).length;
    const nowIso = new Date(now).toISOString();

    const [profilesRes, postsRes, matchesRes, savedRes, interestsRes, annRes] = await Promise.all([
        supabase.from('profiles').select('major, gender, created_at'),
        supabase.from('posts').select('type, status, course_code, course_name, created_at, expires_at'),
        supabase.from('matches').select('status, created_at'),
        supabase.from('saved_schedules').select('id', { count: 'exact', head: true }),
        supabase.from('post_interests').select('id', { count: 'exact', head: true }),
        supabase.from('announcements').select('id', { count: 'exact', head: true })
            .eq('active', true).or(`expires_at.is.null,expires_at.gt.${nowIso}`),
    ]);

    const profiles = profilesRes.data || [];
    const posts = postsRes.data || [];
    const matches = matchesRes.data || [];

    // Top courses by post volume (carry a display name).
    const courseCounts = {};
    const courseNames = {};
    for (const p of posts) {
        if (!p.course_code) continue;
        courseCounts[p.course_code] = (courseCounts[p.course_code] || 0) + 1;
        if (p.course_name && !courseNames[p.course_code]) courseNames[p.course_code] = p.course_name;
    }
    const topCourseCodes = sortedEntries(courseCounts).slice(0, 8).map(e => e.key);

    // Fill in missing names from the courses table.
    const missing = topCourseCodes.filter(code => !courseNames[code]);
    if (missing.length > 0) {
        const { data } = await supabase.from('courses').select('course_id, course_name').in('course_id', missing);
        for (const c of data || []) courseNames[c.course_id] = c.course_name;
    }
    const topCourses = topCourseCodes.map(code => ({
        course_id: code,
        name: courseNames[code] || '',
        count: courseCounts[code],
    }));

    const livePosts = posts.filter(p =>
        ['active', 'pending'].includes(p.status) && (!p.expires_at || new Date(p.expires_at) > new Date(now))
    ).length;
    const pendingMatches = matches.filter(m => m.status === 'pending').length;

    return NextResponse.json({
        users: {
            total: profiles.length,
            newLast7: countSince(profiles, 7),
            newLast30: countSince(profiles, 30),
            byMajor: sortedEntries(tally(profiles, 'major')),
            byGender: sortedEntries(tally(profiles, 'gender')),
        },
        posts: {
            total: posts.length,
            live: livePosts,
            newLast7: countSince(posts, 7),
            newLast30: countSince(posts, 30),
            byType: sortedEntries(tally(posts, 'type')),
            byStatus: sortedEntries(tally(posts, 'status')),
        },
        matches: {
            total: matches.length,
            pending: pendingMatches,
            byStatus: sortedEntries(tally(matches, 'status')),
        },
        savedSchedules: savedRes.count ?? 0,
        interests: interestsRes.count ?? 0,
        activeAnnouncements: annRes.count ?? 0,
        topCourses,
    });
}
