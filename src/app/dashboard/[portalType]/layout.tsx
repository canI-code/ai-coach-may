'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';
import { Loader2 } from 'lucide-react';
import { Sidebar } from './components/Sidebar';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();
  const portalType = (params?.portalType as string) || 'b2c';
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
        
        const data = await res.json();
        const profile = data.profile;
        const assessmentCompleted = profile?.assessmentCompleted;

        // Path logic
        const isMainDashboard = pathname === `/dashboard/${portalType}`;
        const isAssessmentPage = pathname === `/dashboard/${portalType}/assessment`;

        if (portalType === 'b2c' && !assessmentCompleted) {
          // If assessment not done, ONLY allow main dashboard (which shows the prompt) 
          // and the assessment page itself.
          if (!isMainDashboard && !isAssessmentPage) {
            console.warn('🚫 Access Denied: Assessment pending. Redirecting to dashboard.');
            router.replace(`/dashboard/${portalType}`);
            return;
          }
        }

        setIsAuthorized(true);
      } catch (err) {
        console.error('Layout Auth Error:', err);
      } finally {
        setLoading(false);
      }
    };

    verifyAccess();
  }, [pathname, router, portalType]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-4">
        <AmbientGlow />
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-4" />
        <p className="text-[#a1a1aa] font-medium animate-pulse">Verifying access...</p>
      </div>
    );
  }

  // If unauthorized but loading is done, we are usually in the middle of a redirect
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
