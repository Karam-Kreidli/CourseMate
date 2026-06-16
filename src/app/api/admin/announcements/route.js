import { NextResponse } from 'next/server';
import sanitizeHtml from 'sanitize-html';
import { getAdminUser, createAdminClient } from '@/lib/admin';

const SANITIZE_OPTIONS = {
    allowedTags: [
        'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
        'h1', 'h2', 'h3', 'blockquote', 'code', 'pre', 'img', 'hr', 'span',
    ],
    allowedAttributes: {
        a: ['href', 'title', 'target', 'rel'],
        img: ['src', 'alt', 'title'],
        '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['http', 'https', 'data'] },
    transformTags: {
        a: (tagName, attribs) => ({
            tagName: 'a',
            attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
        }),
    },
};

function sanitize(html) {
    return sanitizeHtml(html || '', SANITIZE_OPTIONS);
}

function cleanArray(value) {
    if (!Array.isArray(value)) return null;
    const trimmed = value.map(v => (typeof v === 'string' ? v.trim() : v)).filter(Boolean);
    return trimmed.length ? trimmed : null;
}

export async function GET() {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ announcements: data || [] });
}

export async function POST(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const body = await request.json();
    const title = (body.title || '').trim();
    if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 });

    const payload = {
        title,
        body_html: sanitize(body.body_html),
        created_by: admin.id,
        active: body.active !== false,
        expires_at: body.expires_at || null,
        target_majors: cleanArray(body.target_majors),
        target_genders: cleanArray(body.target_genders),
        target_user_ids: cleanArray(body.target_user_ids),
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('announcements')
        .insert(payload)
        .select()
        .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ announcement: data });
}

export async function PATCH(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const body = await request.json();
    const { id, ...rest } = body;
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const update = {};
    if (rest.title !== undefined) update.title = String(rest.title).trim();
    if (rest.body_html !== undefined) update.body_html = sanitize(rest.body_html);
    if (rest.active !== undefined) update.active = !!rest.active;
    if (rest.expires_at !== undefined) update.expires_at = rest.expires_at || null;
    if (rest.target_majors !== undefined) update.target_majors = cleanArray(rest.target_majors);
    if (rest.target_genders !== undefined) update.target_genders = cleanArray(rest.target_genders);
    if (rest.target_user_ids !== undefined) update.target_user_ids = cleanArray(rest.target_user_ids);

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('announcements')
        .update(update)
        .eq('id', id)
        .select()
        .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ announcement: data });
}

export async function DELETE(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const supabase = createAdminClient();
    const { error } = await supabase.from('announcements').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
