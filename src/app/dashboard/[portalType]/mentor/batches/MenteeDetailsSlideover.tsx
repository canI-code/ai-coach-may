import React from 'react';
import { X, User, Activity, BookOpen, Target, Calendar, Coins, GraduationCap, Users, Mail, TrendingUp } from 'lucide-react';

interface MenteeDetailsModalProps {
  mentee: any;
  onClose: () => void;
}

export function MenteeDetailsSlideover({ mentee, onClose }: MenteeDetailsModalProps) {
  if (!mentee) return null;

  const { profile, readiness, credits, history } = mentee;
  const interviews = history?.interviews || [];
  const exams = history?.exams || [];
  const allActivity = [...interviews, ...exams].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const ProgressBar = ({ value, label, colorClass }: { value: number, label: string, colorClass: string }) => (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs font-medium text-[#a1a1aa]">
        <span>{label}</span>
        <span className="text-white">{Math.round(value)}%</span>
      </div>
      <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} rounded-full`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Modal Panel */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#18181b] border border-white/10 shadow-2xl rounded-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 sm:px-8 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-full bg-teal-500/20 flex items-center justify-center shrink-0 border border-teal-500/30">
              <User className="w-7 h-7 text-teal-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-bold text-white truncate tracking-tight">{mentee.fullName}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-[#a1a1aa] font-mono">
                <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {mentee.email}</span>
              </div>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-full transition-colors text-[#a1a1aa] hover:text-white shrink-0 bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Profile & Credits */}
            <div className="lg:col-span-4 space-y-8">
              
              {/* Academic Profile */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-indigo-400" />
                  Academic Profile
                </h3>
                <div className="bg-white/5 rounded-xl p-5 border border-white/5 space-y-4 shadow-inner">
                  <div>
                    <p className="text-[11px] text-[#a1a1aa] uppercase tracking-wider font-semibold">Degree Program</p>
                    <p className="text-base font-medium text-white mt-1">{profile?.degree || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#a1a1aa] uppercase tracking-wider font-semibold">Course / Major</p>
                    <p className="text-base font-medium text-white mt-1">{profile?.course || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-[#a1a1aa] uppercase tracking-wider font-semibold">Key Interests</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {profile?.interests?.length > 0 ? (
                        profile.interests.map((tag: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 rounded-md text-[11px] bg-[hsla(240,5%,40%,0.2)] text-[hsl(240,5%,85%)] font-medium border border-white/10">
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-[#a1a1aa] italic">No interests logged</span>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              {/* Credit Usage */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-2">
                  <Coins className="w-4 h-4 text-yellow-400" />
                  Platform Usage
                </h3>
                <div className="bg-white/5 rounded-xl p-5 border border-white/5 shadow-inner">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <p className="text-2xl font-bold text-white">{mentee.sessionCount || 0}</p>
                      <p className="text-xs text-[#a1a1aa] uppercase tracking-wide">Total Sessions</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-teal-400">{credits?.remaining || 0}</p>
                      <p className="text-xs text-[#a1a1aa] uppercase tracking-wide">Credits Left</p>
                    </div>
                  </div>
                  <div className="w-full h-px bg-white/10 my-4" />
                  <div className="flex justify-between text-sm">
                    <span className="text-[#a1a1aa]">Credits Used</span>
                    <span className="text-white font-medium">{credits?.used || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-[#a1a1aa]">Allocated</span>
                    <span className="text-white font-medium">{credits?.allocated || 0}</span>
                  </div>
                </div>
              </section>
            </div>

            {/* Right Column: Readiness & Timeline */}
            <div className="lg:col-span-8 space-y-8">
              
              {/* Placement Readiness */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" />
                    Placement Readiness Matrix
                  </h3>
                  <span className={`px-3 py-1 rounded-full border text-xs font-bold tracking-wider uppercase shadow-sm ${
                    readiness?.tier === 'Tier 1' ? 'bg-[hsla(150,80%,40%,0.15)] border-[hsla(150,80%,40%,0.3)] text-[hsl(150,80%,70%)]' :
                    readiness?.tier === 'Tier 2' ? 'bg-[hsla(190,80%,40%,0.15)] border-[hsla(190,80%,40%,0.3)] text-[hsl(190,80%,70%)]' :
                    readiness?.tier === 'Tier 3' ? 'bg-[hsla(40,80%,40%,0.15)] border-[hsla(40,80%,40%,0.3)] text-[hsl(40,80%,70%)]' :
                    'bg-[hsla(240,5%,40%,0.1)] border-[hsla(240,5%,40%,0.3)] text-[hsl(240,5%,75%)]'
                  }`}>
                    {readiness?.tier || 'Insufficient Data'}
                  </span>
                </div>
                
                <div className="bg-white/5 rounded-xl p-6 border border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-8 shadow-inner">
                  <div className="flex flex-col justify-center items-center p-6 bg-black/20 rounded-xl border border-white/5">
                    <div className="relative flex items-center justify-center w-32 h-32">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="40" fill="transparent" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                        <circle 
                          cx="50" cy="50" r="40" fill="transparent" 
                          stroke={readiness?.score >= 75 ? '#10b981' : readiness?.score >= 50 ? '#3b82f6' : '#ef4444'} 
                          strokeWidth="8" 
                          strokeDasharray="251.2" 
                          strokeDashoffset={251.2 - (251.2 * (readiness?.score || 0)) / 100}
                          className="transition-all duration-1000 ease-out"
                        />
                      </svg>
                      <div className="absolute flex flex-col items-center">
                        <span className="text-3xl font-black text-white">{Math.round(readiness?.score || 0)}</span>
                        <span className="text-[10px] text-[#a1a1aa] uppercase tracking-wider font-bold">Overall</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 flex flex-col justify-center">
                    <ProgressBar 
                      label="Communication Skills" 
                      value={readiness?.breakdown?.communication || 0} 
                      colorClass="bg-indigo-500" 
                    />
                    <ProgressBar 
                      label="Technical Knowledge" 
                      value={readiness?.breakdown?.technical || 0} 
                      colorClass="bg-blue-500" 
                    />
                    <ProgressBar 
                      label="Mock Interview Performance" 
                      value={readiness?.breakdown?.interview || 0} 
                      colorClass="bg-purple-500" 
                    />
                  </div>
                </div>
              </section>

              {/* Recent Activity Timeline */}
              <section className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#a1a1aa] flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-pink-400" />
                  Recent Sessions Timeline
                </h3>
                
                {allActivity.length === 0 ? (
                  <div className="bg-white/5 rounded-xl p-8 border border-white/5 text-center flex flex-col items-center">
                    <Activity className="w-10 h-10 text-white/20 mb-3" />
                    <p className="text-base text-white font-medium">No Activity Yet</p>
                    <p className="text-sm text-[#a1a1aa] mt-1">This mentee hasn't completed any sessions.</p>
                  </div>
                ) : (
                  <div className="bg-white/5 rounded-xl p-6 border border-white/5 shadow-inner">
                    <div className="space-y-4">
                      {allActivity.map((act: any, i: number) => {
                        const isInterview = !!act.role;
                        return (
                          <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] transition-colors group">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border ${isInterview ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                              {isInterview ? <Users className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-base font-semibold text-white truncate group-hover:text-teal-300 transition-colors">
                                {isInterview ? act.role : act.title}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-[#a1a1aa]">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {new Date(act.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                </span>
                                <span className="flex items-center gap-1 border-l border-white/20 pl-3">
                                  {isInterview ? 'Mock Interview' : 'Technical Exam'}
                                </span>
                              </div>
                            </div>
                            <div className="text-right shrink-0 bg-black/40 px-4 py-2 rounded-lg border border-white/5">
                              <span className="text-xl font-bold text-white">{Math.round(act.score)}</span>
                              <span className="text-sm text-[#a1a1aa] ml-1">%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
