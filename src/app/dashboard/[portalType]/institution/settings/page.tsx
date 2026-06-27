'use client';

import { useState, useEffect } from 'react';
import { GlassCard, CardTitle, Button, Input } from '@/app/components/ui';
import { Palette, Link, Type, Save, Check, RefreshCw, Eye, Sparkles, Building2, Plus, Trash2 } from 'lucide-react';

const COLOR_PRESETS = [
  { name: 'Amber', primary: '#f59e0b', secondary: '#d97706', class: 'bg-amber-500' },
  { name: 'Purple', primary: '#8b5cf6', secondary: '#7c3aed', class: 'bg-violet-500' },
  { name: 'Teal', primary: '#14b8a6', secondary: '#0d9488', class: 'bg-teal-500' },
  { name: 'Emerald', primary: '#10b981', secondary: '#059669', class: 'bg-emerald-500' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'departments' | 'branding'>('departments');

  // Branding State
  const [logoUrl, setLogoUrl] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#f59e0b');
  const [secondaryColor, setSecondaryColor] = useState('#d97706');
  const [welcomeBannerText, setWelcomeBannerText] = useState('');
  const [collegeName, setCollegeName] = useState('Your Institution');
  
  // Departments State
  const [departments, setDepartments] = useState<string[]>([]);
  const [newDepartment, setNewDepartment] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const [profileRes, deptRes] = await Promise.all([
          fetch('/api/b2b/institution/profile'),
          fetch('/api/b2b/institution/departments')
        ]);
        
        if (profileRes.ok) {
          const data = await profileRes.json();
          setCollegeName(data.collegeName || 'Your Institution');
          if (data.branding) {
            setLogoUrl(data.branding.logoUrl || '');
            setPrimaryColor(data.branding.primaryColor || '#f59e0b');
            setSecondaryColor(data.branding.secondaryColor || '#d97706');
            setWelcomeBannerText(data.branding.welcomeBannerText || '');
          }
        }

        if (deptRes.ok) {
          const deptData = await deptRes.json();
          setDepartments(deptData.departments || []);
        }
      } catch (err) {
        console.error('Failed to load institution settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleApplyPreset = (preset: typeof COLOR_PRESETS[number]) => {
    setPrimaryColor(preset.primary);
    setSecondaryColor(preset.secondary);
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess('');
    setError('');

    const hexRegex = /^#[0-9A-F]{6}$/i;
    if (!hexRegex.test(primaryColor) || !hexRegex.test(secondaryColor)) {
      setError('Primary and Secondary colors must be valid hex codes (e.g. #F59E0B)');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/b2b/institution/branding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoUrl, primaryColor, secondaryColor, welcomeBannerText }),
      });

      if (res.ok) {
        setSuccess('Branding settings updated successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to save branding settings.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred while saving branding.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepartment.trim()) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/b2b/institution/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: newDepartment.trim() })
      });

      if (res.ok) {
        const data = await res.json();
        if (!departments.includes(data.department)) {
          setDepartments(prev => [...prev, data.department]);
        }
        setNewDepartment('');
        setSuccess('Department added successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to add department');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to add department');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDepartment = async (dept: string) => {
    if (!confirm(`Are you sure you want to remove "${dept}"?`)) return;

    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/b2b/institution/departments?department=${encodeURIComponent(dept)}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setDepartments(prev => prev.filter(d => d !== dept));
        setSuccess('Department removed successfully!');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to remove department');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to remove department');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCw className="w-8 h-8 text-purple-400 animate-spin" />
        <p className="text-sm text-[#a1a1aa]">Loading settings configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl pb-12">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
          <Sparkles className="w-7 h-7 text-purple-400" />
          Institution Settings
        </h1>
        <p className="text-[#a1a1aa] mt-1 text-sm">
          Manage your departments, branding, and other institutional configurations.
        </p>
      </div>

      <div className="flex gap-4 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('departments')}
          className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'departments' ? 'border-purple-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-300'
          }`}
        >
          <div className="flex items-center gap-2"><Building2 size={16} /> Departments</div>
        </button>
        <button
          onClick={() => setActiveTab('branding')}
          className={`pb-2 px-4 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'branding' ? 'border-purple-500 text-white' : 'border-transparent text-zinc-400 hover:text-zinc-300'
          }`}
        >
          <div className="flex items-center gap-2"><Palette size={16} /> Branding</div>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
          <Check className="w-4 h-4" />
          {success}
        </div>
      )}

      {activeTab === 'departments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GlassCard className="p-6 h-fit">
            <CardTitle className="mb-4 text-xl font-bold text-white">Manage Departments</CardTitle>
            <p className="text-sm text-zinc-400 mb-6">
              Add departments to assign mentors and batches properly. E.g., "Computer Science", "Business Admin".
            </p>
            
            <form onSubmit={handleAddDepartment} className="flex gap-2 mb-8">
              <div className="flex-1">
                <Input
                  label=""
                  placeholder="e.g. Mechanical Engineering"
                  value={newDepartment}
                  onChange={(e) => setNewDepartment(e.target.value)}
                  disabled={saving}
                />
              </div>
              <Button type="submit" disabled={saving || !newDepartment.trim()} className="mt-1 flex items-center gap-2">
                <Plus size={16} /> Add
              </Button>
            </form>

            <div className="space-y-2">
              <h4 className="text-sm font-medium text-zinc-300 mb-3">Current Departments ({departments.length})</h4>
              {departments.length === 0 ? (
                <p className="text-sm text-zinc-500 italic">No departments added yet.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                  {departments.map((dept) => (
                    <div key={dept} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                      <span className="text-sm text-white">{dept}</span>
                      <button
                        onClick={() => handleDeleteDepartment(dept)}
                        className="text-zinc-500 hover:text-red-400 transition-colors p-1"
                        title="Remove department"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === 'branding' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Settings Form */}
          <div className="lg:col-span-7">
            <GlassCard className="p-6 h-full flex flex-col justify-between">
              <form onSubmit={handleSaveBranding} className="space-y-6">
                <CardTitle className="flex items-center gap-2 mb-2 text-xl font-bold text-white border-b border-white/5 pb-4">
                  <Palette className="w-5 h-5 text-purple-400" />
                  Branding Details
                </CardTitle>

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
                  <label className="block text-sm font-medium text-zinc-400">
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
                        <div className="text-[9px] font-medium" style={{ color: primaryColor }}>
                          Start Prep →
                        </div>
                      </div>
                      
                      <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2">
                        <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center">
                          📝
                        </div>
                        <div className="text-[10px] font-semibold text-white">Exam Practice</div>
                        <div className="text-[9px] font-medium" style={{ color: secondaryColor }}>
                          Start Test →
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}
    </div>
  );
}
