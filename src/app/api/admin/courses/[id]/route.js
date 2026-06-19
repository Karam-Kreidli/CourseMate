import { NextResponse } from 'next/server';
import { getAdminUser, createAdminClient } from '@/lib/admin';

// Categories an admin sets by hand, per major.
const ALLOWED_CATEGORIES = ['Core', 'Major Elective', 'Support Elective'];
// Category that is derived from the course-level basket flag (not hand-edited).
const MANAGED_CATEGORY = 'University Elective';

// Update a course's properties and its major memberships (with elective category).
export async function PATCH(request, { params }) {
    const admin = await getAdminUser();
    if (!admin) return new NextResponse('Not found', { status: 404 });

    const { id } = await params;
    const courseId = String(id || '').trim();
    if (!courseId) return NextResponse.json({ error: 'Missing course id' }, { status: 400 });

    const body = await request.json();
    const supabase = createAdminClient();

    // ── Course-level fields ──
    const update = {};
    if (typeof body.course_name === 'string') {
        const name = body.course_name.trim();
        if (!name) return NextResponse.json({ error: 'Course name cannot be empty' }, { status: 400 });
        update.course_name = name;
    }
    if (body.credit_hours !== undefined) {
        update.credit_hours = Number.isFinite(+body.credit_hours) ? +body.credit_hours : 0;
    }
    if (body.university_elective_basket !== undefined) {
        const basket = (body.university_elective_basket || '').trim();
        update.university_elective_basket = basket || null;
    }
    if (body.restricted_majors !== undefined) {
        const list = Array.isArray(body.restricted_majors)
            ? [...new Set(body.restricted_majors.map(c => String(c).trim()).filter(Boolean))]
            : [];
        // Empty = shared with all majors → store NULL.
        update.restricted_majors = list.length ? list : null;
    }

    if (Object.keys(update).length > 0) {
        const { error } = await supabase.from('courses').update(update).eq('course_id', courseId);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // ── Manual major memberships (Core / Major Elective / Support Elective) ──
    // University-elective rows are NOT hand-edited here; they are derived from the
    // basket flag below, so the reconcile is scoped to the manual categories only.
    if (Array.isArray(body.majors)) {
        const cleaned = [];
        const seen = new Set();
        for (const m of body.majors) {
            const major_code = String(m.major_code || '').trim();
            const category = String(m.category || '').trim();
            if (!major_code || seen.has(major_code)) continue;
            if (!ALLOWED_CATEGORIES.includes(category)) {
                return NextResponse.json({ error: `Invalid category "${category}" for ${major_code}` }, { status: 400 });
            }
            seen.add(major_code);
            cleaned.push({ major_code, course_id: courseId, category });
        }

        const { data: current, error: curErr } = await supabase
            .from('major_courses')
            .select('major_code')
            .eq('course_id', courseId)
            .in('category', ALLOWED_CATEGORIES);
        if (curErr) return NextResponse.json({ error: curErr.message }, { status: 500 });

        const desiredCodes = new Set(cleaned.map(c => c.major_code));
        const toDelete = (current || []).map(r => r.major_code).filter(code => !desiredCodes.has(code));

        if (toDelete.length > 0) {
            const { error } = await supabase
                .from('major_courses')
                .delete()
                .eq('course_id', courseId)
                .in('major_code', toDelete)
                .in('category', ALLOWED_CATEGORIES);
            if (error) return NextResponse.json({ error: `Remove majors failed: ${error.message}` }, { status: 500 });
        }

        if (cleaned.length > 0) {
            const { error } = await supabase
                .from('major_courses')
                .upsert(cleaned, { onConflict: 'major_code,course_id' });
            if (error) return NextResponse.json({ error: `Save majors failed: ${error.message}` }, { status: 500 });
        }
    }

    // ── Derived University-elective memberships ──
    // A basket course belongs to every major's catalog (or to restricted_majors only).
    // Keep those rows in sync with the current basket flag + restriction.
    {
        const { data: courseRow, error: crErr } = await supabase
            .from('courses')
            .select('university_elective_basket, restricted_majors')
            .eq('course_id', courseId)
            .single();
        if (crErr) return NextResponse.json({ error: crErr.message }, { status: 500 });

        let targetMajors = [];
        if (courseRow.university_elective_basket) {
            const restricted = Array.isArray(courseRow.restricted_majors) ? courseRow.restricted_majors : null;
            if (restricted && restricted.length) {
                targetMajors = restricted;
            } else {
                const { data: allMajors } = await supabase.from('majors').select('code');
                targetMajors = (allMajors || []).map(m => m.code);
            }
        }

        const { data: curUE } = await supabase
            .from('major_courses')
            .select('major_code')
            .eq('course_id', courseId)
            .eq('category', MANAGED_CATEGORY);
        const targetSet = new Set(targetMajors);
        const ueToDelete = (curUE || []).map(r => r.major_code).filter(code => !targetSet.has(code));

        if (ueToDelete.length > 0) {
            const { error } = await supabase
                .from('major_courses')
                .delete()
                .eq('course_id', courseId)
                .eq('category', MANAGED_CATEGORY)
                .in('major_code', ueToDelete);
            if (error) return NextResponse.json({ error: `Sync basket majors failed: ${error.message}` }, { status: 500 });
        }

        if (targetMajors.length > 0) {
            const rows = targetMajors.map(code => ({ major_code: code, course_id: courseId, category: MANAGED_CATEGORY }));
            const { error } = await supabase
                .from('major_courses')
                .upsert(rows, { onConflict: 'major_code,course_id' });
            if (error) return NextResponse.json({ error: `Sync basket majors failed: ${error.message}` }, { status: 500 });
        }
    }

    return NextResponse.json({ success: true });
}
