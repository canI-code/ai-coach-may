'use client';

import { useState, useEffect } from 'react';
import { GlassCard, CardTitle, Button, Input } from '@/app/components/ui';
import { Palette, Link, Type, Save, Check, RefreshCw, Eye, Sparkles } from 'lucide-react';

const COLOR_PRESETS = [
  { name: 'Amber', primary: '#f59e0b', secondary: '#d97706', class: 'bg-amber-500' },
  { name: 'Purple', primary: '#8b5cf6', secondary: '#7c3aed', class: 'bg-violet-500' },
  { name: 'Teal', primary: '#14b8a6', secondary: '#0d9488', class: 'bg-teal-500' },
  { name: 'Emerald', primary: '#10b981', secondary: '#059669', class: 'bg-emerald-500' },
];

export default function BrandingPage() {
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#f59e0b');
  const [secondaryColor, setSecondaryColor] = useState('#d97706');
  const [welcomeBannerText, setWelcomeBannerText] = useState('');
  const [collegeName, setCollegeName] = useState('Your Institution');
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        const res = await fetch('/api/b2b/institution/profile');
        if (res.ok) {
          const data = await res.json();
          setCollegeName(data.collegeName || 'Your Institution');
          if (data.branding) {
            setLogoUrl(data.branding.logoUrl || '');
            setPrimaryColor(data.branding.primaryColor || '#f59e0b');
            setSecondaryColor(data.branding.secondaryColor || '#d97706');
            setWelcomeBannerText(data.branding.welcomeBannerText || '');
          }
        }
      } catch (err) {
        console.error('Failed to load institution branding:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBranding();
  }, []);

  const handleApplyPreset = (preset: typeof COLOR_PRESETS[number]) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError('');

    // Hex validation
    const hexRegex = /^#[0-9A-F]{6}$/i;
    if (!hexRegex.test(primaryColor)) {
      setError('Primary color must be a valid hex code (e.g. #F59E0B)');
      setSaving(false);
      return;
    }
    if (!hexRegex.test(secondaryColor)) {
      setError('Secondary color must be a valid hex code (e.g. #D97706)');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/b2b/institution/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          logoUrl,
          primaryColor,
          secondaryColor,
          welcomeBannerText,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save branding settings.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
        <p className="text-sm text-[#a1a1aa]">Loading branding configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl pb-12">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-purple-400" />
          Whitelabel & Custom Branding
        </h1>
        <p className="text-[#a1a1aa] mt-1 text-sm">
          Customize the logo, color palette, and greetings for your students and mentors.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Settings Form */}
        <div className="lg:col-span-7">
          <GlassCard className="p-6 h-full flex flex-col justify-between">
            <form onSubmit={handleSave} className="space-y-6">
              <CardTitle className="flex items-center gap-2 mb-2 text-xl font-bold text-white border-b border-white/5 pb-4">
                <Palette className="w-5 h-5 text-purple-400" />
                Branding Details
              </CardTitle>

              {error && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Branding settings updated successfully!
                </div>
              )}

              {/* Logo URL */}
              <div className="space-y-2">
                <Input
                  label="Logo Image URL"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  icon={<Link size={16} />}
                />
                <p className="text-xs text-[#a1a1aa]">
                  Provide a direct link to a transparent PNG or SVG logo.
                </p>
              </div>

              {/* Color Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Input
                    label="Primary Theme Color (Hex)"
                    placeholder="#f59e0b"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    icon={<Palette size={16} />}
                  />
                </div>
                <div className="space-y-2">
                  <Input
                    label="Secondary Theme Color (Hex)"
                    placeholder="#d97706"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    icon={<Palette size={16} />}
                  />
                </div>
              </div>

              {/* Color Presets */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-muted">
                  Quick Color Presets
                </label>
                <div className="flex flex-wrap gap-3">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all text-xs text-white hover:bg-white/10"
                    >
                      <span className={`w-3 h-3 rounded-full ${preset.class}`} />
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Welcome Banner Text */}
              <div className="space-y-2">
                <Input
                  label="Welcome Banner Greeting"
                  placeholder="Welcome to IIT Delhi's Interview prep center"
                  value={welcomeBannerText}
                  onChange={(e) => setWelcomeBannerText(e.target.value)}
                  icon={<Type size={16} />}
                />
                <p className="text-xs text-[#a1a1aa]">
                  Custom text that will display on the student and mentor home dashboard.
                </p>
              </div>

              <div className="pt-4 border-t border-white/5">
                <Button
                  type="submit"
                  disabled={saving}
                  fullWidth
                  variant="primary"
                  className="bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Saving changes...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Branding
                    </>
                  )}
                </Button>
              </div>
            </form>
          </GlassCard>
        </div>

        {/* Live Preview */}
        <div className="lg:col-span-5 flex flex-col">
          <GlassCard className="p-6 h-full border border-white/10 flex flex-col">
            <CardTitle className="flex items-center gap-2 mb-6 text-xl font-bold text-white border-b border-white/5 pb-4">
              <Eye className="w-5 h-5 text-purple-400" />
              Live Portal Preview
            </CardTitle>

            <div className="flex-1 flex flex-col justify-center items-center">
              {/* Mock Dashboard Shell */}
              <div className="w-full max-w-sm rounded-2xl overflow-hidden border border-white/10 bg-[#070708] flex flex-col shadow-2xl">
                {/* Mock Header */}
                <div className="h-12 border-b border-white/5 bg-[#0e0e10] flex items-center justify-between px-4">
                  {/* Brand Branding */}
                  <div className="flex items-center gap-2">
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Logo" className="w-5 h-5 object-contain" />
                    ) : (
                      <div 
                        className="w-5 h-5 rounded flex items-center justify-center text-[10px] text-black font-black"
                        style={{ backgroundColor: primaryColor }}
                      >
                        🎓
                      </div>
                    )}
                    <span className="text-[11px] font-bold text-white tracking-wider max-w-[120px] truncate">
                      {collegeName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-white/10" />
                    <div className="w-8 h-3 rounded bg-white/10" />
                  </div>
                </div>

                {/* Mock Body */}
                <div className="p-4 space-y-4 flex-1">
                  {/* Custom Welcome Banner */}
                  <div 
                    className="p-4 rounded-xl border relative overflow-hidden"
                    style={{ 
                      backgroundColor: `${primaryColor}10`,
                      borderColor: `${primaryColor}20`
                    }}
                  >
                    <div className="relative z-10 space-y-1">
                      <h4 className="text-[13px] font-bold text-white">
                        {welcomeBannerText || `Welcome back to ${collegeName}!`}
                      </h4>
                      <p className="text-[10px] text-[#a1a1aa]">
                        Get ready to ace your technical and behavior rounds.
                      </p>
                    </div>
                    {/* Glowing highlight indicator */}
                    <div 
                      className="absolute -right-6 -bottom-6 w-16 h-16 rounded-full opacity-20 blur-xl"
                      style={{ backgroundColor: primaryColor }}
                    />
                  </div>

                  {/* Mock Content Card Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                      <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                        📹
                      </div>
                      <div className="text-[10px] font-semibold text-white">Mock Interview</div>
                      <div 
                        className="text-[9px] font-medium"
                        style={{ color: primaryColor }}
                      >
                        Start Prep →
                      </div>
                    </div>
                    
                    <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                      <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                        📝
                      </div>
                      <div className="text-[10px] font-semibold text-white">Exam Practice</div>
                      <div 
                        className="text-[9px] font-medium"
                        style={{ color: secondaryColor }}
                      >
                        Start Test →
                      </div>
                    </div>
                  </div>

                  {/* Sidebar Mock Nav Item Hover State */}
                  <div className="space-y-1">
                    <div className="text-[9px] text-[#a1a1aa] font-medium">Interactive Sidebar Hover</div>
                    <div 
                      className="flex items-center gap-2 p-2 rounded-lg text-[10px] font-semibold border"
                      style={{ 
                        backgroundColor: '#18181b', 
                        color: primaryColor,
                        borderColor: 'rgba(255,255,255,0.05)'
                      }}
                    >
                      <span>⚡</span>
                      <span>Overview Dashboard</span>
                      <div 
                        className="ml-auto w-1 h-1 rounded-full"
                        style={{ backgroundColor: primaryColor }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
