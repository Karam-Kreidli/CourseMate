import { notFound } from 'next/navigation';
import { getAdminUser } from '@/lib/admin';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
    const user = await getAdminUser();
    if (!user) notFound();
    return <AdminClient />;
}
