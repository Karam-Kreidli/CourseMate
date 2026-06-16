import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';

const MAX_BYTES = 5 * 1024 * 1024;
const MIME_TO_EXT = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
};

export async function POST(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'No file' }, { status: 400 });
    }
    const ext = MIME_TO_EXT[file.type];
    if (!ext) {
        return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    const path = `${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const supabase = createAdminClient();
    const { error } = await supabase.storage
        .from('announcement-images')
        .upload(path, file, { contentType: file.type, cacheControl: '31536000' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: { publicUrl } } = supabase.storage
        .from('announcement-images')
        .getPublicUrl(path);
    return NextResponse.json({ url: publicUrl, path });
}
