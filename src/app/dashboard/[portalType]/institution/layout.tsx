'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { 
  LayoutDashboard, Users, UserPlus, CreditCard, BarChart3, 
  User, LogOut, BrainCircuit, Settings, Building2, Palette
} from 'lucide-react';

export default function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<any>(null);
  const [branding, setBranding] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/b2b/institution/profile');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        } else if (res.status === 401) {
          router.push('/login');
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchProfile();
  }, [router]);

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const res = await fetch('/api/b2b/branding');
        if (res.ok) {
          const data = await res.json();
          setBranding(data);
        }
      } catch (err) {
        console.error('Failed to fetch institution layout branding:', err);
      }
    };
    fetchBranding();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } catch {}
  };

  const basePath = '/dashboard/b2b/institution';
  const navItems = [
    { name: 'Overview', icon: LayoutDashboard, path: basePath },
    { name: 'Mentors', icon: Users, path: `${basePath}/mentors` },
    { name: 'Credits', icon: CreditCard, path: `${basePath}/credits` },
    { name: 'Settings', icon: Settings, path: `${basePath}/settings` },
    { name: 'Profile', icon: User, path: `${basePath}/profile` },
  ];

  return (
    <div className="flex min-h-screen bg-[#050506]">
      {/* Sidebar */}
      <div className="w-64 border-r border-white/5 bg-[#0a0a0b] flex-col h-screen sticky left-0 top-0 overflow-y-auto z-10 hidden md:flex shrink-0">
        <div className="p-6 flex items-center gap-3">
          {branding?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
          ) : (
            <div 
              className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400"
              style={branding?.primaryColor ? { backgroundColor: `${branding.primaryColor}20`, color: branding.primaryColor } : {}}
            >
              <Building2 size={20} />
            </div>
          )}
          <div>
            <div className="font-bold text-sm tracking-wide text-white leading-tight truncate max-w-[140px]">
              {profile?.collegeName || 'Institution'}
            </div>
            <div 
              className="text-xs text-purple-500/80 font-medium"
              style={branding?.primaryColor ? { color: branding.primaryColor } : {}}
            >
              Dashboard
            </div>
          </div>
        </div>

        <div className="px-4 mb-6">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
            <div 
              className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold text-xs"
              style={branding?.primaryColor ? { backgroundColor: branding.primaryColor } : {}}
            >
              {profile?.representativeName?.substring(0, 2).toUpperCase() || 'IN'}
            </div>
            <div className="overflow-hidden">
              <div className="text-sm font-medium text-white truncate">{profile?.collegeName || 'Institution'}</div>
              <div className="text-xs text-[#a1a1aa] truncate">{profile?.representativeName || 'Representative'}</div>
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
                  ? 'bg-[#18181b] border border-white/5' 
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
                    style={{ backgroundColor: branding?.primaryColor || '#a855f7' }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4 mt-auto space-y-2 border-t border-white/5">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#a1a1aa] hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer">
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
