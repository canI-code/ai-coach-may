'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Container, GlassCard, Button, Header, AmbientGlow, Section, SectionHeader } from '../components/ui';
import LogoutButton from '@/app/components/LogoutButton';
import { CheckCircle, XCircle, AlertTriangle, Building, Mail, Phone, User } from 'lucide-react';

export default function AdminPage() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [flaggedUsers, setFlaggedUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [selectedInst, setSelectedInst] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'institutions' | 'flagged'>('institutions');

  const fetchInstitutions = async () => {
    try {
      const res = await fetch('/api/admin/institutions');
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

  useEffect(() => {
    fetchInstitutions();
    fetchFlaggedUsers();
  }, []);

  const handleApprove = async (id: string) => {
    setMessage('Approving...');
    try {
      const res = await fetch('/api/admin/institutions/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setMessage('Approved successfully!');
        setSelectedInst(null);
        fetchInstitutions();
      } else {
        const data = await res.json();
        setMessage('Error: ' + data.error);
      }
    } catch (err) {
      setMessage('Approval failed');
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
          </div>

          {activeTab === 'institutions' && (
            <div className="grid md:grid-cols-2 gap-6">
              <GlassCard padding="none">
                <div className="p-4 border-b border-white/10">
                  <h2 className="text-lg font-semibold text-white">Registration Requests</h2>
                </div>
                <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
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
                            inst.status === 'approved' 
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {inst.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted mt-1">{inst.mentorEmail}</p>
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
                        <div className="text-white">{selectedInst.collegeLocation}</div>
                        <div><span className="text-muted">Document:</span></div>
                        <div className="text-white">{selectedInst.documentType}</div>
                      </div>
                      <hr className="border-white/10" />
                      <div className="grid grid-cols-2 gap-3">
                        <div><span className="text-muted">Mentor Name:</span></div>
                        <div className="text-white">{selectedInst.mentorName}</div>
                        <div><span className="text-muted">Mentor Email:</span></div>
                        <div className="text-white">{selectedInst.mentorEmail}</div>
                        <div><span className="text-muted">Mentor Phone:</span></div>
                        <div className="text-white">{selectedInst.mentorPhone}</div>
                      </div>
                      <hr className="border-white/10" />
                      <div className="grid grid-cols-2 gap-3">
                        <div><span className="text-muted">Aadhaar:</span></div>
                        <div className="text-white">{selectedInst.aadhaarNumber || 'Not provided'}</div>
                        <div><span className="text-muted">Consent:</span></div>
                        <div className={selectedInst.consent ? 'text-emerald-400' : 'text-red-400'}>
                          {selectedInst.consent ? 'Yes' : 'No'}
                        </div>
                      </div>
                    </div>

                    {selectedInst.status === 'pending' && (
                      <Button 
                        onClick={() => handleApprove(selectedInst._id)}
                        fullWidth
                        icon={<CheckCircle className="w-4 h-4" />}
                        className="mt-6"
                      >
                        Approve Institution
                      </Button>
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

          <div className="mt-8 flex gap-4">
            <LogoutButton />
            <Link href="/" className="btn-ghost">Home</Link>
          </div>
        </Container>
      </main>
    </div>
  );
}