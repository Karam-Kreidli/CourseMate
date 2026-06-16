import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

function parseAdminIds() {
    const raw = process.env.ADMIN_USER_IDS || '';
    return raw.split(',').map(id => id.trim()).filter(Boolean);
}

export async function getAdminUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const allowed = parseAdminIds();
    if (!allowed.includes(user.id)) return null;
    return user;
}

export function createAdminClient() {
    return createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}
