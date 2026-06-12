'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container, GlassCard, Button, Input, Header, AmbientGlow, OtpInput } from '../components/ui';
import { ArrowLeft, ArrowRight, User, Phone, Briefcase } from 'lucide-react';

const calculateAge = (dob: string) => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * B2C-only signup page.
 * B2B users (institution reps, mentors, mentees) are created by their
 * admin/institution/mentor — they do NOT self-register here.
 */
export default function Signup() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [userType, setUserType] = useState('');
  
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  
  const [details, setDetails] = useState({ fullName: '', dob: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleRoleSelection = (role: string) => {
    setUserType(role);
    setStep(2);
  };

  const handleSendOtp = async () => {
    setError('');
    if (phoneNumber.length !== 10) {
      setError('Phone number must be exactly 10 digits.');
      return;
    }
    setMessage('');
    const fullPhone = countryCode + phoneNumber;
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: fullPhone }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsOtpSent(true);
        setResendTimer(60);
        setMessage(data.message);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to send OTP.');
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    const fullPhone = countryCode + phoneNumber;
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: fullPhone, otp, role: 'student' }),
      });
      const data = await res.json();
      if (res.ok) {
        setStep(3);
        setMessage('OTP Verified!');
      } else {
        const attemptsMatch = data.error?.match(/(\d+)/);
        if (attemptsMatch) {
          setAttemptsRemaining(parseInt(attemptsMatch[1]));
        }
        setError(data.error);
        setOtp('');
      }
    } catch (err) {
      setError('Failed to verify OTP.');
    }
  };

  const submitFinal = async () => {
    setError('');
    
    if (!details.fullName || !details.dob) {
      setError('Please fill in all required fields.');
      return;
    }
    const age = calculateAge(details.dob);
    if (age < 15) {
      setError('You must be at least 15 years old.');
      return;
    }
    if (age > 150) {
      setError('Please enter a valid Date of Birth.');
      return;
    }
    
    setMessage('Completing registration...');
    try {
      const payload = {
        role: userType,
        fullName: details.fullName,
        dob: details.dob,
        phone: countryCode + phoneNumber,
      };

      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        router.push('/dashboard/b2c');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Registration failed.');
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
              <h1 className="text-2xl font-bold text-white mb-2">Create Account</h1>
              <p className="text-muted">Start your interview preparation journey</p>
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

              {/* Step 1: Role Selection — B2C only */}
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-white font-medium mb-4">I am a...</p>
                  <button
                    type="button"
                    onClick={() => handleRoleSelection('student')}
                    className="glass-card glass-card-hover rounded-2xl p-6 text-left w-full"
                  >
                    <div className="flex items-center gap-4">
                      <div className="icon-container icon-container-amber">
                        <User className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">Student</h3>
                        <p className="text-sm text-muted">Preparing for interviews & exams</p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleSelection('professional')}
                    className="glass-card glass-card-hover rounded-2xl p-6 text-left w-full"
                  >
                    <div className="flex items-center gap-4">
                      <div className="icon-container icon-container-teal">
                        <Briefcase className="w-5 h-5 text-teal-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">Professional</h3>
                        <p className="text-sm text-muted">Working professional preparing for career growth</p>
                      </div>
                    </div>
                  </button>
                  
                  <div className="mt-6 pt-4 border-t border-white/5">
                    <p className="text-xs text-muted text-center">
                      For institutional or business access,{' '}
                      <Link href="/plans" className="text-amber-400 hover:text-amber-300">
                        see our pricing plans
                      </Link>
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Phone Verification */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-white font-medium mb-4">Verify Phone Number</p>
                  
                  <div>
                    <label className="block text-sm font-medium text-muted mb-2">Phone Number</label>
                    <div className="flex gap-2">
                      <select
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        className="glass-input !w-28 cursor-pointer"
                        disabled={isOtpSent}
                      >
                        <option value="+91" className="bg-[#0d0f1a]">🇮🇳 +91</option>
                        <option value="+1" className="bg-[#0d0f1a]">🇺🇸 +1</option>
                        <option value="+44" className="bg-[#0d0f1a]">🇬🇧 +44</option>
                        <option value="+61" className="bg-[#0d0f1a]">🇦🇺 +61</option>
                        <option value="+49" className="bg-[#0d0f1a]">🇩🇪 +49</option>
                        <option value="+33" className="bg-[#0d0f1a]">🇫🇷 +33</option>
                        <option value="+81" className="bg-[#0d0f1a]">🇯🇵 +81</option>
                        <option value="+86" className="bg-[#0d0f1a]">🇨🇳 +86</option>
                        <option value="+55" className="bg-[#0d0f1a]">🇧🇷 +55</option>
                        <option value="+27" className="bg-[#0d0f1a]">🇿🇦 +27</option>
                        <option value="+971" className="bg-[#0d0f1a]">🇦🇪 +971</option>
                        <option value="+65" className="bg-[#0d0f1a]">🇸🇬 +65</option>
                      </select>
                      <input
                        type="tel"
                        placeholder="Phone Number"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                        className="glass-input flex-1"
                        maxLength={10}
                        disabled={isOtpSent}
                        required
                      />
                    </div>
                  </div>
                  
                  {!isOtpSent ? (
                    <Button onClick={handleSendOtp} fullWidth icon={<Phone className="w-4 h-4" />}>
                      Send OTP
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-sm text-muted mb-4 text-center">
                        Enter the 6-digit code sent to your phone (Simulated: 123456)
                      </p>
                      {attemptsRemaining < 5 && (
                        <p className="text-amber-400 text-sm text-center">
                          {attemptsRemaining} attempt{attemptsRemaining > 1 ? 's' : ''} remaining before lockout
                        </p>
                      )}
                      <OtpInput
                        value={otp}
                        onChange={setOtp}
                        length={6}
                        error={!!error}
                      />
                      <Button onClick={handleVerifyOtp} fullWidth disabled={otp.length !== 6}>
                        Verify OTP
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={handleSendOtp}
                        disabled={resendTimer > 0}
                        fullWidth
                      >
                        Resend OTP {resendTimer > 0 ? `(${resendTimer}s)` : ''}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Complete Registration */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-white font-medium mb-4">Complete Registration</p>
                  
                  <Input
                    label="Full Name"
                    value={details.fullName}
                    onChange={(e) => setDetails({ ...details, fullName: e.target.value })}
                    placeholder="Your full name"
                  />
                  
                  <Input
                    label="Date of Birth"
                    type="date"
                    value={details.dob}
                    onChange={(e) => setDetails({ ...details, dob: e.target.value })}
                  />
                  
                  <Button onClick={submitFinal} fullWidth icon={<ArrowRight className="w-4 h-4" />}>
                    Complete Registration
                  </Button>
                </div>
              )}

              {step > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 2 && isOtpSent) {
                      setIsOtpSent(false);
                      setOtp('');
                    } else {
                      setStep(step - 1);
                    }
                  }}
                  className="mt-6 text-sm text-muted hover:text-white transition-colors flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}
            </GlassCard>

            <p className="text-center text-sm text-muted mt-6">
              Already have an account?{' '}
              <Link href="/login" className="text-amber-400 hover:text-amber-300">
                Sign In
              </Link>
            </p>
          </div>
        </Container>
      </main>
    </div>
  );
}