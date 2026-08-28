'use client';

import PageShell from '@/components/PageShell';
import PageHeader from '@/components/PageHeader';
import InstructorFinder from '@/components/InstructorFinder';

/**
 * Kept as its own route so the Home quick action and existing bookmarks still
 * resolve. The same finder is also a mode of the Schedule page.
 */
export default function InstructorsPage() {
    return (
        <PageShell>
            <PageHeader title="Instructor Schedule" />
            <InstructorFinder />
        </PageShell>
    );
}
