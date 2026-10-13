import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { uploadMapImage } from '@/lib/mapImages';

// A logo for a place a student is suggesting. It only reaches the map if an
// admin accepts the suggestion.
export async function POST(request) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Sign in to suggest a place' }, { status: 401 });
    return uploadMapImage(request);
}
