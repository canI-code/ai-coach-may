'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Users, UserPlus, CreditCard, MessageSquare, 
  User, LogOut, BookOpen, Send, Link2
} from 'lucide-react';

export default function MentorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/b2b/mentor/profile');
        if (res.ok) setProfile(await res.json());
        else if (res.status === 401) router.push('/login');
      } catch {}
    };
    fetchProfile();
  }, [router]);

  const handleLogout = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/'); router.refresh(); } catch {}
  };

  const basePath = '/dashboard/b2b/mentor';
  const navItems = [
    { name: 'Overview', icon: LayoutDashboard, path: basePath },
    { name: 'Invite', icon: Link2, path: `${basePath}/invite` },
    { name: 'Batches', icon: BookOpen, path: `${basePath}/batches` },
    { name: 'Credits', icon: CreditCard, path: `${basePath}/credits` },
    { name: 'Chat', icon: MessageSquare, path: `${basePath}/chat` },
    { name: 'Profile', icon: User, path: `${basePath}/profile` },
  ];

  return (
    <div className="flex min-h-screen bg-[#050506]">
      <div className="w-64 border-r border-white/5 bg-[#0a0a0b] flex-col h-screen sticky left-0 top-0 overflow-y-auto z-10 hidden md:flex shrink-0">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400">
            <Users size={20} />
          </div>
          <div>
            <div className="font-bold text-sm tracking-wide text-white leading-tight">Mentor</div>
            <div className="text-xs text-teal-500/80">Dashboard</div>
          </div>
        </div>

        <div className="px-4 mb-6">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
            <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-xs">
              {profile?.fullName?.substring(0, 2).toUpperCase() || 'MT'}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-white truncate">{profile?.fullName || 'Mentor'}</div>
              <div className="text-xs text-[#a1a1aa] truncate">{profile?.collegeName || ''}</div>
            </div>
          </div>
        </div>

        <div className="flex-1 px-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.path;
            return (
              <button
                key={item.name}
                onClick={() => router.push(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                  active
                  ? 'bg-[#18181b] text-teal-400 border border-white/5'
                  : 'text-[#a1a1aa] hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              >
                <item.icon size={18} className={active ? 'text-teal-400' : 'text-[#a1a1aa]'} />
                {item.name}
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-teal-400" />}
              </button>
            );
          })}
        </div>

        <div className="p-4 mt-auto border-t border-white/5">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#a1a1aa] hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
