import { redirect } from 'next/navigation';

/**
 * The instructor finder lives on the Schedule page, as its "Find instructor"
 * mode. This route only keeps old links and bookmarks working.
 */
export default function InstructorsPage() {
    redirect('/schedule?mode=instructor');
}
