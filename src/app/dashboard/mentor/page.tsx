'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Users, TrendingUp, BarChart3, Bell, 
  Search, ArrowRight, UserCheck, UserX, FileText,
  Clock, ShieldAlert, CheckCircle2, XCircle
} from 'lucide-react';
import { LineChart } from '@/app/dashboard/[portalType]/components/charts/LineChart';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';

export default function MentorDashboard() {
  const [requests, setRequests] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      const [reqRes, stuRes] = await Promise.all([
        fetch('/api/mentor/requests'),
        fetch('/api/mentor/students')
      ]);
      if (reqRes.ok) {
        const reqData = await reqRes.json();
        setRequests(reqData);
      }
      if (stuRes.ok) {
        const stuData = await stuRes.json();
        setStudents(stuData);
      }
    } catch (err) {
      console.error('Failed to fetch mentor data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (id: string, action: string) => {
    setMessage('Processing...');
    try {
      const res = await fetch('/api/mentor/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(action === 'approve' ? `Approved! Temporary Password: ${data.tempPassword}` : 'Student request rejected.');
        fetchData();
      } else {
        setError(data.error || 'Action failed.');
      }
    } catch (err) {
      setError('Operation failed');
    }
  };

  // ── Stats Calculations ──────────────────────────────────────────────────
  const approvedStudents = useMemo(() => {
    return students.filter(s => s.status === 'approved' || s.status === 'active');
  }, [students]);

  const stats = useMemo(() => {
    const totalStudents = approvedStudents.length;
    const studentsWithCi = approvedStudents.filter(s => s.avgCi > 0);
    const avgCi = studentsWithCi.length > 0
      ? Number((studentsWithCi.reduce((sum, s) => sum + s.avgCi, 0) / studentsWithCi.length).toFixed(1))
      : 0;

    const totalSessions = approvedStudents.reduce((sum, s) => sum + (s.sessionsCount || 0), 0);
    const criticalReviews = approvedStudents.filter(s => s.flagged || (s.avgCi > 0 && s.avgCi < 60)).length;

    return {
      totalStudents,
      avgCi,
      totalSessions,
      criticalReviews
    };
  }, [approvedStudents]);

  // Create points for engagement trend chart using student session history in the last 7 days
  const chartPoints = useMemo(() => {
    const labels = [];
    const values: Record<string, number> = {};
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Initialize last 7 days ending today with 0 values
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = dayNames[d.getDay()];
      labels.push(label);
      values[label] = 0;
    }

    approvedStudents.forEach(student => {
      const allSessions = [
        ...(student.recentInterviews || []).map((i: any) => i.createdAt),
        ...(student.recentExams || []).map((e: any) => e.startedAt)
      ];

      allSessions.forEach(rawDate => {
        if (!rawDate) return;
        const d = new Date(rawDate);
        if (isNaN(d.getTime())) return;
        
        // Check if session falls within the last 7 days range
        const now = new Date();
        const diffMs = now.getTime() - d.getTime();
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        if (diffMs >= 0 && diffMs <= sevenDaysMs) {
          const label = dayNames[d.getDay()];
          if (values[label] !== undefined) {
            values[label]++;
          }
        }
      });
    });

    return labels.map(label => ({
      label,
      value: values[label]
    }));
  }, [approvedStudents]);

  const filteredStudents = useMemo(() => {
    return approvedStudents.filter(s => {
      const q = searchQuery.toLowerCase();
      return s.fullName.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    });
  }, [approvedStudents, searchQuery]);

  return (
    <div className="p-6 lg:p-8 min-h-screen relative z-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1 tracking-tight">Enterprise Overview</h1>
          <p className="text-sm text-white/40">Institution performance metrics across all students and batches</p>
        </div>
      </div>

      {/* Notifications/Feedback Toast */}
      {message && (
        <div className="mb-6 p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-teal-400 hover:text-white font-bold ml-2">×</button>
        </div>
      )}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-white font-bold ml-2">×</button>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3">
            <Users className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-white">{stats.totalStudents}</p>
          <p className="text-xs text-white/40 mt-1 uppercase tracking-wider font-semibold">Total Students</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-white">{stats.avgCi > 0 ? `${stats.avgCi}%` : 'N/A'}</p>
          <p className="text-xs text-white/40 mt-1 uppercase tracking-wider font-semibold">Average CI</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3">
            <BarChart3 className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-white">{stats.totalSessions}</p>
          <p className="text-xs text-white/40 mt-1 uppercase tracking-wider font-semibold">Total Sessions</p>
        </div>

        <div className="glass-card rounded-2xl p-5 border border-white/5 relative overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <p className="text-3xl font-black text-white">{stats.criticalReviews}</p>
          <p className="text-xs text-white/40 mt-1 uppercase tracking-wider font-semibold">Critical Reviews</p>
        </div>
      </div>

      {/* Main Charts & Batches section */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">
        {/* Engagement timeline */}
        <div className="lg:col-span-2 glass-card rounded-2xl p-6 border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <div>
              <CardTitle className="text-lg text-white mb-1">Platform Engagement</CardTitle>
              <CardDescription>Mock interview and practice exam count trends</CardDescription>
            </div>
          </div>
          <div className="mt-4">
            <LineChart points={chartPoints} accent="#10b981" max={100} height={200} />
          </div>
        </div>

        {/* Pending Approval List */}
        <div className="glass-card rounded-2xl p-6 border border-white/5 flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Pending Access Requests</h3>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 max-h-[200px] pr-1">
            {requests.length === 0 ? (
              <div className="h-full flex items-center justify-center py-8 text-center">
                <span className="text-white/20 text-xs">No pending student requests.</span>
              </div>
            ) : (
              requests.map((req) => (
                <div key={req._id} className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{req.fullName}</p>
                    <p className="text-xs text-white/30 truncate">{req.email} · {req.phone}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(req._id, 'approve')}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-black bg-emerald-400 hover:bg-emerald-500 transition-all flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 size={13} /> Approve
                    </button>
                    <button
                      onClick={() => handleApprove(req._id, 'reject')}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white/60 bg-white/5 border border-white/10 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-1"
                    >
                      <XCircle size={13} /> Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Student List Grid */}
      <div className="glass-card rounded-2xl border border-white/5 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Recent Student Activity</h3>
            <p className="text-xs text-white/40">Overview of registered students in your institution</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search students..."
                className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white outline-none focus:border-emerald-500/50 transition-all"
              />
            </div>
            <Link
              href="/dashboard/mentor/students"
              className="flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-semibold text-black bg-emerald-400 hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-500/10"
            >
              Student Details <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-white/30 text-xs">Loading registered students...</div>
          ) : filteredStudents.length === 0 ? (
            <div className="p-12 text-center text-xs text-white/30">No students match your search query or none registered yet.</div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="px-6 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest">Student</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest">Sessions</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest text-center">Confidence Index</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-white/30 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredStudents.map((s, idx) => (
                  <tr key={s._id} className="hover:bg-white/[0.03] transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-white group-hover:text-emerald-400 transition-colors tracking-tight">{s.fullName}</p>
                        <p className="text-xs text-white/30">{s.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-white/60 font-mono">{s.sessionsCount || 0}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-center">
                        <div className="w-10 h-10 rounded-full border-2 border-white/5 flex items-center justify-center relative">
                          <span className="text-xs font-bold text-white">{s.avgCi || '--'}</span>
                          {s.avgCi > 0 && (
                            <svg className="absolute -inset-[2px] w-11 h-11 -rotate-90">
                              <circle cx="22" cy="22" r="20" fill="none" stroke={s.avgCi >= 70 ? '#10b981' : '#f59e0b'} strokeWidth="2" strokeDasharray="125.6" strokeDashoffset={125.6 * (1 - s.avgCi / 100)} />
                            </svg>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${s.status === 'approved' ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/mentor/students?student=${encodeURIComponent(s.fullName)}`}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/30 hover:text-emerald-400 inline-flex items-center gap-1.5 text-xs font-semibold"
                      >
                        View Profile <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
