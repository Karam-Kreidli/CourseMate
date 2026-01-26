'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import BottomNav from '@/components/BottomNav';
import ThemeToggle from '@/components/ThemeToggle';
import styles from './profile.module.css';

// Inner component that uses useSearchParams
function ProfileContent() {
    const [profile, setProfile] = useState(null);
    const [majorName, setMajorName] = useState(null);
    const [majors, setMajors] = useState([]);
    const [selectedMajor, setSelectedMajor] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [myPosts, setMyPosts] = useState([]);
    const [showMajorSelect, setShowMajorSelect] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const supabase = createClient();

    useEffect(() => {
        fetchProfile();
        fetchMyPosts();
        fetchMajors();

        // Check if user was redirected to select major
        if (searchParams.get('selectMajor') === 'true') {
            setShowMajorSelect(true);
        }
    }, [searchParams]);

    const fetchMajors = async () => {
        const { data } = await supabase
            .from('majors')
            .select('code, name')
            .order('name');
        setMajors(data || []);
    };

    const fetchProfile = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/auth');
            return;
        }

        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (data) {
            setProfile(data);
            setSelectedMajor(data.major || '');
            // Fetch major name if user has a major set
            if (data.major) {
                const { data: majorData } = await supabase
                    .from('majors')
                    .select('name')
                    .eq('code', data.major)
                    .single();
                setMajorName(majorData?.name || data.major);
            } else {
                // Show major select if user has no major
                setShowMajorSelect(true);
            }
        }
        setLoading(false);
    };

    const fetchMyPosts = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
            .from('posts')
            .select('*')
            .eq('user_id', user.id)
            .in('status', ['active', 'pending'])
            .order('created_at', { ascending: false });

        setMyPosts(data || []);
    };

    const handleSaveMajor = async () => {
        if (!selectedMajor) return;

        setSaving(true);
        const { data: { user } } = await supabase.auth.getUser();

        const { error } = await supabase
            .from('profiles')
            .update({ major: selectedMajor })
            .eq('id', user.id);

        if (!error) {
            // Refresh profile and redirect
            const majorData = majors.find(m => m.code === selectedMajor);
            setMajorName(majorData?.name || selectedMajor);
            setProfile({ ...profile, major: selectedMajor });
            setShowMajorSelect(false);
            router.push('/');
        }
        setSaving(false);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/auth');
        router.refresh();
    };

    if (loading) {
        return (
            <div className={styles.page}>
                <div className={styles.loading}>
                    <div className={styles.spinner}></div>
                </div>
                <BottomNav />
            </div>
        );
    }

    // Show major selection modal if needed
    if (showMajorSelect && !profile?.major) {
        return (
            <div className={styles.page}>
                <header className={styles.header}>
                    <h1>🎓 Select Your Major</h1>
                    <ThemeToggle />
                </header>

                <main className={styles.main}>
                    <div className={styles.card}>
                        <h2 className={styles.cardTitle}>Complete Your Profile</h2>
                        <p className={styles.cardDesc}>
                            Please select your major to see relevant course swaps.
                        </p>

                        <div className={styles.formGroup}>
                            <label className={styles.label}>Major</label>
                            <select
                                value={selectedMajor}
                                onChange={(e) => setSelectedMajor(e.target.value)}
                                className={styles.select}
                                disabled={saving}
                            >
                                <option value="">Select your major</option>
                                {majors.map(m => (
                                    <option key={m.code} value={m.code}>{m.name}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={handleSaveMajor}
                            className={styles.saveBtn}
                            disabled={!selectedMajor || saving}
                        >
                            {saving ? 'Saving...' : 'Continue'}
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <h1>👤 Profile</h1>
                <ThemeToggle />
            </header>

            <main className={styles.main}>
                {/* Profile Info - Read Only */}
                <div className={styles.card}>
                    <h2 className={styles.cardTitle}>Personal Information</h2>

                    <div className={styles.profileInfo}>
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Full Name</span>
                            <span className={styles.infoValue}>{profile?.name || 'Not set'}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>University ID</span>
                            <span className={styles.infoValue}>{profile?.student_id || 'Not set'}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Phone Number</span>
                            <span className={styles.infoValue}>{profile?.phone || 'Not set'}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span className={styles.infoLabel}>Major</span>
                            <span className={styles.infoValue}>{majorName || 'Not set'}</span>
                        </div>
                    </div>
                </div>

                {/* Stats */}
                <div className={styles.statsCard}>
                    <h3>Your Activity</h3>
                    <div className={styles.stats}>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{myPosts.length}</span>
                            <span className={styles.statLabel}>Active Posts</span>
                        </div>
                        <div className={styles.stat}>
                            <span className={styles.statValue}>{5 - myPosts.length}</span>
                            <span className={styles.statLabel}>Posts Left</span>
                        </div>
                    </div>
                </div>

                {/* Sign Out */}
                <button onClick={handleSignOut} className={styles.signOutBtn}>
                    🚪 Sign Out
                </button>
            </main>

            <BottomNav />
        </div>
    );
}

// Main export with Suspense wrapper for useSearchParams
export default function ProfilePage() {
    return (
        <Suspense fallback={
            <div className={styles.page}>
                <div className={styles.loading}>
                    <div className={styles.spinner}></div>
                </div>
            </div>
        }>
            <ProfileContent />
        </Suspense>
    );
}
