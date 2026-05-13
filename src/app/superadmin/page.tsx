import LogoutButton from '@/app/components/LogoutButton';
import Link from 'next/link';

export default function SuperAdminDashboard() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Super Admin Dashboard</h1>
      <p>This route is hidden and only accessible via manual URL entry.</p>
      <LogoutButton />
      <div style={{ marginTop: '10px' }}>
        <Link href="/">Back to Home</Link>
      </div>
    </div>
  );
}
