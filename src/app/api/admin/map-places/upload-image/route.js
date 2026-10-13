import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/admin';
import { uploadMapImage } from '@/lib/mapImages';

export async function POST(request) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });
    return uploadMapImage(request);
}
