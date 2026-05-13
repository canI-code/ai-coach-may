'use client';
import { useRouter } from 'next/navigation';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (res.ok) {
        router.push('/');
        router.refresh(); // Ensure the proxy/middleware re-evaluates
      }
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  return (
    <button 
      onClick={handleLogout}
      style={{
        padding: '10px 20px',
        backgroundColor: '#ff4444',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        marginTop: '20px'
      }}
    >
      Logout
    </button>
  );
}
