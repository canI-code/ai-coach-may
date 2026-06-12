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
  const [userRole, setUserRole] = useState<string>('student');

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
        const userRole = data.user?.role || 'student';
        setUserRole(userRole);

        // Determine correct portal type path based on role
        let correctPath = '';
        if (userRole === 'admin') {
          if (pathname !== '/admin') correctPath = '/admin';
        } else if (userRole === 'superadmin') {
          if (pathname !== '/superadmin') correctPath = '/superadmin';
        } else if (userRole === 'institution') {
          if (!pathname.startsWith('/dashboard/b2b/institution')) {
            correctPath = '/dashboard/b2b/institution';
          }
        } else if (userRole === 'mentor') {
          if (!pathname.startsWith('/dashboard/b2b/mentor')) {
            correctPath = '/dashboard/b2b/mentor';
          }
        } else if (userRole === 'mentee') {
          if (portalType !== 'b2b') {
            correctPath = '/dashboard/b2b';
          }
        } else {
          // B2C: student / professional
          if (portalType !== 'b2c') {
            correctPath = '/dashboard/b2c';
          }
        }

        if (correctPath) {
          router.replace(correctPath);
          return;
        }

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

  const showStudentSidebar = userRole === 'student' || userRole === 'professional' || userRole === 'mentee';

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex font-sans">
      {showStudentSidebar && <Sidebar />}
      <div className={showStudentSidebar ? "flex-1 overflow-x-hidden" : "flex-1"}>
        {children}
      </div>
    </div>
  );
}
