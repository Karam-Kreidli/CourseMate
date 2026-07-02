'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useSemester } from '@/lib/SemesterContext';
import { useRequireProfile } from '@/lib/useRequireProfile';
import BottomNav from '@/components/BottomNav';
import DashboardCard, { StatBig } from '@/components/DashboardCard';
import AnnouncementsModal from '@/components/AnnouncementsModal';
import {
    PlusIcon,
    ScheduleIcon,
    SwapIcon,
    BookIcon,
    UserCheckIcon,
    ProfileIcon,
} from '@/components/Icons';
import styles from './page.module.css';

const PROFILE_FIELDS = ['name', 'student_id', 'phone', 'major', 'gender'];

function relativeTime(iso) {
    if (!iso) return null;
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diff = Math.max(0, now - then);
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
}

export default function DashboardPage() {
    const { user, profile, ready, transitioning } = useRequireProfile();
    const { semesters, selectedTerm, setSelectedTerm, isSingleSemester } = useSemester();
    const semesterToggleRef = useRef(null);
    const semesterIndicatorRef = useRef(null);

    useLayoutEffect(() => {
        const toggle = semesterToggleRef.current;
        const indicator = semesterIndicatorRef.current;
        if (!toggle || !indicator) return;
        const idx = semesters.findIndex(s => s.term_code === selectedTerm);
        if (idx < 0) return;
        const buttons = toggle.querySelectorAll('button');
        const target = buttons[idx];
        if (!target) return;
        const togRect = toggle.getBoundingClientRect();
        const tgtRect = target.getBoundingClientRect();
        indicator.style.left = `${tgtRect.left - togRect.left}px`;
        indicator.style.width = `${tgtRect.width}px`;
    }, [selectedTerm, semesters]);

    // Group A: user-scoped, runs once profile is ready
    const [majorCourses, setMajorCourses] = useState(null); // [{course_id, course_name, category, credit_hours}]
    const [univElectives, setUnivElectives] = useState(null); // [{course_id, course_name, university_elective_basket}]

    // Elective category filter (All / Department / University)
    const [electiveFilter, setElectiveFilter] = useState('all');

    // Group B: term-scoped, refires on selectedTerm change
    const [termLoading, setTermLoading] = useState(true);
    const [activePostsCount, setActivePostsCount] = useState(0);
    const [pendingMatchesCount, setPendingMatchesCount] = useState(0);
    const [savedSchedules, setSavedSchedules] = useState([]);
    const [latestScheduleCredits, setLatestScheduleCredits] = useState(null);
    const [termSections, setTermSections] = useState([]); // sections for elective courses in selected term

    useEffect(() => {
        if (!ready || !profile?.major) return;
        const supabase = createClient();

        (async () => {
            const [{ data: mcRows }, { data: univRows }] = await Promise.all([
                supabase
                    .from('major_courses')
                    .select('course_id, category, courses(course_id, course_name)')
                    .eq('major_code', profile.major),
                supabase
                    .from('courses')
                    .select('course_id, course_name, university_elective_basket, restricted_majors')
                    .not('university_elective_basket', 'is', null),
            ]);

            const flat = (mcRows || []).map(r => ({
                course_id: r.course_id,
                category: r.category,
                course_name: r.courses?.course_name || '',
            }));
            setMajorCourses(flat);
            // Basket electives are shared with all majors unless restricted_majors limits them.
            const visibleUniv = (univRows || []).filter(c => {
                const r = c.restricted_majors;
                if (!r || r.length === 0) return true;
                return r.includes(profile.major);
            });
            setUnivElectives(visibleUniv);
        })();
    }, [ready, profile?.major]);

    useEffect(() => {
        if (!ready || !user || !selectedTerm || !majorCourses || !univElectives) return;
        const supabase = createClient();
        let cancelled = false;

        setTermLoading(true);

        const allowedCampuses = profile?.gender === 'male'
            ? ['main', 'men']
            : ['main', 'women'];

        const courseIds = Array.from(new Set([
            ...majorCourses.map(mc => mc.course_id),
            ...univElectives.map(c => c.course_id),
        ]));

        (async () => {
            const [postsRes, matchesRes, schedRes, sectionsRes] = await Promise.all([
                supabase
                    .from('posts')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .in('status', ['active', 'pending'])
                    .gt('expires_at', new Date().toISOString()),
                supabase
                    .from('match_participants')
                    .select('match_id, matches!inner(status, term_code)', { count: 'exact', head: true })
                    .eq('user_id', user.id)
                    .eq('matches.status', 'pending')
                    .eq('matches.term_code', selectedTerm),
                supabase
                    .from('saved_schedules')
                    .select('id, created_at, schedule_data')
                    .eq('user_id', user.id)
                    .eq('term_code', selectedTerm)
                    .order('created_at', { ascending: false }),
                courseIds.length > 0
                    ? supabase
                        .from('sections')
                        .select('course_id, section_num, instructor, campus, term_code')
                        .in('course_id', courseIds)
                        .in('campus', allowedCampuses)
                        .eq('term_code', selectedTerm)
                    : Promise.resolve({ data: [] }),
            ]);

            if (cancelled) return;
            setActivePostsCount(postsRes?.count ?? 0);
            setPendingMatchesCount(matchesRes?.count ?? 0);
            setSavedSchedules(schedRes?.data || []);
            setTermSections(sectionsRes?.data || []);
            setTermLoading(false);
        })();

        return () => { cancelled = true; };
    }, [ready, user, selectedTerm, majorCourses, univElectives, profile?.gender]);

    // Total credit hours in the most recently saved schedule
    useEffect(() => {
        const latest = savedSchedules[0];
        if (!latest) { setLatestScheduleCredits(null); return; }
        const courses = latest.schedule_data?.selectedCourses || [];
        const realIds = courses
            .map(c => c.course_id)
            .filter(id => id && !String(id).startsWith('BASKET_'));
        if (realIds.length === 0) { setLatestScheduleCredits(0); return; }

        const supabase = createClient();
        let cancelled = false;
        (async () => {
            const { data } = await supabase
                .from('courses')
                .select('course_id, credit_hours')
                .in('course_id', realIds);
            if (cancelled) return;
            const total = (data || []).reduce((s, r) => s + (r.credit_hours || 0), 0);
            setLatestScheduleCredits(total);
        })();
        return () => { cancelled = true; };
    }, [savedSchedules]);

    // Unified elective rows (dept + university baskets), only offered courses
    const electiveRows = useMemo(() => {
        if (!majorCourses || !univElectives) return [];
        const byCourse = termSections.reduce((acc, s) => {
            acc[s.course_id] = (acc[s.course_id] || 0) + 1;
            return acc;
        }, {});

        const dept = majorCourses
            .filter(mc => mc.category === 'Major Elective' || mc.category === 'Support Elective')
            .map(mc => ({
                course_id: mc.course_id,
                course_name: mc.course_name,
                kind: 'dept',
                tag: mc.category === 'Support Elective' ? 'support' : 'major',
                section_count: byCourse[mc.course_id] || 0,
            }));

        const univ = univElectives.map(c => ({
            course_id: c.course_id,
            course_name: c.course_name || '',
            kind: 'univ',
            tag: 'univ',
            section_count: byCourse[c.course_id] || 0,
        }));

        return [...dept, ...univ]
            .filter(r => r.section_count > 0)
            .sort((a, b) => a.course_id.localeCompare(b.course_id));
    }, [majorCourses, univElectives, termSections]);

    const filteredElectiveRows = useMemo(() => {
        if (electiveFilter === 'all') return electiveRows;
        return electiveRows.filter(r => r.kind === electiveFilter);
    }, [electiveRows, electiveFilter]);

    const electiveCounts = useMemo(() => ({
        all: electiveRows.length,
        dept: electiveRows.filter(r => r.kind === 'dept').length,
        univ: electiveRows.filter(r => r.kind === 'univ').length,
    }), [electiveRows]);

    const profileCompletion = useMemo(() => {
        if (!profile) return { pct: 0, filled: 0, total: PROFILE_FIELDS.length };
        const filled = PROFILE_FIELDS.filter(f => profile[f]).length;
        return { pct: Math.round((filled / PROFILE_FIELDS.length) * 100), filled, total: PROFILE_FIELDS.length };
    }, [profile]);

    const firstName = (profile?.name || '').trim().split(/\s+/)[0] || 'there';
    const currentSemesterName = semesters.find(s => s.term_code === selectedTerm)?.name || '';
    const showSemesterToggle = !isSingleSemester && semesters.length === 2;
    const showProfileBanner = ready && profile && profileCompletion.pct < 100;

    return (
        <div className={styles.page}>
            <AnnouncementsModal ready={ready && !!user} />
            <div className={`${styles.transitionOverlay} ${transitioning ? styles.active : ''}`} />

            <div className={styles.pageInner}>
                {/* ===== Hero ===== */}
                <section className={styles.hero}>
                    <div className={styles.heroLeft}>
                        <div className={styles.heroLogo}>
                            <Image src="/logo.png" alt="CourseMate" width={88} height={88} className={styles.heroLogoImage} />
                        </div>
                        <div className={styles.heroText}>
                            <span className={styles.heroGreeting}>
                                Hi, <span className={styles.heroAccent}>{firstName}</span>
                            </span>
                        </div>
                    </div>
                    <div className={styles.heroRight}>
                        {showSemesterToggle && (
                            <div className={styles.semesterToggle} ref={semesterToggleRef}>
                                <div
                                    ref={semesterIndicatorRef}
                                    className={styles.semesterIndicator}
                                />
                                {semesters.map((sem) => (
                                    <button
                                        key={sem.term_code}
                                        className={`${styles.semesterBtn} ${selectedTerm === sem.term_code ? styles.semesterBtnActive : ''}`}
                                        onClick={() => setSelectedTerm(sem.term_code)}
                                    >
                                        {sem.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* ===== Profile completeness banner (only if incomplete) ===== */}
                {showProfileBanner && (
                    <Link href="/profile" className={styles.profileBanner} style={{ textDecoration: 'none' }}>
                        <ProfileIcon width={22} height={22} />
                        <div className={styles.profileBannerText}>
                            <div className={styles.profileBannerTitle}>Finish setting up your profile</div>
                            <div className={styles.profileBannerSub}>
                                {profileCompletion.filled} of {profileCompletion.total} fields filled · tap to complete
                            </div>
                            <div className={styles.progressBar}>
                                <div className={styles.progressBarFill} style={{ width: `${profileCompletion.pct}%` }} />
                            </div>
                        </div>
                    </Link>
                )}

                {/* ===== Quick actions ===== */}
                <div className={styles.quickActions}>
                    <Link href="/post" className={styles.quickAction}>
                        <span className={styles.quickActionIcon}><PlusIcon width={20} height={20} /></span>
                        <span className={styles.quickActionLabel}>Create post</span>
                        <span className={styles.quickActionSub}>Swap, give away, or request a section</span>
                    </Link>
                    <Link href="/schedule" className={styles.quickAction}>
                        <span className={styles.quickActionIcon}><ScheduleIcon width={20} height={20} /></span>
                        <span className={styles.quickActionLabel}>Build schedule</span>
                        <span className={styles.quickActionSub}>Generate timetables for {currentSemesterName || 'the term'}</span>
                    </Link>
                    <Link href="/browse" className={styles.quickAction}>
                        <span className={styles.quickActionIcon}><SwapIcon width={20} height={20} /></span>
                        <span className={styles.quickActionLabel}>Swap</span>
                        <span className={styles.quickActionSub}>See active posts from your major</span>
                    </Link>
                    <Link href="/instructors" className={styles.quickAction}>
                        <span className={styles.quickActionIcon}><UserCheckIcon width={20} height={20} /></span>
                        <span className={styles.quickActionLabel}>Find instructor</span>
                        <span className={styles.quickActionSub}>Compare schedules across faculty</span>
                    </Link>
                </div>

                {/* ===== Cards grid ===== */}
                <div className={styles.grid}>
                    <DashboardCard
                        title="Schedule builder"
                        icon={<ScheduleIcon width={16} height={16} />}
                        loading={termLoading}
                    >
                        <div className={styles.statRow}>
                            <StatBig
                                value={savedSchedules.length}
                                max={3}
                                label="Saved schedules"
                                sub={savedSchedules[0] ? `Latest ${relativeTime(savedSchedules[0].created_at)}` : 'No schedules yet'}
                                tone={savedSchedules.length > 0 ? 'accent' : 'muted'}
                            />
                            {savedSchedules[0] && (
                                <>
                                    <div className={styles.statDivider} />
                                    <StatBig
                                        value={latestScheduleCredits ?? '—'}
                                        label="Credits"
                                        sub="In latest schedule"
                                        tone="accent"
                                    />
                                </>
                            )}
                        </div>
                    </DashboardCard>

                    <DashboardCard
                        title="My activity"
                        icon={<SwapIcon width={16} height={16} />}
                        actionLabel="Open Activity"
                        actionHref="/matches"
                        loading={termLoading}
                    >
                        <div className={styles.statRow}>
                            <StatBig
                                value={activePostsCount}
                                max={5}
                                label="Active posts"
                            />
                            <div className={styles.statDivider} />
                            <StatBig
                                value={pendingMatchesCount}
                                label="Pending matches"
                                tone={pendingMatchesCount > 0 ? 'accent' : 'muted'}
                            />
                        </div>
                    </DashboardCard>

                    <DashboardCard
                        className={styles.gridFull}
                        title={`Electives offered · ${currentSemesterName || 'this semester'}`}
                        icon={<BookIcon width={16} height={16} />}
                        loading={!majorCourses || !univElectives || termLoading}
                        empty={majorCourses && univElectives && electiveRows.length === 0
                            ? 'No electives are offered this semester.'
                            : undefined}
                    >
                        {electiveRows.length > 0 && (
                            <>
                                <div className={styles.electiveFilters}>
                                    {[
                                        { value: 'all', label: 'All' },
                                        { value: 'dept', label: 'Department' },
                                        { value: 'univ', label: 'University' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            className={`${styles.electiveFilter} ${electiveFilter === opt.value ? styles.electiveFilterActive : ''}`}
                                            onClick={() => setElectiveFilter(opt.value)}
                                            disabled={opt.value !== 'all' && electiveCounts[opt.value] === 0}
                                        >
                                            {opt.label}
                                            <span className={styles.electiveFilterCount}>{electiveCounts[opt.value]}</span>
                                        </button>
                                    ))}
                                </div>
                                {filteredElectiveRows.length === 0 ? (
                                    <div style={{ padding: '18px 4px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                        Nothing offered in this category this semester.
                                    </div>
                                ) : (
                                <div className={styles.electiveList}>
                                    {filteredElectiveRows.map(row => (
                                            <Link
                                                key={`${row.kind}-${row.course_id}`}
                                                href={`/schedule?course=${encodeURIComponent(row.course_id)}`}
                                                className={styles.electiveRow}
                                            >
                                                <span className={`${styles.kindTag} ${styles[`kindTag_${row.tag}`]}`}>
                                                    {row.tag === 'support' ? 'SUPPORT' : row.tag === 'major' ? 'DEPT' : 'UNIV'}
                                                </span>
                                                <div className={styles.electiveMain}>
                                                    <span className={styles.electiveName}>{row.course_name || 'Unnamed course'}</span>
                                                    <span className={styles.electiveCode}>{row.course_id}</span>
                                                </div>
                                                <span className={`${styles.electiveBadge} ${styles.electiveBadgeOpen}`}>
                                                    {row.section_count} section{row.section_count === 1 ? '' : 's'}
                                                </span>
                                            </Link>
                                    ))}
                                </div>
                                )}
                            </>
                        )}
                    </DashboardCard>
                </div>
            </div>

            <BottomNav />
        </div>
    );
}
