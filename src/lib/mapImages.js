import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/admin';

// Logos for places on the campus map, kept in their own public bucket.
const BUCKET = 'map-images';
const MAX_BYTES = 2 * 1024 * 1024;
const MIME_TO_EXT = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
};

/**
 * Stores the logo in an upload form's `file` and answers with its public URL.
 * `folder` keeps students' uploads apart from the admin's.
 */
export async function uploadMapImage(request, folder = '') {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'No file' }, { status: 400 });
    }
    const ext = MIME_TO_EXT[file.type];
    if (!ext) {
        return NextResponse.json({ error: 'Use a PNG, JPEG or WebP image' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 400 });
    }

    const path = `${folder}${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const supabase = createAdminClient();
    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: publicUrl });
}
