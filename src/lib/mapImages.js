import { NextResponse } from 'next/server';
import sharp from 'sharp';
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
 *
 * Students suggest places anonymously, so nothing in the stored file may say
 * who sent it: the image is re-encoded without its metadata (a phone photo's
 * EXIF can carry GPS, the device and the owner's name), and the name is random,
 * the same as the admin's own uploads, so a student's logo can't be told apart.
 */
export async function uploadMapImage(request) {
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

    let clean;
    try {
        // rotate() turns the picture upright by its EXIF before that is dropped;
        // sharp writes no metadata unless asked to.
        clean = await sharp(Buffer.from(await file.arrayBuffer()), { animated: true })
            .rotate()
            .toFormat(ext === 'jpg' ? 'jpeg' : ext)
            .toBuffer();
    } catch {
        return NextResponse.json({ error: 'That image could not be read' }, { status: 400 });
    }

    const path = `${crypto.randomUUID()}.${ext}`;

    const supabase = createAdminClient();
    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, clean, { contentType: file.type, cacheControl: '31536000' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ url: publicUrl });
}
