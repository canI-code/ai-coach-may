'use client';

import { useState, useEffect } from 'react';
import { GlassCard } from '@/app/components/ui';
import { User, Mail, Phone, Building2, Loader2, BookOpen } from 'lucide-react';

export default function MentorProfile() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/b2b/mentor/profile');
        if (res.ok) setProfile(await res.json());
      } catch {} finally { setLoading(false); }
    };
    fetchProfile();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>;

  const info = [
    { label: 'Full Name', value: profile?.fullName, icon: User },
    { label: 'Email', value: profile?.email, icon: Mail },
    { label: 'Phone', value: profile?.phone || 'Not set', icon: Phone },
    { label: 'College', value: profile?.collegeName, icon: Building2 },
    { label: 'Department', value: profile?.department || 'N/A', icon: BookOpen },
    { label: 'Year / Batch', value: profile?.year || 'N/A', icon: BookOpen },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-white">My Profile</h1>
      <GlassCard className="p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">{profile?.fullName}</h2>
            <p className="text-sm text-[#a1a1aa]">Mentor · {profile?.collegeName}</p>
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
