'use client';

import { useState, useEffect } from 'react';
import { GlassCard, CardTitle } from '@/app/components/ui';
import { User, Mail, Phone, Building2, Loader2 } from 'lucide-react';

export default function InstitutionProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/b2b/institution/profile');
        if (res.ok) setProfile(await res.json());
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    };
    fetchProfile();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-purple-400 animate-spin" /></div>;
  }

  const info = [
    { label: 'Institution Name', value: profile?.collegeName, icon: Building2 },
    { label: 'Representative', value: profile?.representativeName, icon: User },
    { label: 'Email', value: profile?.representativeEmail, icon: Mail },
    { label: 'Phone', value: profile?.representativePhone, icon: Phone },
    { label: 'Location', value: profile?.location || 'Not set', icon: Building2 },
    { label: 'Activated', value: profile?.activatedAt ? new Date(profile.activatedAt).toLocaleDateString() : 'N/A', icon: Building2 },
    { label: 'Database', value: profile?.dbName, icon: Building2 },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white">Institution Profile</h1>

      <GlassCard className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
            <Building2 className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{profile?.collegeName}</h2>
            <p className="text-sm text-[#a1a1aa]">Status: <span className="text-emerald-400">{profile?.status}</span></p>
          </div>
        </div>

        <div className="space-y-4">
          {info.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4 text-[#a1a1aa]" />
                <span className="text-sm text-[#a1a1aa]">{item.label}</span>
              </div>
              <span className="text-sm text-white font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
