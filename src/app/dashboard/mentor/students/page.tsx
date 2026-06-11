'use client';

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
  Users, Search, ChevronDown, MessageSquare, X,
  Mic2, AlertTriangle, Send, FileDown, ChevronUp,
  Star, ClipboardList, Flag, Save
} from 'lucide-react';
import { LineChart } from '@/app/dashboard/[portalType]/components/charts/LineChart';
import { RadarChart } from '@/app/dashboard/[portalType]/components/charts/RadarChart';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';

function CIRing({ value, size = 80 }: { value: number; size?: number }) {
  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - value / 100);
  const color = value >= 75 ? "#10b981" : value >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circumference} strokeDashoffset={dashoffset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
    </svg>
  );
}

function StudentsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [studentList, setStudentList] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  
  const [mentorNote, setMentorNote] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMsg, setChatMsg] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Department / Degree filters state
  const [filterDegree, setFilterDegree] = useState('All');
  const [filterSubject, setFilterSubject] = useState('All');
  const [filterYear, setFilterYear] = useState('All');

  const degreesList = useMemo(() => {
    const list = Array.from(new Set(studentList.map(s => s.degree).filter(Boolean)));
    return ['All', ...list];
  }, [studentList]);

  const subjectsList = useMemo(() => {
    const list = Array.from(new Set(studentList.map(s => s.subject).filter(Boolean)));
    return ['All', ...list];
  }, [studentList]);

  const yearsList = useMemo(() => {
    const list = Array.from(new Set(studentList.map(s => s.year).filter(Boolean)));
    return ['All', ...list.map(String)];
  }, [studentList]);

  // Assign Practice modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignType, setAssignType] = useState('technical');
  const [assignDomain, setAssignDomain] = useState('Software Engineering');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignSuccess, setAssignSuccess] = useState(false);

  // Feedback notifications
  const [toastMessage, setToastMessage] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mentor/students');
      if (res.ok) {
        const data = await res.json();
        setStudentList(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // Sync selection from query params after load
  useEffect(() => {
    if (studentList.length === 0) return;
    const studentNameParam = searchParams.get('student');
    if (studentNameParam) {
      const decodedName = decodeURIComponent(studentNameParam).toLowerCase();
      const found = studentList.find(s => s.fullName.toLowerCase() === decodedName);
      if (found) {
        selectStudent(found);
      }
    }
  }, [studentList, searchParams]);

  // Click outside handler for dropdown
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const openDropdown = () => {
    if (selectedStudent && query === selectedStudent.fullName) setQuery('');
    setDropdownOpen(true);
    inputRef.current?.focus();
  };

  const selectStudent = (s: any) => {
    setSelectedStudent(s);
    setQuery(s.fullName);
    setDropdownOpen(false);
    setMentorNote(s.notes || '');
    setChatOpen(false);
    setChatHistory([]);
  };

  // ── Chat logs ───────────────────────────────────────────────────────────
  const fetchChatHistory = async (targetId: string) => {
    try {
      const res = await fetch(`/api/chat/messages?userId=${targetId}`);
      if (res.ok) {
        const data = await res.json();
        setChatHistory(data);
      }
    } catch (err) {
      console.error('Failed to load chat history');
    }
  };

  useEffect(() => {
    if (chatOpen && selectedStudent) {
      fetchChatHistory(selectedStudent._id);
      const timer = setInterval(() => {
        fetchChatHistory(selectedStudent._id);
      }, 5000); // Poll every 5s
      return () => clearInterval(timer);
    }
  }, [chatOpen, selectedStudent]);

  const sendChat = async () => {
    if (!chatMsg.trim() || !selectedStudent) return;
    const textToSend = chatMsg.trim();
    setChatMsg('');
    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: selectedStudent._id, text: textToSend }),
      });
      if (res.ok) {
        fetchChatHistory(selectedStudent._id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ── Private Notes ───────────────────────────────────────────────────────
  const handleSaveNotes = async () => {
    if (!selectedStudent) return;
    try {
      const res = await fetch(`/api/mentor/students/${selectedStudent._id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: mentorNote }),
      });
      if (res.ok) {
        setToastMessage('Notes saved successfully!');
        setTimeout(() => setToastMessage(''), 3000);
        // refresh local student record
        setSelectedStudent({ ...selectedStudent, notes: mentorNote });
        setStudentList(studentList.map(s => s._id === selectedStudent._id ? { ...s, notes: mentorNote } : s));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ── Flag student ────────────────────────────────────────────────────────
  const handleToggleFlag = async () => {
    if (!selectedStudent) return;
    const newFlagged = !selectedStudent.flagged;
    try {
      const res = await fetch(`/api/mentor/students/${selectedStudent._id}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagged: newFlagged }),
      });
      if (res.ok) {
        setSelectedStudent({ ...selectedStudent, flagged: newFlagged });
        setStudentList(studentList.map(s => s._id === selectedStudent._id ? { ...s, flagged: newFlagged } : s));
        setToastMessage(newFlagged ? 'Student flagged for review.' : 'Flag removed.');
        setTimeout(() => setToastMessage(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ── Practice Assignment ──────────────────────────────────────────────────
  const handleAssign = async () => {
    if (!selectedStudent) return;
    try {
      const res = await fetch('/api/mentor/practice/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menteeId: selectedStudent._id,
          type: assignType,
          domain: assignDomain,
          dueDate: assignDueDate ? new Date(assignDueDate).toISOString() : null,
        }),
      });
      if (res.ok) {
        setAssignModalOpen(false);
        setAssignSuccess(true);
        setTimeout(() => setAssignSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = studentList.filter((s) => {
    const q = query.toLowerCase();
    const matchesSearch = !q || (selectedStudent && q === selectedStudent.fullName.toLowerCase()) ||
      s.fullName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.collegeName && s.collegeName.toLowerCase().includes(q));

    const matchesDegree = filterDegree === 'All' || s.degree === filterDegree;
    const matchesSubject = filterSubject === 'All' || s.subject === filterSubject;
    const matchesYear = filterYear === 'All' || String(s.year) === filterYear;

    return matchesSearch && matchesDegree && matchesSubject && matchesYear;
  });

  const ciColor = (ci: number) =>
    ci >= 75 ? "text-emerald-400" : ci >= 60 ? "text-amber-400" : "text-red-400";

  const ciBg = (ci: number) =>
    ci >= 75 ? "rgba(16,185,129,0.1)" : ci >= 60 ? "rgba(245,158,11,0.1)" : "rgba(239,68,68,0.1)";

  // Build Radar data for Selected Student
  const radarAxes = selectedStudent && [
    { label: 'Technical', value: selectedStudent.skills?.find((s: any) => s.skill === 'Technical')?.score || 0 },
    { label: 'Communication', value: selectedStudent.skills?.find((s: any) => s.skill === 'Communication')?.score || 0 },
    { label: 'Voice', value: selectedStudent.skills?.find((s: any) => s.skill === 'Voice')?.score || 0 },
    { label: 'Body', value: selectedStudent.skills?.find((s: any) => s.skill === 'Body')?.score || 0 },
  ];

  return (
    <div className="p-6 lg:p-8 min-h-screen relative z-10">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#161827] border border-white/10 text-white px-5 py-3 rounded-2xl text-xs flex items-center gap-2.5 shadow-[0_4px_25px_rgba(0,0,0,0.5)]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">Student Directory</h1>
          <p className="text-sm text-white/40 font-medium">Select a student to view their detailed performance and interact</p>
        </div>
      </div>

      {/* Selector & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8" ref={dropdownRef}>
        <div className="relative md:col-span-2">
          <label className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-2 block">
            Select Student
          </label>
          <div
            className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl cursor-text transition-all focus-within:border-emerald-500/50"
            onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); openDropdown(); } }}
          >
            <Search size={16} className="text-white/30 flex-shrink-0 cursor-pointer" onClick={openDropdown} />
            <input ref={inputRef} type="text" value={query}
              onChange={(e) => { setQuery(e.target.value); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
              placeholder="Search by name or email..."
              className="flex-1 bg-transparent text-sm text-white placeholder:text-white/20 outline-none cursor-text" />
            {selectedStudent && (
              <button onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedStudent(null); setQuery(''); setDropdownOpen(false); }}
                className="text-white/20 hover:text-white/60 transition-colors p-1" tabIndex={-1}>
                <X size={14} />
              </button>
            )}
            <ChevronDown size={14} className={`text-white/30 transition-transform duration-200 flex-shrink-0 cursor-pointer ${dropdownOpen ? "rotate-180" : ""}`} onClick={openDropdown} />
          </div>
          
          {dropdownOpen && (
            <div className="absolute top-[calc(100%+8px)] left-0 right-0 rounded-2xl overflow-y-auto z-50 shadow-2xl bg-[#0a0c1c]/95 border border-white/10 backdrop-blur-md max-h-80">
              {filtered.length === 0 ? (
                <div className="p-6 text-center text-xs text-white/30">No students match your search</div>
              ) : (
                filtered.map((s) => (
                  <div key={s._id}
                    onMouseDown={(e) => { e.preventDefault(); selectStudent(s); }}
                    className={`flex items-center gap-4 px-5 py-3 cursor-pointer transition-all hover:bg-white/[0.04] border-b border-white/[0.03] last:border-0 ${selectedStudent?._id === s._id ? "bg-emerald-500/5" : ""}`}>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-black flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${s.avgCi >= 75 ? "#10b981, #059669" : s.avgCi >= 60 ? "#f59e0b, #d97706" : "#ef4444, #b91c1c"})` }}>
                      {s.fullName.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{s.fullName}</p>
                      <p className="text-xs text-white/30 truncate">{s.email}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xs font-black ${ciColor(s.avgCi)}`}>CI {s.avgCi}%</span>
                      {s.flagged && <AlertTriangle size={13} className="text-red-400 animate-pulse" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-2 block">
            Degree
          </label>
          <select
            value={filterDegree}
            onChange={(e) => setFilterDegree(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white/80 outline-none focus:border-emerald-500/50 transition-all [&>option]:bg-[#0a0c1c]"
          >
            {degreesList.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-2 block">
            Subject/Dept
          </label>
          <select
            value={filterSubject}
            onChange={(e) => setFilterSubject(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white/80 outline-none focus:border-emerald-500/50 transition-all [&>option]:bg-[#0a0c1c]"
          >
            {subjectsList.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[10px] font-black text-white/30 uppercase tracking-[2px] mb-2 block">
            Grad Year
          </label>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-xs text-white/80 outline-none focus:border-emerald-500/50 transition-all [&>option]:bg-[#0a0c1c]"
          >
            {yearsList.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Student Profile Detail */}
      {selectedStudent ? (
        <div className="space-y-6 animate-fade-in">
          {/* Profile Header */}
          <GlassCard padding="lg" className="rounded-2xl border-white/5">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex items-center gap-5 flex-1">
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-black text-black flex-shrink-0"
                    style={{ background: `linear-gradient(135deg, ${selectedStudent.avgCi >= 75 ? "#10b981, #059669" : selectedStudent.avgCi >= 60 ? "#f59e0b, #d97706" : "#ef4444, #b91c1c"})` }}>
                    {selectedStudent.fullName.substring(0, 2).toUpperCase()}
                  </div>
                  {selectedStudent.flagged && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center border-2 border-[#0a0a0b]">
                      <AlertTriangle size={10} className="text-white" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-white">{selectedStudent.fullName}</h2>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${selectedStudent.status === "approved" ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"}`}>{selectedStudent.status}</span>
                    {selectedStudent.flagged && <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md text-red-400 bg-red-400/10">Flagged</span>}
                  </div>
                  <p className="text-sm text-white/40 mb-1">{selectedStudent.email} · {selectedStudent.phone}</p>
                  <p className="text-xs text-white/30">Institution: {selectedStudent.collegeName} · Registered {new Date(selectedStudent.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3 glass-card rounded-2xl px-4 py-2 border border-white/5">
                  <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                    <CIRing value={selectedStudent.avgCi} size={48} />
                    <span className={`absolute text-xs font-black ${ciColor(selectedStudent.avgCi)}`}>{selectedStudent.avgCi}%</span>
                  </div>
                  <div>
                    <p className="text-[9px] text-white/30 uppercase tracking-widest font-black">Confidence Index</p>
                    <p className={`text-xs font-black ${ciColor(selectedStudent.avgCi)}`}>{selectedStudent.avgCi >= 75 ? "Strong" : selectedStudent.avgCi >= 60 ? "Developing" : "Needs Help"}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center glass-card rounded-2xl px-4 py-2 border border-white/5 min-w-[70px]">
                  <Mic2 size={16} className="text-white/30 mb-0.5" />
                  <p className="text-lg font-black text-white">{selectedStudent.sessionsCount || 0}</p>
                  <p className="text-[9px] text-white/30 uppercase tracking-widest">Sessions</p>
                </div>

                <div className="flex flex-col gap-1.5 shrink-0">
                  <button onClick={() => setChatOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-black bg-emerald-400 hover:bg-emerald-500 transition-all">
                    <MessageSquare size={14} /> Message Student
                  </button>
                  <button onClick={() => setAssignModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-600 transition-all">
                    <Star size={14} /> Assign Practice
                  </button>
                  <button onClick={handleToggleFlag}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${selectedStudent.flagged ? 'text-red-400 bg-red-500/10 border border-red-500/20' : 'text-white/60 bg-white/5 border border-white/10 hover:text-white'}`}>
                    <Flag size={14} /> {selectedStudent.flagged ? 'Remove Flag' : 'Flag Student'}
                  </button>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Performance Radar breakdown */}
          <div className="grid lg:grid-cols-3 gap-6">
            <GlassCard padding="lg" className="rounded-2xl border-white/5 lg:col-span-2">
              <h3 className="text-xs font-black text-white/30 uppercase tracking-[2px] mb-5">Interactive Skill Breakdown</h3>
              {radarAxes && (
                <div className="flex items-center justify-center">
                  <RadarChart axes={radarAxes} max={100} accent="#10b981" />
                </div>
              )}
            </GlassCard>
            
            {/* Private Mentor Notes */}
            <GlassCard padding="lg" className="rounded-2xl border-white/5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ClipboardList className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-black text-white/30 uppercase tracking-[2px]">Private Notes</h3>
                </div>
                <p className="text-[10px] text-white/20 mb-3">Notes are strictly confidential and never displayed to the student.</p>
                <textarea 
                  value={mentorNote} 
                  onChange={(e) => setMentorNote(e.target.value)} 
                  rows={6}
                  placeholder="e.g. Needs extra preparation with algorithms and STAR format communication..."
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-white/20 outline-none resize-none transition-all focus:border-emerald-500/40" 
                />
              </div>
              <button onClick={handleSaveNotes}
                className="w-full py-2.5 mt-4 rounded-xl text-xs font-bold text-black bg-emerald-400 hover:bg-emerald-500 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10">
                <Save size={14} /> Save Notes
              </button>
            </GlassCard>
          </div>

          {/* Practice History timeline logs */}
          <GlassCard padding="none" className="rounded-2xl border-white/5 overflow-hidden">
            <div className="p-6 border-b border-white/5">
              <h3 className="text-xs font-black text-white/30 uppercase tracking-[2px]">Recent Practice Logs</h3>
            </div>
            
            <div className="divide-y divide-white/5">
              {/* Interviews */}
              {selectedStudent.recentInterviews?.map((sess: any) => (
                <div key={sess.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                      <Mic2 size={15} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Mock Interview: {sess.type}</p>
                      <p className="text-xs text-white/30">{sess.date}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${sess.status === 'completed' ? 'text-emerald-400 bg-emerald-400/10' : 'text-amber-400 bg-amber-400/10'}`}>{sess.status}</span>
                </div>
              ))}

              {/* Exams */}
              {selectedStudent.recentExams?.map((sess: any) => (
                <div key={sess.id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                      <ClipboardList size={15} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Practice Exam Session</p>
                      <p className="text-xs text-white/30">{sess.date}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${sess.status === 'completed' ? 'text-emerald-400 bg-emerald-400/10' : 'text-amber-400 bg-amber-400/10'}`}>{sess.status}</span>
                </div>
              ))}

              {(!selectedStudent.recentInterviews || selectedStudent.recentInterviews.length === 0) &&
               (!selectedStudent.recentExams || selectedStudent.recentExams.length === 0) && (
                <div className="p-8 text-center text-xs text-white/20">No practice sessions logged yet.</div>
              )}
            </div>
          </GlassCard>
        </div>
      ) : (
        <div className="glass-card rounded-2xl p-16 text-center border-white/5">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-5">
            <Users size={28} className="text-emerald-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Select a Student</h3>
          <p className="text-white/40 max-w-sm mx-auto text-sm leading-relaxed">
            Use the search bar above to search and select a student to view their performance profile, private notes, and send messages.
          </p>
        </div>
      )}

      {/* Floating Chat Panel */}
      {chatOpen && selectedStudent && (
        <div className="fixed bottom-6 right-6 w-96 rounded-3xl overflow-hidden shadow-2xl z-[100] flex flex-col border border-emerald-500/20 backdrop-blur-xl bg-[#0a0c1c]/95" style={{ height: 480 }}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 flex-shrink-0 bg-emerald-500/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-xs font-black text-black">
                {selectedStudent.fullName.substring(0,2).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none">{selectedStudent.fullName}</p>
                <p className="text-[10px] text-emerald-400 mt-0.5">Student Chat</p>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-white/30 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"><X size={16} /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {chatHistory.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare size={32} className="mx-auto text-white/10 mb-3 animate-bounce" />
                <p className="text-xs text-white/20">Send a message to start chatting with {selectedStudent.fullName}</p>
              </div>
            ) : (
              chatHistory.map((msg, i) => {
                const isMe = msg.senderId === selectedStudent._id ? false : true;
                return (
                  <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isMe ? "text-black font-medium rounded-br-sm" : "text-white/70 rounded-bl-sm"}`}
                      style={isMe ? { background: "linear-gradient(135deg, #10b981, #059669)" } : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      {msg.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="flex items-center gap-3 px-4 py-3 border-t border-white/5 flex-shrink-0">
            <input type="text" value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()}
              placeholder="Type a message..."
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-emerald-500/40 transition-all" />
            <button onClick={sendChat} className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:scale-105 bg-emerald-500 hover:bg-emerald-600">
              <Send size={15} className="text-black" />
            </button>
          </div>
        </div>
      )}

      {/* Assign Practice Modal */}
      {assignModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setAssignModalOpen(false); }}>
          <div className="glass-card rounded-3xl p-6 w-full max-w-md border border-indigo-500/20 shadow-indigo-500/10">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-white">Assign Practice</h3>
                <p className="text-xs text-white/40 mt-0.5">For {selectedStudent.fullName}</p>
              </div>
              <button onClick={() => setAssignModalOpen(false)} className="text-white/30 hover:text-white/60 transition-colors p-1 rounded-lg hover:bg-white/5"><X size={18} /></button>
            </div>
            
            <div className="mb-4">
              <label className="text-xs font-black text-white/30 uppercase tracking-[2px] mb-2 block">Practice Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[{ id: "technical", label: "Technical Interview" }, { id: "hr", label: "HR Interview" }, { id: "mock", label: "Full Mock" }, { id: "exam", label: "Exam Session" }].map(({ id, label }) => (
                  <button key={id} onClick={() => setAssignType(id)}
                    className="px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all"
                    style={assignType === id ? { background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.35)", color: "#a5b4fc" } : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-black text-white/30 uppercase tracking-[2px] mb-2 block">Domain</label>
              <select value={assignDomain} onChange={(e) => setAssignDomain(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white bg-[#0a0c1e] border border-white/10 outline-none">
                {["Software Engineering", "Data Science", "Product Management", "Frontend / UI", "Backend / APIs", "System Design", "Machine Learning"].map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="text-xs font-black text-white/30 uppercase tracking-[2px] mb-2 block">Due Date</label>
              <input type="date" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm text-white bg-white/5 border border-white/10 outline-none" />
            </div>

            <button onClick={handleAssign}
              className="w-full py-3 rounded-xl text-sm font-bold text-white bg-indigo-500 hover:bg-indigo-600 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/20">
              Assign to {selectedStudent.fullName}
            </button>
          </div>
        </div>
      )}

      {/* Assign Success Toast */}
      {assignSuccess && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 px-5 py-3 rounded-2xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-500 to-teal-500 border border-emerald-400/20 shadow-2xl backdrop-blur-md">
          <Star size={16} className="text-white animate-spin" /> Practice assigned successfully!
        </div>
      )}
    </div>
  );
}

export default function AdminStudentsPage() {
  return (
    <Suspense fallback={
      <div className="p-8 text-center text-white/30 text-sm">Loading student directory...</div>
    }>
      <StudentsInner />
    </Suspense>
  );
}
