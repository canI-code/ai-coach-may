'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, Users, BarChart3, UserPlus, 
  Settings, LogOut, BrainCircuit, User
} from 'lucide-react';

export default function MentorSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/mentor/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } catch (err) {}
  };

  const navItems = [
    { name: 'Overview', icon: LayoutDashboard, path: '/dashboard/mentor' },
    { name: 'Student Profiles', icon: Users, path: '/dashboard/mentor/students' },
    { name: 'Analytics', icon: BarChart3, path: '/dashboard/mentor/analytics' },
    { name: 'Invite Setup', icon: UserPlus, path: '/dashboard/mentor/invite' },
    { name: 'Profile', icon: User, path: '/dashboard/mentor/profile' },
  ];

  return (
    <div className="w-64 border-r border-white/5 bg-[#0a0a0b] flex-col h-screen sticky left-0 top-0 overflow-y-auto z-10 hidden md:flex shrink-0">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">
          <BrainCircuit size={20} />
        </div>
        <div>
          <div className="font-bold text-sm tracking-wide text-white leading-tight">AI Interview</div>
          <div className="text-xs text-emerald-500/80">Mentor Portal</div>
        </div>
      </div>

      {/* User Info card */}
      <div className="px-4 mb-6">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-black flex items-center justify-center font-bold text-xs">
            {profile?.fullName?.substring(0, 2).toUpperCase() || 'ME'}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-medium text-white truncate">{profile?.fullName || 'Mentor'}</div>
            <div className="text-xs text-[#a1a1aa] truncate">{profile?.collegeName || 'Institution'}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.path || (item.path !== '/dashboard/mentor' && pathname.startsWith(item.path));
          return (
            <button 
              key={item.name}
              onClick={() => router.push(item.path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                active 
                ? 'bg-[#18181b] text-emerald-400 border border-white/5' 
                : 'text-[#a1a1aa] hover:text-white hover:bg-white/5 border border-transparent'
              }`}
            >
              <item.icon size={18} className={active ? 'text-emerald-400' : 'text-[#a1a1aa]'} />
              {item.name}
              {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />}
            </button>
          );
        })}
      </div>

      {/* Footer Settings & SignOut */}
      <div className="p-4 mt-auto space-y-2 border-t border-white/5">
        <button 
          onClick={() => router.push('/dashboard/mentor/profile')}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#a1a1aa] hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
        >
          <Settings size={18} />
          Portal Settings
        </button>
        <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#a1a1aa] hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer">
          <LogOut size={18} />
          Sign Out
        </button>
      </div>
    </div>
  );
}
