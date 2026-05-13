import LogoutButton from '@/app/components/LogoutButton';
import Link from 'next/link';

export default function B2CDashboard() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>B2C Dashboard (Student/Professional)</h1>
      <p>Welcome to your personalized AI coaching dashboard.</p>
      <LogoutButton />
      <div style={{ marginTop: '10px' }}>
        <Link href="/">Back to Home</Link>
      </div>
    </div>
  );
}
