'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { 
  LayoutDashboard, BookOpen, MessageSquare, BarChart3, Settings,
  Video, History, ScrollText, Lightbulb, User, LogOut, BrainCircuit
} from 'lucide-react';
import { ProfileWizard } from './ProfileWizard';

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ portalType: string }>();
  const portalType = params?.portalType || 'b2c';

  const [profile, setProfile] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [branding, setBranding] = useState<any>(null);

  useEffect(() => {
    const fetchAuth = async () => {
      try {
        const res = await fetch('/api/students/dashboard');
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          setUser(data.user);
          setIsLocked(data.completionStatus?.isComplete && !data.profile?.assessmentCompleted);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchAuth();
  }, []);

  useEffect(() => {
    if (portalType === 'b2b') {
      const fetchBranding = async () => {
        try {
          const res = await fetch('/api/b2b/branding');
          if (res.ok) {
            const data = await res.json();
            setBranding(data);
          }
        } catch (err) {
          console.error(err);
        }
      };
      fetchBranding();
    }
  }, [portalType]);

  const handleLogout = async () => {
    // Intercept logout during active exam
    if (typeof window !== 'undefined' && (window as any).__ACTIVE_EXAM_SESSION) {
      const event = new CustomEvent('EXAM_LEAVE_ATTEMPT', { detail: { path: 'LOGOUT' } });
      window.dispatchEvent(event);
      return;
    }

    // Intercept logout during active interview — same lockdown contract as the exam
    // so the candidate cannot silently abandon a session and re-attempt later.
    if (typeof window !== 'undefined' && (window as any).__ACTIVE_INTERVIEW_SESSION) {
      const event = new CustomEvent('INTERVIEW_LEAVE_ATTEMPT', { detail: { path: 'LOGOUT' } });
      window.dispatchEvent(event);
      return;
    }

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } catch (err) {}
  };

  const dashboardPath = `/dashboard/${portalType}`;
  const portalPrefix = `/dashboard/${portalType}`;

  // Filter nav items based on B2B portal access
  const enabledPortals: string[] | null = user?.enabledPortals || null;

  const allNavItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: dashboardPath, portal: null },
    ...(portalType === 'b2b' ? [
      { name: 'Batches', icon: BookOpen, path: `${portalPrefix}/batches`, portal: null },
      { name: 'Chat', icon: MessageSquare, path: `${portalPrefix}/chat`, portal: null }
    ] : []),
    { name: 'Interview', icon: Video, path: `${portalPrefix}/interview`, portal: 'interview' },
    { name: 'Interview History', icon: History, path: `${portalPrefix}/interview-history`, portal: 'interview' },
    { name: 'Exam Practice', icon: BookOpen, path: `${portalPrefix}/practice`, portal: 'exam' },
    { name: 'Exam History', icon: ScrollText, path: `${portalPrefix}/exam-history`, portal: 'exam' },
    { name: 'Progress', icon: BarChart3, path: `${portalPrefix}/progress`, portal: null },
    { name: 'Recommendations', icon: Lightbulb, path: `${portalPrefix}/recommendations`, portal: 'recommendation' },
    { name: 'Resume Analyzer', icon: ScrollText, path: `${portalPrefix}/resume`, portal: 'resume' },
    { name: 'Profile', icon: User, path: `${portalPrefix}/profile`, portal: null },
  ];

  // If enabledPortals is set (B2B mentee), filter to only show allowed portals
  const navItems = enabledPortals
    ? allNavItems.filter(item => item.portal === null || enabledPortals.includes(item.portal))
    : allNavItems;

  return (
    <>
      {showEditProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <ProfileWizard 
            pendingFields={['education', 'interests']} 
            onComplete={() => {
              setShowEditProfile(false);
              window.location.reload();
            }} 
          />
        </div>
      )}
      <div className="w-64 border-r border-white/5 bg-[#0a0a0b] flex-col h-screen sticky left-0 top-0 overflow-y-auto z-10 hidden md:flex shrink-0">
        <div className="p-6 flex items-center gap-3">
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
          ) : (
            <div 
              className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400"
              style={branding?.primaryColor ? { backgroundColor: `${branding.primaryColor}20`, color: branding.primaryColor } : {}}
            >
              <BrainCircuit size={20} />
            </div>
          )}
          <div>
            <div className="font-bold text-sm tracking-wide text-white leading-tight truncate max-w-[140px]">
              {portalType === 'b2b' ? (user?.collegeName || profile?.collegeName || 'AI Interview') : 'AI Interview'}
            </div>
            <div 
              className="text-xs text-amber-500/80 font-medium"
              style={branding?.primaryColor ? { color: branding.primaryColor } : {}}
            >
              {portalType === 'b2b' ? 'Portal' : 'Coach'}
            </div>
          </div>
        </div>

        <div className="px-4 mb-6">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
            <div 
              className="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center font-bold text-xs"
              style={branding?.primaryColor ? { backgroundColor: branding.primaryColor } : {}}
            >
              {profile?.fullName?.substring(0, 2).toUpperCase() || 'ST'}
            </div>
             <div className="overflow-hidden">
              <div className="text-sm font-medium text-white truncate">{profile?.fullName || 'Student'}</div>
              <div className="text-xs text-[#a1a1aa] truncate">{user?.collegeName || 'Free Plan'}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.path || (item.path !== dashboardPath && pathname.startsWith(item.path));
            return (
              <button 
                key={item.name}
                disabled={isLocked && item.name !== 'Dashboard' && item.name !== 'Profile'}
                onClick={() => {
                  // Global check for active exam session
                  if (typeof window !== 'undefined' && (window as any).__ACTIVE_EXAM_SESSION) {
                    const event = new CustomEvent('EXAM_LEAVE_ATTEMPT', { detail: { path: item.path } });
                    window.dispatchEvent(event);
                    return;
                  }
                  // Global check for active interview session — mirrors exam lockdown.
                  if (typeof window !== 'undefined' && (window as any).__ACTIVE_INTERVIEW_SESSION) {
                    const event = new CustomEvent('INTERVIEW_LEAVE_ATTEMPT', { detail: { path: item.path } });
                    window.dispatchEvent(event);
                    return;
                  }
                  router.push(item.path);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active 
                  ? 'bg-[#18181b] border border-white/5' 
                  : (isLocked && item.name !== 'Dashboard' && item.name !== 'Profile')
                    ? 'opacity-30 cursor-not-allowed text-[#a1a1aa]'
                    : 'text-[#a1a1aa] hover:text-white hover:bg-white/5 border border-transparent'
                }`}
                style={active && branding?.primaryColor ? { color: branding.primaryColor } : {}}
              >
                <item.icon 
                  size={18} 
                  className={active ? '' : 'text-[#a1a1aa]'} 
                  style={active && branding?.primaryColor ? { color: branding.primaryColor } : {}}
                />
                {item.name}
                {active && (
                  <div 
                    className="ml-auto w-1.5 h-1.5 rounded-full" 
                    style={{ backgroundColor: branding?.primaryColor || '#f59e0b' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 mt-auto space-y-2 border-t border-white/5">
          <button 
            onClick={() => router.push(`${portalPrefix}/profile`)}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#a1a1aa] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
          >
            <Settings size={18} />
            Settings
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#a1a1aa] hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}