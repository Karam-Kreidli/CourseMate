'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export function useRequireProfile() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [ready, setReady] = useState(false);
    const [transitioning, setTransitioning] = useState(false);

    const navigateWithTransition = useCallback((path) => {
        setTransitioning(true);
        setTimeout(() => { router.push(path); }, 420);
    }, [router]);

    useEffect(() => {
        const supabase = createClient();
        let cancelled = false;

        (async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            if (code) {
                router.replace(`/auth/reset-password?code=${code}`);
                return;
            }

            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (cancelled) return;

            if (!authUser) {
                navigateWithTransition('/auth');
                return;
            }

            const { data: profileData } = await supabase
                .from('profiles')
                .select('id, name, student_id, phone, major, year, gender')
                .eq('id', authUser.id)
                .single();

            if (cancelled) return;

            if (!profileData?.major) {
                navigateWithTransition('/profile?selectMajor=true');
                return;
            }

            setUser(authUser);
            setProfile(profileData);
            setReady(true);
        })();

        return () => { cancelled = true; };
    }, [router, navigateWithTransition]);

    return { user, profile, ready, transitioning, navigateWithTransition };
}
