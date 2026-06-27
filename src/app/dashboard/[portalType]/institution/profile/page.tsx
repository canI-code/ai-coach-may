'use client';

import { useState, useEffect } from 'react';
import { GlassCard } from '@/app/components/ui';
import { User, Mail, Phone, Building2, Loader2, FileText, Download, CreditCard, Calendar } from 'lucide-react';
import { generateInvoicePDF } from '@/lib/b2b/invoice';

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
    { label: 'Activated', value: profile?.activatedAt ? new Date(profile.activatedAt).toLocaleDateString() : 'N/A', icon: Calendar },
    { label: 'Database', value: profile?.dbName, icon: Building2 },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Institution Profile & Billing</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Details */}
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

        <div className="space-y-6">
          {/* Purchase/Plan Details */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <CreditCard className="w-6 h-6 text-purple-400" />
                <h2 className="text-lg font-bold text-white">Plan Details</h2>
              </div>
              <button 
                onClick={() => generateInvoicePDF(profile)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                Download Invoice
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-white/5 p-4 rounded-lg">
                <div className="text-sm text-[#a1a1aa] mb-1">Current Plan</div>
                <div className="text-xl font-semibold text-white">
                  {profile?.plan?.duration || 'N/A'} - {profile?.plan?.enabledPortals?.join(', ') || 'N/A'}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-lg">
                  <div className="text-sm text-[#a1a1aa] mb-1">Total Credits</div>
                  <div className="text-lg font-medium text-white">{profile?.plan?.totalCredits || 0}</div>
                </div>
                <div className="bg-white/5 p-4 rounded-lg">
                  <div className="text-sm text-[#a1a1aa] mb-1">Used Credits</div>
                  <div className="text-lg font-medium text-white">{profile?.plan?.usedCredits || 0}</div>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Verification Documents */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <FileText className="w-6 h-6 text-emerald-400" />
              <h2 className="text-lg font-bold text-white">Verification Documents</h2>
            </div>

            <div className="space-y-3">
              {profile?.documents ? (
                <>
                  {profile.documents.documentLocalPath && (
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-[#a1a1aa]" />
                        <span className="text-sm text-white">Registration Document</span>
                      </div>
                      <a href={profile.documents.documentLocalPath.replace('./public', '')} target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300 text-sm">
                        View
                      </a>
                    </div>
                  )}
                  {profile.documents.aadhaarLocalPath && (
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-[#a1a1aa]" />
                        <span className="text-sm text-white">Aadhaar Card</span>
                      </div>
                      <a href={profile.documents.aadhaarLocalPath.replace('./public', '')} target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300 text-sm">
                        View
                      </a>
                    </div>
                  )}
                  {profile.documents.selfieLocalPath && (
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-[#a1a1aa]" />
                        <span className="text-sm text-white">Selfie</span>
                      </div>
                      <a href={profile.documents.selfieLocalPath.replace('./public', '')} target="_blank" rel="noreferrer" className="text-purple-400 hover:text-purple-300 text-sm">
                        View
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-[#a1a1aa] text-center py-4">No documents uploaded.</div>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
