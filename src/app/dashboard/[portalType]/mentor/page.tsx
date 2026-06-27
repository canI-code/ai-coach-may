'use client';

import { useState, useEffect } from 'react';
import { GlassCard, Button } from '@/app/components/ui';
import { Users, CreditCard, BookOpen, Loader2, AlertTriangle, TrendingUp, ChevronDown, ChevronUp, Award, Zap } from 'lucide-react';

// Simple SVG Area Chart for Trends
function SimpleAreaChart({ data, color, title, dataKey = 'score' }: { data: any[], color: string, title: string, dataKey?: string }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-[#a1a1aa] text-sm bg-white/5 rounded-xl border border-white/5">
        No trend data for {title}
      </div>
    );
  }

  const maxScore = 100;
  const height = 220;
  const width = 600;
  const padding = 30;
  
  const points = data.map((d, i) => {
    const x = padding + (i * (width - 2 * padding) / Math.max(data.length - 1, 1));
    const y = height - padding - ((d[dataKey] || 0) / maxScore * (height - 2 * padding));
    return `${x},${y}`;
  });

  const pathD = `M ${points[0] || `${padding},${height-padding}`} L ${points.join(' ')}`;
  const areaD = `${pathD} L ${points.length > 1 ? points[points.length - 1].split(',')[0] : padding},${height - padding} L ${padding},${height - padding} Z`;

  return (
    <div className="w-full flex flex-col items-start bg-white/5 p-4 rounded-xl border border-white/5 shadow-inner relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
        <TrendingUp size={64} color={color} />
      </div>
      <h3 className="text-sm font-semibold text-white mb-4 z-10 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]" style={{ backgroundColor: color, color }}></div>
        {title}
      </h3>
      <div className="w-full overflow-x-auto overflow-y-hidden z-10" style={{ minHeight: `${height}px` }}>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full drop-shadow-xl" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`grad-${title}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.5" />
              <stop offset="100%" stopColor={color} stopOpacity="0.0" />
            </linearGradient>
            <filter id={`glow-${title}`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
          
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(val => {
            const y = height - padding - (val / 100 * (height - 2 * padding));
            return (
              <g key={val}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />
                <text x={padding - 10} y={y + 4} fill="#a1a1aa" fontSize="10" textAnchor="end">{val}</text>
              </g>
            );
          })}

          <path d={areaD} fill={`url(#grad-${title})`} />
          <path d={pathD} fill="none" stroke={color} strokeWidth="3" filter={`url(#glow-${title})`} strokeLinecap="round" strokeLinejoin="round" />
          
          {points.map((pt, i) => {
            const [cx, cy] = pt.split(',');
            return (
              <g key={i}>
                <circle cx={cx} cy={cy} r="4" fill="#09090b" stroke={color} strokeWidth="2" className="transition-all duration-300 hover:r-6 cursor-pointer" />
                <text x={cx} y={Number(cy) - 15} fill="#fff" fontSize="10" textAnchor="middle" opacity="0" className="transition-opacity duration-300 hover:opacity-100">
                  {Math.round(data[i][dataKey])}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default function MentorOverview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [expandedBatch, setExpandedBatch] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/b2b/mentor/overview');
      if (res.ok) setData(await res.json());
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAcceptDelete = async () => {
    if (!confirm('Are you absolutely sure you want to accept account deletion? This action is irreversible, your account will be disabled immediately, and all remaining credits will be returned to the institution.')) {
      return;
    }
    setAccepting(true);
    setError('');
    try {
      const res = await fetch('/api/b2b/mentor/accept-delete', { method: 'POST' });
      if (res.ok) {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/';
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to accept deletion');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-teal-400 animate-spin" /></div>;
  }

  const stats = data?.stats || {};
  const batchSummary = data?.batchSummary || [];
  const trends = data?.trends || { interviews: [], exams: [] };
  const isPendingDelete = data?.status === 'pending_delete';
  const readiness = stats.placementReadiness || { tier1Count: 0, tier2Count: 0, tier3Count: 0, insufficientCount: 0 };
  const totalTiered = readiness.tier1Count + readiness.tier2Count + readiness.tier3Count + readiness.insufficientCount || 1;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {isPendingDelete && (
        <GlassCard className="p-6 border-red-500/30 bg-red-950/10 shadow-[0_0_15px_rgba(239,68,68,0.05)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-red-400 font-bold text-base">⚠️ Account Deletion Requested</h3>
                <p className="text-sm text-[#e4e4e7] mt-1">
                  Your institution has requested to delete your mentor account. Accepting this request will immediately disable this account and return your remaining <strong className="text-amber-400">{stats.creditsRemaining || 0} credits</strong> to the institution.
                </p>
                {error && <p className="text-xs text-red-400 font-medium mt-2">{error}</p>}
              </div>
            </div>
            <Button 
              onClick={handleAcceptDelete} 
              disabled={accepting}
              className="bg-red-600 hover:bg-red-700 text-white shrink-0 cursor-pointer"
            >
              {accepting ? 'Deactivating...' : 'Accept Deletion Request'}
            </Button>
          </div>
        </GlassCard>
      )}

      <div>
        <h1 className="text-3xl font-black text-white tracking-tight">Mentor Dashboard</h1>
        <p className="text-[#a1a1aa] mt-2 font-medium">{data?.collegeName}</p>
      </div>

      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <GlassCard className="p-6 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-all"></div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-[#a1a1aa] font-bold">Mentees</span>
            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400"><Users size={18} /></div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">{stats.activeMentees || 0}</span>
            <span className="text-sm text-[#a1a1aa] font-medium">/ {stats.totalMentees || 0} Active</span>
          </div>
        </GlassCard>

        <GlassCard className="p-6 relative overflow-hidden group">
          <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-[#a1a1aa] font-bold">Batches</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400"><BookOpen size={18} /></div>
          </div>
          <div className="text-4xl font-black text-white">{stats.totalBatches || 0}</div>
          <p className="text-xs text-[#a1a1aa] mt-2 font-medium">Assigned to you</p>
        </GlassCard>

        <GlassCard className="p-6 relative overflow-hidden group lg:col-span-2">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-widest text-[#a1a1aa] font-bold">Credits Overview</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><CreditCard size={18} /></div>
          </div>
          <div className="flex items-center gap-8">
            <div>
              <div className="text-xs text-[#a1a1aa] mb-1">Allocated</div>
              <div className="text-2xl font-bold text-white">{stats.creditsAllocated || 0}</div>
            </div>
            <div>
              <div className="text-xs text-[#a1a1aa] mb-1">Consumed</div>
              <div className="text-2xl font-bold text-amber-400">{stats.creditsUsed || 0}</div>
            </div>
            <div>
              <div className="text-xs text-[#a1a1aa] mb-1">Remaining</div>
              <div className="text-2xl font-bold text-teal-400">{stats.creditsRemaining || 0}</div>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/5 overflow-hidden flex">
            <div className="h-full bg-amber-500/80 transition-all shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: `${stats.creditsAllocated ? ((stats.creditsUsed) / stats.creditsAllocated * 100) : 0}%` }} />
            <div className="h-full bg-teal-500/80 transition-all shadow-[0_0_10px_rgba(20,184,166,0.5)]" style={{ width: `${stats.creditsAllocated ? ((stats.creditsRemaining) / stats.creditsAllocated * 100) : 0}%` }} />
          </div>
        </GlassCard>
      </div>

      {/* Row 2: Placement Readiness Tier */}
      <GlassCard className="p-6 border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent pointer-events-none" />
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Award className="text-indigo-400" size={20} />
          Placement Readiness Distribution
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#18181b]/50 rounded-xl p-4 border border-emerald-500/20 relative overflow-hidden">
            <div className="absolute bottom-0 left-0 h-1 bg-emerald-500" style={{ width: `${(readiness.tier1Count / totalTiered) * 100}%` }}></div>
            <div className="text-sm font-semibold text-emerald-400 mb-1">Tier 1</div>
            <div className="text-2xl font-bold text-white">{readiness.tier1Count}</div>
            <div className="text-xs text-[#a1a1aa] mt-1">{Math.round((readiness.tier1Count / totalTiered) * 100)}% of mentees</div>
          </div>
          
          <div className="bg-[#18181b]/50 rounded-xl p-4 border border-blue-500/20 relative overflow-hidden">
            <div className="absolute bottom-0 left-0 h-1 bg-blue-500" style={{ width: `${(readiness.tier2Count / totalTiered) * 100}%` }}></div>
            <div className="text-sm font-semibold text-blue-400 mb-1">Tier 2</div>
            <div className="text-2xl font-bold text-white">{readiness.tier2Count}</div>
            <div className="text-xs text-[#a1a1aa] mt-1">{Math.round((readiness.tier2Count / totalTiered) * 100)}% of mentees</div>
          </div>
          
          <div className="bg-[#18181b]/50 rounded-xl p-4 border border-amber-500/20 relative overflow-hidden">
            <div className="absolute bottom-0 left-0 h-1 bg-amber-500" style={{ width: `${(readiness.tier3Count / totalTiered) * 100}%` }}></div>
            <div className="text-sm font-semibold text-amber-400 mb-1">Tier 3</div>
            <div className="text-2xl font-bold text-white">{readiness.tier3Count}</div>
            <div className="text-xs text-[#a1a1aa] mt-1">{Math.round((readiness.tier3Count / totalTiered) * 100)}% of mentees</div>
          </div>
          
          <div className="bg-[#18181b]/50 rounded-xl p-4 border border-white/5 relative overflow-hidden">
            <div className="absolute bottom-0 left-0 h-1 bg-gray-500" style={{ width: `${(readiness.insufficientCount / totalTiered) * 100}%` }}></div>
            <div className="text-sm font-semibold text-[#a1a1aa] mb-1">Insufficient Data</div>
            <div className="text-2xl font-bold text-white">{readiness.insufficientCount}</div>
            <div className="text-xs text-[#a1a1aa] mt-1">{Math.round((readiness.insufficientCount / totalTiered) * 100)}% of mentees</div>
          </div>
        </div>
      </GlassCard>

      {/* Row 3: Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SimpleAreaChart data={trends.interviews} color="#14b8a6" title="Recent Interview Scores" />
        <SimpleAreaChart data={trends.exams} color="#8b5cf6" title="Recent Exam Scores" />
      </div>

      {/* Row 4: Expandable Batches */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Zap className="text-teal-400" size={20} />
          Batch Performance
        </h2>
        <div className="space-y-3">
          {batchSummary.length === 0 ? (
            <GlassCard className="p-8 text-center text-[#a1a1aa]">No batches assigned yet.</GlassCard>
          ) : (
            batchSummary.map((batch: any) => {
              const isExpanded = expandedBatch === batch._id;
              return (
                <GlassCard key={batch._id} className="overflow-hidden transition-all duration-300">
                  <div 
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/5"
                    onClick={() => setExpandedBatch(isExpanded ? null : batch._id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-400">
                        <BookOpen size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">{batch.name}</h3>
                        <p className="text-xs text-[#a1a1aa]">{batch.department || 'N/A'} · {batch.menteeCount} mentees</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="hidden sm:block text-right">
                        <div className="text-xs text-[#a1a1aa] mb-1">Avg Readiness</div>
                        <div className="font-bold text-teal-400">{batch.avgReadiness}%</div>
                      </div>
                      <div className="text-[#a1a1aa] transition-transform duration-300">
                        {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 border-t border-white/5 bg-[#18181b]/30">
                      <h4 className="text-xs uppercase tracking-wider text-[#a1a1aa] font-bold mb-3 mt-2">Tier Distribution</h4>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-white/5 rounded-lg p-3 text-center border border-emerald-500/10">
                          <div className="text-emerald-400 font-bold text-lg">{batch.tiers.tier1}</div>
                          <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider mt-1">Tier 1</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3 text-center border border-blue-500/10">
                          <div className="text-blue-400 font-bold text-lg">{batch.tiers.tier2}</div>
                          <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider mt-1">Tier 2</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3 text-center border border-amber-500/10">
                          <div className="text-amber-400 font-bold text-lg">{batch.tiers.tier3}</div>
                          <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider mt-1">Tier 3</div>
                        </div>
                        <div className="bg-white/5 rounded-lg p-3 text-center border border-white/5">
                          <div className="text-white font-bold text-lg">{batch.tiers.insufficient}</div>
                          <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider mt-1">N/A</div>
                        </div>
                      </div>
                    </div>
                  )}
                </GlassCard>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
