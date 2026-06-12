'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container, GlassCard, Button, Input, Select, Header, AmbientGlow } from '../components/ui';
import { ArrowRight, UserPlus, Lock, Mail, Phone, Calendar, Loader2 } from 'lucide-react';

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [step, setStep] = useState(code ? 2 : 1);
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', phone: '', dob: '', gender: '',
  });
  const [countryCode, setCountryCode] = useState('+91');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setMessage('');
    
    if (!code.trim()) {
      setError('Invite code is required');
      return;
    }

    if (step === 1) {
      setStep(2);
      return;
    }

    // Validate fields
    if (!form.fullName || !form.email || !form.password || !form.phone) {
      setError('Please fill in all required fields');
      return;
    }
    if (form.phone.length !== 10) {
      setError('Phone number must be exactly 10 digits');
      return;
    }

    setLoading(true);
    setMessage('Creating your account...');
    
    try {
      const res = await fetch('/api/b2b/mentee/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.toUpperCase(),
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          phone: countryCode + form.phone,
          dob: form.dob,
          gender: form.gender,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Registration successful! Welcome to ${data.collegeName}. Redirecting to login...`);
        setTimeout(() => router.push('/login'), 2500);
      } else {
        setError(data.error || 'Registration failed');
        setMessage('');
      }
    } catch {
      setError('An error occurred');
      setMessage('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-grid">
      <AmbientGlow color="amber" size="lg" position="top-left" className="z-0" />
      <AmbientGlow color="teal" size="md" position="bottom-right" className="z-0" />
      <Header />

      <main className="pt-28 pb-12">
        <Container>
          <div className="max-w-md mx-auto">
            <GlassCard padding="lg" className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <UserPlus className="w-6 h-6 text-amber-400" />
                <h1 className="text-2xl font-bold text-white">Join as Mentee</h1>
              </div>
              <p className="text-muted">Enter your invite code to join an institution</p>
            </GlassCard>

            <GlassCard padding="lg">
              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}
              {message && (
                <div className="mb-6 p-4 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm">
                  {message}
                </div>
              )}

              <div className="space-y-4">
                <Input
                  label="Invite Code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="XXXX XXXX"
                  className="font-mono text-center tracking-[4px]"
                  disabled={step > 1}
                />

                {step === 2 && (
                  <>
                    <Input
                      label="Full Name"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      placeholder="Your full name"
                      required
                    />
                    <Input
                      label="Email"
                      type="email"
                      icon={<Mail className="w-4 h-4" />}
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="your@email.com"
                      required
                    />
                    <Input
                      label="Password"
                      type="password"
                      icon={<Lock className="w-4 h-4" />}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Choose a password"
                      required
                    />
                    <div>
                      <label className="block text-sm font-medium text-muted mb-2">Phone Number</label>
                      <div className="flex gap-2">
                        <select
                          value={countryCode}
                          onChange={(e) => setCountryCode(e.target.value)}
                          className="glass-input !w-28 cursor-pointer"
                        >
                          <option value="+91" className="bg-[#0d0f1a]">🇮🇳 +91</option>
                          <option value="+1" className="bg-[#0d0f1a]">🇺🇸 +1</option>
                          <option value="+44" className="bg-[#0d0f1a]">🇬🇧 +44</option>
                        </select>
                        <input
                          type="tel"
                          placeholder="Phone Number"
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, '') })}
                          className="glass-input flex-1"
                          maxLength={10}
                          required
                        />
                      </div>
                    </div>
                    <Select
                      label="Gender"
                      value={form.gender}
                      onChange={(e) => setForm({ ...form, gender: e.target.value })}
                      options={[
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                        { value: 'other', label: 'Other' },
                      ]}
                      placeholder="Select gender"
                    />
                    <Input
                      label="Date of Birth"
                      type="date"
                      value={form.dob}
                      onChange={(e) => setForm({ ...form, dob: e.target.value })}
                    />
                  </>
                )}

                <Button onClick={handleSubmit} fullWidth disabled={loading} icon={<ArrowRight className="w-4 h-4" />}>
                  {step === 1 ? 'Continue' : loading ? 'Creating Account...' : 'Complete Registration'}
                </Button>
              </div>
            </GlassCard>
          </div>
        </Container>
      </main>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-grid flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    }>
      <JoinForm />
    </Suspense>
  );
}
