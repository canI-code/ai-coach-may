'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Container, GlassCard, Button, Header, AmbientGlow, Section, SectionHeader } from '../components/ui';
import LogoutButton from '@/app/components/LogoutButton';
import { CheckCircle, XCircle, AlertTriangle, Building, Mail, Phone, User, Flag } from 'lucide-react';

export default function AdminPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [flaggedUsers, setFlaggedUsers] = useState<any[]>([]);
  const [questionFlags, setQuestionFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedInst, setSelectedInst] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'institutions' | 'flagged' | 'questions'>('institutions');

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const fetchInstitutions = async () => {
    try {
      const res = await fetch('/api/admin/b2b/requests');
      const data = await res.json();
      if (res.ok) setInstitutions(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFlaggedUsers = async () => {
    try {
      const res = await fetch('/api/admin/flagged');
      const data = await res.json();
      if (res.ok) setFlaggedUsers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchQuestionFlags = async () => {
    try {
      const res = await fetch('/api/admin/question-flags');
      const data = await res.json();
      if (res.ok) setQuestionFlags(data.flags || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/status');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && (data.user.role === 'admin' || data.user.role === 'superadmin')) {
            setAuthorized(true);
            fetchInstitutions();
            fetchFlaggedUsers();
            fetchQuestionFlags();
          } else {
            setAuthorized(false);
          }
        } else {
          setAuthorized(false);
        }
      } catch (err) {
        setAuthorized(false);
      }
    };
    checkAuth();
  }, []);

  const handleApprove = async (id: string) => {
    setMessage('Approving...');
    try {
      const res = await fetch('/api/admin/b2b/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          instituteId: id,
          totalCredits: 100,
          duration: '1 year',
          enabledPortals: ['interview', 'exam']
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Approved and activated successfully! Login credentials: ${data.credentials?.email} / ${data.credentials?.password || '(auto-generated)'}`);
        setSelectedInst(null);
        fetchInstitutions();
      } else {
        setMessage('Error: ' + data.error);
      }
    } catch (err) {
      setMessage('Approval failed');
    }
  };
  
  const handleReject = async () => {
    if (!rejectingId || !rejectionReason.trim()) return;
    setRejecting(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/b2b/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rejectingId, reason: rejectionReason }),
      });
      if (res.ok) {
        setMessage('Rejected successfully! Simulated notification logged.');
        setShowRejectModal(false);
        setRejectingId(null);
        setRejectionReason('');
        setSelectedInst(null);
        fetchInstitutions();
      } else {
        const data = await res.json();
        setMessage('Error: ' + data.error);
      }
    } catch (err) {
      setMessage('Rejection failed');
    } finally {
      setRejecting(false);
    }
  };

  const handleReactivate = async (identifier: string) => {
    setMessage('Reactivating...');
    try {
      const res = await fetch('/api/admin/flagged', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, action: 'reactivate' }),
      });
      if (res.ok) {
        setMessage('Account reactivated!');
        fetchFlaggedUsers();
      } else {
        const data = await res.json();
        setMessage('Error: ' + data.error);
      }
    } catch (err) {
      setMessage('Reactivation failed');
    }
  };

  const handleDeactivate = async (identifier: string) => {
    setMessage('Deactivating...');
    try {
      const res = await fetch('/api/admin/flagged', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, action: 'deactivate' }),
      });
      if (res.ok) {
        setMessage('Account permanently deactivated!');
        fetchFlaggedUsers();
      } else {
        const data = await res.json();
        setMessage('Error: ' + data.error);
      }
    } catch (err) {
      setMessage('Deactivation failed');
    }
  };

  const handleMarkQuestionSafe = async (questionId: string) => {
    setMessage('Marking question safe...');
    try {
      const res = await fetch('/api/admin/question-flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, action: 'mark-safe' }),
      });
      if (res.ok) {
        setMessage('Question marked safe!');
        fetchQuestionFlags();
      } else {
        const data = await res.json();
        setMessage('Error: ' + data.error);
      }
    } catch (err) {
      setMessage('Failed to update question');
    }
  };

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-4">
        <AmbientGlow color="amber" size="lg" position="top-left" className="z-0" />
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-[#a1a1aa] font-medium animate-pulse">Checking credentials...</p>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4">
        <AmbientGlow color="amber" size="lg" position="top-left" className="z-0" />
        <GlassCard padding="lg" className="max-w-md w-full text-center border-red-500/20">
          <div className="flex justify-center mb-4">
            <XCircle className="w-12 h-12 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-muted mb-6">You do not have administrative privileges to view this page.</p>
          <div className="flex gap-4 justify-center">
            <Link href="/login" className="btn-primary py-2.5 px-5 text-sm font-semibold rounded-xl text-center">
              Sign In as Admin
            </Link>
            <Link href="/" className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white glass-card text-center">
              Back to Home
            </Link>
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">
      <AmbientGlow color="amber" size="lg" position="top-left" className="z-0" />
      <AmbientGlow color="teal" size="md" position="bottom-right" className="z-0" />
      
      <Header />
      
      <main className="pt-28 pb-12">
        <Container>
          <GlassCard padding="lg" className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Admin Dashboard</h1>
            <p className="text-muted">Manage institution approvals and flagged accounts</p>
          </GlassCard>

          {message && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              {message}
            </div>
          )}

          <div className="flex gap-4 mb-6">
            <button
              onClick={() => setActiveTab('institutions')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'institutions' 
                  ? 'bg-amber-500 text-black' 
                  : 'glass-card text-white/60 hover:text-white'
              }`}
            >
              <Building className="w-5 h-5 inline mr-2" />
              Institution Requests ({institutions.filter((i: any) => i.status === 'pending').length})
            </button>
            <button
              onClick={() => setActiveTab('flagged')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'flagged' 
                  ? 'bg-red-500 text-white' 
                  : 'glass-card text-white/60 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-5 h-5 inline mr-2" />
              Flagged Accounts ({flaggedUsers.length})
            </button>
            <button
              onClick={() => setActiveTab('questions')}
              className={`px-6 py-3 rounded-xl font-semibold transition-all ${
                activeTab === 'questions'
                  ? 'bg-amber-500 text-black'
                  : 'glass-card text-white/60 hover:text-white'
              }`}
            >
              <Flag className="w-5 h-5 inline mr-2" />
              Question Flags ({questionFlags.length})
            </button>
          </div>

          {activeTab === 'institutions' && (
            <div className="grid md:grid-cols-2 gap-6">
              <GlassCard padding="none">
                <div className="p-4 border-b border-white/10">
                  <h2 className="text-lg font-semibold text-white">Registration Requests</h2>
                </div>
                <div className="p-4 space-y-3 max-h-125 overflow-y-auto">
                  {loading ? (
                    <p className="text-muted">Loading...</p>
                  ) : institutions.length === 0 ? (
                    <p className="text-muted">No pending requests.</p>
                  ) : (
                    institutions.map((inst: any) => (
                      <button 
                        key={inst._id}
                        onClick={() => setSelectedInst(inst)}
                        className={`w-full text-left p-4 rounded-xl transition-all ${
                          selectedInst?._id === inst._id 
                            ? 'bg-amber-500/20 border border-amber-500/30' 
                            : 'glass-card hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-white font-medium">{inst.collegeName}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            (inst.status === 'approved' || inst.status === 'active')
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {inst.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted mt-1">{inst.mentorEmail || inst.representativeEmail}</p>
                      </button>
                    ))
                  )}
                </div>
              </GlassCard>

              <GlassCard padding="lg">
                {selectedInst ? (
                  <>
                    <h3 className="text-lg font-semibold text-white mb-4">Request Details</h3>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div><span className="text-muted">College Name:</span></div>
                        <div className="text-white">{selectedInst.collegeName}</div>
                        <div><span className="text-muted">Location:</span></div>
                        <div className="text-white">{selectedInst.collegeLocation || selectedInst.location}</div>
                        <div><span className="text-muted">Website:</span></div>
                        <div className="text-white">{selectedInst.websiteUrl || 'Not provided'}</div>
                        <div><span className="text-muted">Document Type:</span></div>
                        <div className="text-white">{selectedInst.documentType || selectedInst.documents?.documentType}</div>
                      </div>
                      <hr className="border-white/10" />
                      <div className="grid grid-cols-2 gap-3">
                        <div><span className="text-muted">Representative:</span></div>
                        <div className="text-white">{selectedInst.mentorName || selectedInst.representativeName}</div>
                        <div><span className="text-muted">Email:</span></div>
                        <div className="text-white">{selectedInst.mentorEmail || selectedInst.representativeEmail}</div>
                        <div><span className="text-muted">Phone:</span></div>
                        <div className="text-white">{selectedInst.mentorPhone || selectedInst.representativePhone}</div>
                      </div>
                      <hr className="border-white/10" />
                      <div className="grid grid-cols-2 gap-3">
                        <div><span className="text-muted">{selectedInst.documentType || selectedInst.documents?.documentType || 'Document'} Number:</span></div>
                        <div className="text-white">{selectedInst.aadhaarNumber || selectedInst.documents?.aadhaarNumber || 'Not provided'}</div>
                        <div><span className="text-muted">Consent:</span></div>
                        <div className={selectedInst.consent ? 'text-emerald-400' : 'text-red-400'}>
                          {selectedInst.consent ? 'Yes' : 'No'}
                        </div>
                      </div>
                      
                      {(selectedInst.selfieLocalPath || selectedInst.documents?.selfieLocalPath || selectedInst.aadhaarLocalPath || selectedInst.documents?.aadhaarLocalPath || selectedInst.documentLocalPath || selectedInst.documents?.documentLocalPath) && (
                        <>
                          <hr className="border-white/10" />
                          <div className="space-y-3">
                            {(selectedInst.selfieLocalPath || selectedInst.documents?.selfieLocalPath) && (
                              <div>
                                <span className="text-muted block mb-1.5">Live Verification Selfie:</span>
                                <div className="relative w-32 h-32 rounded-xl overflow-hidden border border-white/10 bg-white/5">
                                  <img
                                    src={`/api/admin/testing-files?filename=${selectedInst.selfieLocalPath || selectedInst.documents?.selfieLocalPath}`}
                                    alt="Verification Selfie"
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              </div>
                            )}
                            {(selectedInst.aadhaarLocalPath || selectedInst.documents?.aadhaarLocalPath) && (
                              <div className="flex justify-between items-center">
                                <span className="text-muted">Representative Photo:</span>
                                <a
                                  href={`/api/admin/testing-files?filename=${selectedInst.aadhaarLocalPath || selectedInst.documents?.aadhaarLocalPath}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-amber-400 hover:text-amber-300 font-semibold underline text-xs inline-flex items-center gap-1"
                                >
                                  View ID Photo
                                </a>
                              </div>
                            )}
                            {(selectedInst.documentLocalPath || selectedInst.documents?.documentLocalPath) && (
                              <div className="flex justify-between items-center">
                                <span className="text-muted">Existence Document:</span>
                                <a
                                  href={`/api/admin/testing-files?filename=${selectedInst.documentLocalPath || selectedInst.documents?.documentLocalPath}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-amber-400 hover:text-amber-300 font-semibold underline text-xs inline-flex items-center gap-1"
                                >
                                  View Document
                                </a>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {selectedInst.status === 'pending' && (
                      <div className="mt-6 flex gap-4">
                        <Button 
                          onClick={() => handleApprove(selectedInst._id)}
                          fullWidth
                          icon={<CheckCircle className="w-4 h-4" />}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Approve
                        </Button>
                        <Button 
                          onClick={() => {
                            setRejectingId(selectedInst._id);
                            setRejectionReason('');
                            setShowRejectModal(true);
                          }}
                          fullWidth
                          variant="secondary"
                          icon={<XCircle className="w-4 h-4" />}
                          className="border border-red-500/20 text-red-400 hover:bg-red-500/10 bg-red-500/5 hover:text-red-300"
                        >
                          Reject
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted text-center py-12">Select a request to view details</p>
                )}
              </GlassCard>
            </div>
          )}

          {activeTab === 'flagged' && (
            <GlassCard padding="none">
              <div className="p-4 border-b border-red-500/20 bg-red-500/5">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  Flagged Accounts
                </h2>
              </div>
              <div className="p-4 space-y-3">
                {flaggedUsers.length === 0 ? (
                  <p className="text-muted text-center py-8">No flagged accounts.</p>
                ) : (
                  flaggedUsers.map((user: any) => (
                    <div key={user._id} className="glass-card rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-red-400" />
                            <span className="text-white font-medium">{user.fullName || 'Unknown'}</span>
                          </div>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted">
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {user.email || user.phone || 'No contact'}
                            </span>
                            <span>Role: {user.role}</span>
                          </div>
                          {user.flagReason && (
                            <p className="text-sm text-red-400 mt-2">{user.flagReason}</p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="secondary"
                            size="sm"
                            onClick={() => handleReactivate(user.email || user.phone)}
                            icon={<CheckCircle className="w-4 h-4" />}
                          >
                            Reactivate
                          </Button>
                          <Button 
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(user.email || user.phone)}
                            icon={<XCircle className="w-4 h-4" />}
                          >
                            Deactivate
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          )}

          {activeTab === 'questions' && (
            <GlassCard padding="none">
              <div className="p-4 border-b border-amber-500/20 bg-amber-500/5">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Flag className="w-5 h-5 text-amber-400" />
                  Flagged Questions
                </h2>
              </div>
              <div className="p-4 space-y-3">
                {questionFlags.length === 0 ? (
                  <p className="text-muted text-center py-8">No flagged questions.</p>
                ) : (
                  questionFlags.map((item: any) => (
                    <div key={item.questionId} className="glass-card rounded-xl p-4 border border-white/10">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium">{item.questionText}</span>
                            <span className="text-xs px-2 py-1 rounded-full bg-amber-500/10 text-amber-400">{item.flagCount} flags</span>
                          </div>
                          <div className="text-sm text-muted flex flex-wrap gap-3">
                            <span>Interest: {item.interest || 'N/A'}</span>
                            <span>Difficulty: {item.difficulty || 'N/A'}</span>
                            <span>Users: {item.users}</span>
                          </div>
                          <div className="text-sm text-red-300">
                            {(item.samples || []).filter(Boolean).slice(0, 3).join(' • ') || 'No sample reason provided.'}
                          </div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => handleMarkQuestionSafe(item.questionId)}>
                          Mark Safe
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          )}

          <div className="mt-8 flex gap-4">
            <LogoutButton />
            <Link href="/" className="btn-ghost">Home</Link>
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