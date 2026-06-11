'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { Loader2 } from 'lucide-react';
import { Sidebar } from '@/app/dashboard/[portalType]/components/Sidebar';

export default function B2BLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const verifyAccess = async () => {
      try {
        const res = await fetch('/api/students/dashboard');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        setIsAuthorized(true);
      } catch (err) {
        console.error('Layout Auth Error:', err);
      } finally {
        setLoading(false);
      }
    };

    verifyAccess();
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-4">
        <AmbientGlow />
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
        <p className="text-[#a1a1aa] font-medium animate-pulse">Verifying institutional access...</p>
      </div>
    );
  }

  if (!isAuthorized) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex font-sans">
      <Sidebar />
      <div className="flex-1 overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
