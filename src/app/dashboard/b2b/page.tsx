import LogoutButton from '@/app/components/LogoutButton';
import Link from 'next/link';

export default function B2BDashboard() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>B2B Student Dashboard</h1>
      <p>Welcome to your institution-sponsored dashboard.</p>
      <LogoutButton />
      <div style={{ marginTop: '10px' }}>
        <Link href="/">Back to Home</Link>
      </div>
    </div>
  );
}
