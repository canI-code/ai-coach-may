'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Container, 
  GlassCard, 
  CardTitle, 
  CardDescription, 
  Button, 
  Header, 
  AmbientGlow 
} from '../components/ui';
import LogoutButton from '@/app/components/LogoutButton';
import { ShieldCheck, Award, MapPin, CheckCircle, Mail, Phone, Calendar, Loader2, XCircle } from 'lucide-react';

export default function SuperAdminDashboard() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const fetchInstitutions = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/admin/institutions');
      if (!res.ok) throw new Error('Failed to fetch institutions');
      const data = await res.json();
      setInstitutions(data);
    } catch (err: any) {
      setError(err.message || 'Error loading dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const handleApprove = async (id: string) => {
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/admin/institutions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Institution approved successfully! Mentor user account created.');
        fetchInstitutions();
      } else {
        setError(data.error || 'Approval failed');
      }
    } catch (err) {
      setError('An error occurred during approval');
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectionReason.trim()) return;
    setRejecting(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/admin/institutions/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rejectingId, reason: rejectionReason }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Institution registration rejected, email simulated.');
        setShowRejectModal(false);
        setRejectingId(null);
        setRejectionReason('');
        fetchInstitutions();
      } else {
        setError(data.error || 'Rejection failed');
      }
    } catch (err) {
      setError('An error occurred during rejection');
    } finally {
      setRejecting(false);
    }
  };

  const pendingList = institutions.filter(inst => inst.status === 'pending');
  const approvedList = institutions.filter(inst => inst.status === 'approved');

  return (
    <div className="min-h-screen bg-grid text-white">
      <AmbientGlow color="purple" size="lg" position="top-left" className="z-0" />
      <AmbientGlow color="teal" size="md" position="bottom-right" className="z-0" />

      <Header />

      <main className="pt-28 pb-12 relative z-10">
        <Container>
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Title Banner */}
            <GlassCard padding="lg" className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  <span className="text-xs uppercase tracking-[2px] font-bold text-purple-400">Super Admin Portal</span>
                </div>
                <CardTitle className="text-2xl font-bold">Institution Approvals</CardTitle>
                <CardDescription>Review and activate registered colleges & B2B institutions</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={fetchInstitutions} className="text-white/60 hover:text-white">
                  Refresh
                </Button>
                <LogoutButton />
              </div>
            </GlassCard>

            {/* Success & Error alerts */}
            {message && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{message}</span>
              </div>
            )}
            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Tabs Header */}
            <div className="flex gap-2 border-b border-white/5 pb-2">
              <button
                onClick={() => setActiveTab('pending')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'pending'
                    ? 'bg-purple-500/15 border border-purple-500/35 text-purple-300'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                Pending Requests ({pendingList.length})
              </button>
              <button
                onClick={() => setActiveTab('approved')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'approved'
                    ? 'bg-purple-500/15 border border-purple-500/35 text-purple-300'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                Approved Partners ({approvedList.length})
              </button>
            </div>

            {/* Tab Contents */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <p className="text-sm text-muted">Retrieving institutions...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeTab === 'pending' ? (
                  pendingList.length === 0 ? (
                    <GlassCard className="text-center py-12 text-white/30">
                      No pending requests to approve.
                    </GlassCard>
                  ) : (
                    pendingList.map((inst) => (
                      <GlassCard key={inst._id} className="p-6 border-white/5 hover:border-purple-500/20 transition-all">
                        <div className="flex flex-col md:flex-row justify-between gap-6">
                          {/* Left Details */}
                          <div className="space-y-4 flex-1">
                            <div>
                              <h3 className="text-lg font-bold text-white uppercase tracking-tight">{inst.collegeName}</h3>
                              <p className="text-xs text-white/40 flex items-center gap-1.5 mt-0.5">
                                <MapPin className="w-3 h-3 text-purple-400" /> {inst.collegeLocation || 'Location Pending'}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-sm text-white/60">
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Requested Mentor</p>
                                <p className="font-semibold text-white">{inst.mentorName}</p>
                                <p className="text-xs flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-white/30" /> {inst.mentorEmail}</p>
                                <p className="text-xs flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-white/30" /> {inst.mentorPhone}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Verification Docs</p>
                                <p className="text-xs flex items-center gap-1.5"><Award className="w-3.5 h-3.5 text-white/30" /> Type: {inst.documentType || 'Aadhaar'}</p>
                                <p className="text-xs flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-white/30" /> DOB: {inst.mentorDob || 'N/A'}</p>
                              </div>
                            </div>
                            
                            {(inst.selfieLocalPath || inst.aadhaarLocalPath || inst.documentLocalPath) && (
                              <div className="border-t border-white/5 pt-3 mt-3 flex flex-wrap gap-6 text-sm">
                                {inst.selfieLocalPath && (
                                  <div className="flex flex-col gap-1.5 text-left">
                                    <span className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Mentor Selfie</span>
                                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-white/10 bg-white/5">
                                      <img
                                        src={`/api/admin/testing-files?filename=${inst.selfieLocalPath}`}
                                        alt="Selfie"
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                  </div>
                                )}
                                <div className="flex flex-col justify-end gap-1 pb-1 text-left">
                                  {inst.aadhaarLocalPath && (
                                    <a
                                      href={`/api/admin/testing-files?filename=${inst.aadhaarLocalPath}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-purple-400 hover:text-purple-300 font-semibold underline text-xs inline-flex items-center gap-1"
                                    >
                                      View Aadhaar Image
                                    </a>
                                  )}
                                  {inst.documentLocalPath && (
                                    <a
                                      href={`/api/admin/testing-files?filename=${inst.documentLocalPath}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-purple-400 hover:text-purple-300 font-semibold underline text-xs inline-flex items-center gap-1"
                                    >
                                      View Institution Doc
                                    </a>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Right Action */}
                          <div className="flex flex-col justify-center gap-2 shrink-0 md:w-44">
                            <Button 
                              onClick={() => handleApprove(inst._id)}
                              fullWidth
                              className="bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_12px_rgba(147,51,234,0.3)]"
                            >
                              Approve & Create
                            </Button>
                            <Button 
                              onClick={() => {
                                setRejectingId(inst._id);
                                setRejectionReason('');
                                setShowRejectModal(true);
                              }}
                              fullWidth
                              variant="secondary"
                              className="border border-red-500/20 text-red-400 hover:bg-red-500/10 bg-red-500/5 hover:text-red-300"
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      </GlassCard>
                    ))
                  )
                ) : (
                  approvedList.length === 0 ? (
                    <GlassCard className="text-center py-12 text-white/30">
                      No approved institutional partners.
                    </GlassCard>
                  ) : (
                    approvedList.map((inst) => (
                      <GlassCard key={inst._id} className="p-6 border-white/5">
                        <div className="flex flex-col md:flex-row justify-between gap-6">
                          <div className="space-y-3 flex-1">
                            <div>
                              <h3 className="text-lg font-bold text-white uppercase tracking-tight">{inst.collegeName}</h3>
                              <p className="text-xs text-white/40 flex items-center gap-1.5 mt-0.5">
                                <MapPin className="w-3 h-3 text-purple-400" /> {inst.collegeLocation || 'Location Pending'}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-white/60">
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Authorized Mentor</p>
                                <p className="font-semibold text-white">{inst.mentorName}</p>
                                <p className="text-xs">{inst.mentorEmail} | {inst.mentorPhone}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Approval Date</p>
                                <p className="text-xs text-white/40">
                                  {inst.approvedAt ? new Date(inst.approvedAt).toLocaleDateString() : 'N/A'}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="inline-flex px-3 py-1 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-500/20">
                              Active Partner
                            </span>
                          </div>
                        </div>
                      </GlassCard>
                    ))
                  )
                )}
              </div>
            )}

            {/* Back link */}
            <div className="text-center pt-6">
              <Link href="/" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                ← Back to Homepage
              </Link>
            </div>
          </div>
        </Container>
      </main>

      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <GlassCard className="max-w-md w-full border-red-500/20" padding="lg">
            <h3 className="text-xl font-bold text-white mb-2">Reject Institution Registration</h3>
            <p className="text-sm text-muted mb-4">
              Please provide the reason for rejecting this institution. This reason will be emailed to the mentor.
            </p>
            
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., The uploaded document does not match the college name..."
              className="w-full h-32 bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/40 transition-all mb-6"
            />

            <div className="flex gap-4">
              <Button
                variant="ghost"
                fullWidth
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectingId(null);
                  setRejectionReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                fullWidth
                disabled={!rejectionReason.trim() || rejecting}
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={handleReject}
              >
                {rejecting ? 'Rejecting...' : 'Confirm Reject'}
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
