'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GlassCard, Button, Input, Container, Header, OtpInput } from '../components/ui';
import { AmbientGlow } from '../components/ui';
import { ArrowLeft, ArrowRight, Mail, Phone, Lock, User, Briefcase } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loginMode, setLoginMode] = useState<'b2c' | 'b2b' | ''>('');
  const [userType, setUserType] = useState('');
  
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailIdentifier, setEmailIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [verifyPhone, setVerifyPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);

  const isB2C = loginMode === 'b2c';

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('deleted') === 'true') {
        setMessage('Your account has been scheduled for deletion. It will be permanently deleted after 30 days. You can log back in at any time within these 30 days to cancel this request and fully recover your account.');
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleModeSelection = (mode: 'b2c' | 'b2b') => {
    setLoginMode(mode);
    if (mode === 'b2c') {
      setUserType('student');
      setStep(2);
    } else {
      setStep(2);
      setUserType('');
    }
  };

  const handleInitialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (isB2C) {
      if (phoneNumber.length !== 10) {
        setError('Phone number must be exactly 10 digits.');
        return;
      }
      const fullPhone = countryCode + phoneNumber;
      try {
        const res = await fetch('/api/auth/otp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: fullPhone, role: 'student' }),
        });
        const data = await res.json();
        if (res.ok) {
          setIsOtpSent(true);
          setResendTimer(60);
          setStep(3);
          setMessage(data.message);
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError('Failed to send OTP.');
      }
    } else {
      // B2B: validate email + password first
      setMessage('Verifying credentials...');
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: emailIdentifier, 
            password, 
            role: 'institution', // generic B2B role — server will determine actual role
            validateOnly: true 
          }),
        });
        const data = await res.json();
        if (res.ok) {
          const phoneToNotify = data.user.phone;
          setVerifyPhone(phoneToNotify);
          const otpRes = await fetch('/api/auth/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: phoneToNotify, role: 'b2b' }),
          });
          if (otpRes.ok) {
            setIsOtpSent(true);
            setResendTimer(60);
            setStep(3);
            setMessage(`Credentials verified. OTP sent to ${phoneToNotify.replace(/(\d{2})(\d{5})(\d{5})/, '$1 ***** $3')}.`);
          }
        } else {
          setError(data.error);
          setMessage('');
        }
      } catch (err) {
        setError('Login failed');
        setMessage('');
      }
    }
  };

  const handleVerifyAndLogin = async () => {
    setError('');
    const fullPhone = isB2C ? (countryCode + phoneNumber) : ''; 
    const identifier = isB2C ? fullPhone : verifyPhone;
    
    if (isLockedOut) {
      setError(`Account locked. Please wait ${lockoutMinutes} minutes before trying again.`);
      return;
    }
    
    try {
      const otpRes = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp, role: userType || 'b2b' }),
      });

      const otpData = await otpRes.json();
      
      if (otpRes.status === 429 && otpData.lockout) {
        setIsLockedOut(true);
        setLockoutMinutes(otpData.minutesLeft || 10);
        setError(otpData.error || 'Too many failed attempts. Please try again later.');
        
        const countdown = setInterval(() => {
          setLockoutMinutes(prev => {
            if (prev <= 1) {
              setIsLockedOut(false);
              setAttemptsRemaining(5);
              clearInterval(countdown);
              return 0;
            }
            return prev - 1;
          });
        }, 60000);
        
        return;
      }
      
      if (!otpRes.ok) {
        const attemptsMatch = otpData.error?.match(/(\d+)/);
        if (attemptsMatch) {
          setAttemptsRemaining(parseInt(attemptsMatch[1]));
        }
        setError(otpData.error || 'Invalid OTP');
        setOtp('');
        return;
      }

      // OTP verified — now complete login
      const payload: any = { role: userType || 'student' };
      if (isB2C) {
        payload.phone = fullPhone;
        payload.role = 'student';
      } else {
        payload.email = emailIdentifier;
        payload.password = password;
        payload.role = 'institution'; // server determines actual role
      }

      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const loginData = await loginRes.json();
      if (loginRes.ok) {
        const role = loginData.user?.role;
        // Role-based redirect
        if (role === 'institution') router.push('/dashboard/b2b/institution');
        else if (role === 'mentor') router.push('/dashboard/b2b/mentor');
        else if (role === 'mentee') router.push(loginData.recovered ? '/dashboard/b2b?recovered=true' : '/dashboard/b2b');
        else if (role === 'admin') router.push('/admin');
        else if (role === 'superadmin') router.push('/superadmin');
        else router.push(loginData.recovered ? '/dashboard/b2c?recovered=true' : '/dashboard/b2c');
      } else {
        setError(loginData.error);
      }
    } catch (err) {
      setError('An error occurred during login.');
    }
  };

  const handleForgotPasswordSubmit = async () => {
    setError('');
    setMessage('Sending reset OTP...');
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: emailIdentifier, role: 'b2b' }),
      });
      if (res.ok) {
        setStep(5);
        setMessage('Reset OTP sent (Simulated: 123456).');
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to send OTP.');
    }
  };

  const handleResetPassword = async () => {
    setError('');
    try {
      const otpRes = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: emailIdentifier, otp }),
      });
      if (!otpRes.ok) {
        const otpData = await otpRes.json();
        setError(otpData.error);
        return;
      }

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailIdentifier, newPassword }),
      });
      if (res.ok) {
        setMessage('Password reset successful! Please login.');
        setStep(2);
      } else {
        const data = await res.json();
        setError(data.error);
      }
    } catch (err) {
      setError('Reset failed.');
    }
  };

  const getBackStep = () => {
    if (step === 2) return 1;
    if (step === 3) return 2;
    if (step === 4) return 2;
    if (step === 5) return 4;
    return 1;
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
              <h1 className="text-2xl font-bold text-white mb-2">Welcome Back</h1>
              <p className="text-muted">Sign in to continue your preparation</p>
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

              {/* Step 1: Select login mode */}
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-white font-medium mb-4">How would you like to sign in?</p>
                  <button
                    type="button"
                    onClick={() => handleModeSelection('b2c')}
                    className="glass-card glass-card-hover rounded-2xl p-6 text-left w-full"
                  >
                    <div className="flex items-center gap-4">
                      <div className="icon-container icon-container-amber">
                        <User className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">Student / Professional</h3>
                        <p className="text-sm text-muted">Individual practice with phone OTP</p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeSelection('b2b')}
                    className="glass-card glass-card-hover rounded-2xl p-6 text-left w-full"
                  >
                    <div className="flex items-center gap-4">
                      <div className="icon-container icon-container-teal">
                        <Briefcase className="w-5 h-5 text-teal-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">Business</h3>
                        <p className="text-sm text-muted">Institution, Mentor, or Mentee login</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* Step 2: Credentials */}
              {step === 2 && (
                <form onSubmit={handleInitialSubmit} className="space-y-4">
                  <p className="text-white font-medium mb-4">
                    {isB2C ? 'Sign in with phone' : 'Sign in with credentials'}
                  </p>
                  
                  {isB2C ? (
                    <div className="space-y-4">
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
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Input
                        label="Email ID / Phone Number"
                        type="text"
                        icon={<Mail className="w-4 h-4" />}
                        value={emailIdentifier}
                        onChange={(e) => setEmailIdentifier(e.target.value)}
                        placeholder="Enter your email or phone number"
                        required
                      />
                      <Input
                        label="Password"
                        type="password"
                        icon={<Lock className="w-4 h-4" />}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="text-sm text-muted hover:text-white transition-colors"
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}

                  <Button type="submit" fullWidth icon={<ArrowRight className="w-4 h-4" />}>
                    Continue
                  </Button>
                </form>
              )}

              {/* Step 3: OTP Verification */}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-white font-medium mb-4 text-center">Verify Identity</p>
                  <p className="text-sm text-muted mb-6 text-center">
                    Enter the 6-digit code sent to your {isB2C ? 'phone' : 'registered phone'} (Simulated: 123456).
                  </p>
                  
                  {isLockedOut ? (
                    <div className="text-center py-8">
                      <div className="text-red-400 text-lg mb-2">
                        Account Locked
                      </div>
                      <p className="text-muted">
                        Please wait {lockoutMinutes} minute{lockoutMinutes > 1 ? 's' : ''} before trying again.
                      </p>
                    </div>
                  ) : (
                    <>
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
                        disabled={isLockedOut}
                      />
                      <Button onClick={handleVerifyAndLogin} fullWidth disabled={otp.length !== 6 || isLockedOut}>
                        Verify & Login
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={handleInitialSubmit}
                        disabled={resendTimer > 0 || isLockedOut}
                        fullWidth
                      >
                        Resend OTP {resendTimer > 0 ? `(${resendTimer}s)` : ''}
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Step 4: Forgot Password (B2B only) */}
              {step === 4 && (
                <div className="space-y-4">
                  <p className="text-white font-medium mb-4">Forgot Password</p>
                  <p className="text-sm text-muted mb-4">
                    Enter your registered Email ID to receive a reset OTP.
                  </p>
                  <Input
                    label="Email ID"
                    type="email"
                    icon={<Mail className="w-4 h-4" />}
                    value={emailIdentifier}
                    onChange={(e) => setEmailIdentifier(e.target.value)}
                    placeholder="Enter your email"
                  />
                  <Button onClick={handleForgotPasswordSubmit} fullWidth>
                    Send Reset OTP
                  </Button>
                </div>
              )}

              {/* Step 5: Reset Password */}
              {step === 5 && (
                <div className="space-y-4">
                  <p className="text-white font-medium mb-4">Reset Password</p>
                  <Input
                    label="OTP Code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter OTP (123456)"
                  />
                  <Input
                    label="New Password"
                    type="password"
                    icon={<Lock className="w-4 h-4" />}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <Button onClick={handleResetPassword} fullWidth>
                    Update Password
                  </Button>
                </div>
              )}

              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(getBackStep())}
                  className="mt-6 text-sm text-muted hover:text-white transition-colors flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
              )}
            </GlassCard>

            <p className="text-center text-sm text-muted mt-6">
              Don't have an account?{' '}
              <Link href="/signup" className="text-amber-400 hover:text-amber-300">
                Sign Up
              </Link>
            </p>
          </div>
        </Container>
      </main>
    </div>
  );
}