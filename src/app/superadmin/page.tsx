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
  AmbientGlow,
  Input,
  Select 
} from '../components/ui';
import LogoutButton from '@/app/components/LogoutButton';
import { ShieldCheck, MapPin, CheckCircle, Mail, Phone, Calendar, Loader2, XCircle, CreditCard, Clock, Building2 } from 'lucide-react';

export default function SuperAdminDashboard() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'active'>('pending');

  // Activation modal state
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [activateForm, setActivateForm] = useState({
    totalCredits: 100,
    duration: '1 year',
    enabledPortals: ['interview', 'exam'] as string[],
  });
  const [activating, setActivating] = useState(false);

  // Rejection modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  // Add credits modal
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [creditsInstId, setCreditsInstId] = useState<string | null>(null);
  const [addCreditsAmount, setAddCreditsAmount] = useState(100);
  const [addingCredits, setAddingCredits] = useState(false);

  const fetchInstitutes = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/admin/b2b/requests');
      if (!res.ok) throw new Error('Failed to fetch institutes');
      const data = await res.json();
      setInstitutes(data);
    } catch (err: any) {
      setError(err.message || 'Error loading dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/status');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user.role === 'superadmin') {
            setAuthorized(true);
            fetchInstitutes();
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

  const handleActivate = async () => {
    if (!activatingId) return;
    setActivating(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/admin/b2b/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          instituteId: activatingId, 
          ...activateForm 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Institute activated! Login credentials: ${data.credentials?.email} / ${data.credentials?.password || '(auto-generated)'}`);
        setShowActivateModal(false);
        setActivatingId(null);
        fetchInstitutes();
      } else {
        setError(data.error || 'Activation failed');
      }
    } catch (err) {
      setError('An error occurred during activation');
    } finally {
      setActivating(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectionReason.trim()) return;
    setRejecting(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch('/api/admin/b2b/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rejectingId, reason: rejectionReason }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Institute request rejected.');
        setShowRejectModal(false);
        setRejectingId(null);
        setRejectionReason('');
        fetchInstitutes();
      } else {
        setError(data.error || 'Rejection failed');
      }
    } catch (err) {
      setError('An error occurred during rejection');
    } finally {
      setRejecting(false);
    }
  };

  const handleAddCredits = async () => {
    if (!creditsInstId || addCreditsAmount <= 0) return;
    setAddingCredits(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch(`/api/admin/b2b/institutes/${creditsInstId}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: addCreditsAmount }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Added ${addCreditsAmount} credits successfully.`);
        setShowCreditsModal(false);
        setCreditsInstId(null);
        fetchInstitutes();
      } else {
        setError(data.error || 'Failed to add credits');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setAddingCredits(false);
    }
  };

  const togglePortal = (portal: string) => {
    setActivateForm(prev => ({
      ...prev,
      enabledPortals: prev.enabledPortals.includes(portal)
        ? prev.enabledPortals.filter(p => p !== portal)
        : [...prev.enabledPortals, portal]
    }));
  };

  const pendingList = institutes.filter(inst => inst.status === 'pending');
  const activeList = institutes.filter(inst => inst.status === 'active');

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex flex-col items-center justify-center p-4">
        <AmbientGlow color="purple" size="lg" position="top-left" className="z-0" />
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
        <p className="text-[#a1a1aa] font-medium animate-pulse">Checking credentials...</p>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4">
        <AmbientGlow color="purple" size="lg" position="top-left" className="z-0" />
        <GlassCard padding="lg" className="max-w-md w-full text-center border-red-500/20">
          <div className="flex justify-center mb-4">
            <XCircle className="w-12 h-12 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-muted mb-6">You do not have super-administrative privileges to view this page.</p>
          <div className="flex gap-4 justify-center">
            <Link href="/login" className="btn-primary py-2.5 px-5 text-sm font-semibold rounded-xl text-center">
              Sign In as SuperAdmin
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
                <CardTitle className="text-2xl font-bold">B2B Institute Management</CardTitle>
                <CardDescription>Review, activate, and manage institutional partners</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="ghost" onClick={fetchInstitutes} className="text-white/60 hover:text-white">
                  Refresh
                </Button>
                <LogoutButton />
              </div>
            </GlassCard>

            {/* Alerts */}
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

            {/* Tabs */}
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
                onClick={() => setActiveTab('active')}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === 'active'
                    ? 'bg-purple-500/15 border border-purple-500/35 text-purple-300'
                    : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                }`}
              >
                Active Institutes ({activeList.length})
              </button>
            </div>

            {/* Content */}
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                <p className="text-sm text-muted">Retrieving institutes...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeTab === 'pending' ? (
                  pendingList.length === 0 ? (
                    <GlassCard className="text-center py-12 text-white/30">
                      No pending requests.
                    </GlassCard>
                  ) : (
                    pendingList.map((inst) => (
                      <GlassCard key={inst._id} className="p-6 border-white/5 hover:border-purple-500/20 transition-all">
                        <div className="flex flex-col md:flex-row justify-between gap-6">
                          <div className="space-y-4 flex-1">
                            <div>
                              <h3 className="text-lg font-bold text-white uppercase tracking-tight">{inst.collegeName}</h3>
                              <p className="text-xs text-white/40 flex items-center gap-1.5 mt-0.5">
                                <MapPin className="w-3 h-3 text-purple-400" /> {inst.location || 'Location Pending'}
                              </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-sm text-white/60">
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Representative</p>
                                <p className="font-semibold text-white">{inst.representativeName}</p>
                                <p className="text-xs flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-white/30" /> {inst.representativeEmail}</p>
                                <p className="text-xs flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-white/30" /> {inst.representativePhone}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Submitted</p>
                                <p className="text-xs flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-white/30" /> {new Date(inst.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col justify-center gap-2 shrink-0 md:w-44">
                            <Button 
                              onClick={() => {
                                setActivatingId(inst._id);
                                setShowActivateModal(true);
                              }}
                              fullWidth
                              className="bg-purple-600 hover:bg-purple-700 text-white shadow-[0_0_12px_rgba(147,51,234,0.3)]"
                            >
                              Activate
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
                  activeList.length === 0 ? (
                    <GlassCard className="text-center py-12 text-white/30">
                      No active institutes.
                    </GlassCard>
                  ) : (
                    activeList.map((inst) => (
                      <GlassCard key={inst._id} className="p-6 border-white/5">
                        <div className="flex flex-col md:flex-row justify-between gap-6">
                          <div className="space-y-3 flex-1">
                            <div>
                              <h3 className="text-lg font-bold text-white uppercase tracking-tight">{inst.collegeName}</h3>
                              <p className="text-xs text-white/40 flex items-center gap-1.5 mt-0.5">
                                <MapPin className="w-3 h-3 text-purple-400" /> {inst.location || 'Location N/A'}
                              </p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-white/60">
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Credits</p>
                                <p className="font-semibold text-white">
                                  {inst.plan?.usedCredits || 0} / {inst.plan?.totalCredits || 0}
                                </p>
                                <p className="text-xs">used / total</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Portals</p>
                                <p className="text-xs">{(inst.plan?.enabledPortals || []).join(', ') || 'None'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] uppercase tracking-wider text-white/30 font-bold">Database</p>
                                <p className="text-xs font-mono text-purple-300">{inst.dbName}</p>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col justify-center gap-2 shrink-0 md:w-44">
                            <span className="inline-flex px-3 py-1 rounded-lg text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-500/20 text-center justify-center">
                              Active
                            </span>
                            <Button
                              onClick={() => {
                                setCreditsInstId(inst._id);
                                setAddCreditsAmount(100);
                                setShowCreditsModal(true);
                              }}
                              variant="secondary"
                              fullWidth
                              className="text-xs"
                            >
                              <CreditCard className="w-3.5 h-3.5 mr-1.5" />
                              Add Credits
                            </Button>
                          </div>
                        </div>
                      </GlassCard>
                    ))
                  )
                )}
              </div>
            )}

            <div className="text-center pt-6">
              <Link href="/" className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
                ← Back to Homepage
              </Link>
            </div>
          </div>
        </Container>
      </main>

      {/* Activate Modal */}
      {showActivateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <GlassCard className="max-w-md w-full border-purple-500/20" padding="lg">
            <h3 className="text-xl font-bold text-white mb-2">Activate Institute</h3>
            <p className="text-sm text-muted mb-6">
              Set the plan details for this institution. This will create their isolated database and generate login credentials.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted mb-2">Total Credits</label>
                <input
                  type="number"
                  min={1}
                  value={activateForm.totalCredits}
                  onChange={(e) => setActivateForm(prev => ({ ...prev, totalCredits: parseInt(e.target.value) || 0 }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-purple-500/40 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-2">Duration</label>
                <select
                  value={activateForm.duration}
                  onChange={(e) => setActivateForm(prev => ({ ...prev, duration: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-purple-500/40 transition-all cursor-pointer"
                >
                  <option value="3 months" className="bg-[#0d0f1a]">3 Months</option>
                  <option value="6 months" className="bg-[#0d0f1a]">6 Months</option>
                  <option value="1 year" className="bg-[#0d0f1a]">1 Year</option>
                  <option value="2 years" className="bg-[#0d0f1a]">2 Years</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-muted mb-2">Enabled Portals</label>
                <div className="flex gap-2 flex-wrap">
                  {['interview', 'exam', 'recommendation', 'resume'].map(portal => (
                    <button
                      key={portal}
                      type="button"
                      onClick={() => togglePortal(portal)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        activateForm.enabledPortals.includes(portal)
                          ? 'bg-purple-500/20 border border-purple-500/40 text-purple-300'
                          : 'bg-white/5 border border-white/10 text-white/40'
                      }`}
                    >
                      {portal.charAt(0).toUpperCase() + portal.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <Button
                variant="ghost"
                fullWidth
                onClick={() => {
                  setShowActivateModal(false);
                  setActivatingId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                fullWidth
                disabled={activating || activateForm.totalCredits <= 0 || activateForm.enabledPortals.length === 0}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleActivate}
              >
                {activating ? 'Activating...' : 'Activate Institute'}
              </Button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <GlassCard className="max-w-md w-full border-red-500/20" padding="lg">
            <h3 className="text-xl font-bold text-white mb-2">Reject Institute Request</h3>
            <p className="text-sm text-muted mb-4">
              Provide the reason for rejection. This will be communicated to the representative.
            </p>
            
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="e.g., Document verification failed, invalid institution details..."
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

      {/* Add Credits Modal */}
      {showCreditsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <GlassCard className="max-w-sm w-full border-purple-500/20" padding="lg">
            <h3 className="text-xl font-bold text-white mb-2">Add Credits</h3>
            <p className="text-sm text-muted mb-4">Enter the number of credits to add.</p>
            <input
              type="number"
              min={1}
              value={addCreditsAmount}
              onChange={(e) => setAddCreditsAmount(parseInt(e.target.value) || 0)}
              className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-purple-500/40 transition-all mb-6"
            />
            <div className="flex gap-4">
              <Button variant="ghost" fullWidth onClick={() => { setShowCreditsModal(false); setCreditsInstId(null); }}>
                Cancel
              </Button>
              <Button
                fullWidth
                disabled={addCreditsAmount <= 0 || addingCredits}
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleAddCredits}
              >
                {addingCredits ? 'Adding...' : `Add ${addCreditsAmount} Credits`}
              </Button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
