'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GlassCard, Button, Input, Select, Container, Section, Header, OtpInput } from '../components/ui';
import { AmbientGlow } from '../components/ui';
import { ArrowLeft, ArrowRight, Mail, Phone, Lock, User, School } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState('');
  const [userType, setUserType] = useState('');
  
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailIdentifier, setEmailIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [college, setCollege] = useState('');
  const [colleges, setColleges] = useState([]);
  
  const [verifyPhone, setVerifyPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutMinutes, setLockoutMinutes] = useState(0);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);

  const isB2C = userType === 'student' || userType === 'professional';

  useEffect(() => {
    const fetchColleges = async () => {
      try {
        const res = await fetch('/api/institutions');
        const data = await res.json();
        if (res.ok) setColleges(data);
      } catch (err) { console.error(err); }
    };
    fetchColleges();
  }, []);

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

  const handleCategorySelection = (cat: string) => {
    setCategory(cat);
    setStep(1.5);
  };

  const handleRoleSelection = (role: string) => {
    setUserType(role);
    setStep(2);
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
      setMessage('Verifying credentials...');
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: emailIdentifier, 
            password, 
            role: userType, 
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
            body: JSON.stringify({ identifier: phoneToNotify, role: userType === 'mentor' ? 'mentor' : 'mentee' }),
          });
          if (otpRes.ok) {
            setIsOtpSent(true);
            setResendTimer(60);
            setStep(3);
            setMessage(`Credentials verified. OTP sent to ${phoneToNotify.replace(/(\d{2})(\d{5})(\d{5})/, '$1 ***** $3')}.`);
          }
        } else {
          setError(data.error);
        }
      } catch (err) {
        setError('Login failed');
      }
    }
  };

  const handleVerifyAndLogin = async () => {
    setError('');
    const fullPhone = isB2C ? (countryCode + phoneNumber) : ''; 
    const identifier = isB2C ? fullPhone : verifyPhone;
    
    console.log('handleVerifyAndLogin called, isLockedOut:', isLockedOut);
    
    if (isLockedOut) {
      setError(`Account locked. Please wait ${lockoutMinutes} minutes before trying again.`);
      return;
    }
    
    try {
      // First verify the OTP
      console.log('Calling OTP verify API with identifier:', identifier, 'otp:', otp);
      const otpRes = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp, role: userType }),
      });

      const otpData = await otpRes.json();
      console.log('OTP verify response:', otpRes.status, otpData);
      
      // Check for lockout response
      if (otpRes.status === 429 && otpData.lockout) {
        setIsLockedOut(true);
        setLockoutMinutes(otpData.minutesLeft || 10);
        setError(otpData.error || 'Too many failed attempts. Please try again later.');
        console.log('Lockout detected, setting isLockedOut=true');
        
        // Start countdown to unlock
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
        console.log('OTP not ok, setting error:', otpData.error);
        // Update attempts remaining
        const attemptsMatch = otpData.error?.match(/(\d+)/);
        if (attemptsMatch) {
          setAttemptsRemaining(parseInt(attemptsMatch[1]));
        }
        setError(otpData.error || 'Invalid OTP');
        setOtp(''); // Clear OTP on failure
        return;
      }

      console.log('OTP verified, proceeding to login');
      const payload: any = { role: userType };
      if (isB2C) {
        payload.phone = fullPhone;
      } else {
        payload.email = emailIdentifier;
        payload.password = password;
      }

      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const loginData = await loginRes.json();
      if (loginRes.ok) {
        if (isB2C) router.push(loginData.recovered ? '/dashboard/b2c?recovered=true' : '/dashboard/b2c');
        else if (userType === 'mentee') router.push('/dashboard/b2b');
        else if (userType === 'mentor') router.push('/dashboard/mentor');
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
        body: JSON.stringify({ identifier: emailIdentifier, role: 'mentee' }),
      });
      if (res.ok) {
        setStep(5);
        setMessage('Reset OTP sent to email (Simulated: 1234).');
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

  const RoleCard = ({ role, label, description, onClick }: { role: string; label: string; description: string; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className="glass-card glass-card-hover rounded-2xl p-6 text-left w-full"
    >
      <h3 className="text-white font-semibold text-lg mb-1">{label}</h3>
      <p className="text-sm text-muted">{description}</p>
    </button>
  );

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

              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-white font-medium mb-4">Select your category</p>
                  <button
                    type="button"
                    onClick={() => handleCategorySelection('institutional')}
                    className="glass-card glass-card-hover rounded-2xl p-6 text-left w-full"
                  >
                    <div className="flex items-center gap-4">
                      <div className="icon-container icon-container-amber">
                        <School className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">Institutional</h3>
                        <p className="text-sm text-muted">Mentor or Mentee</p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCategorySelection('non-institutional')}
                    className="glass-card glass-card-hover rounded-2xl p-6 text-left w-full"
                  >
                    <div className="flex items-center gap-4">
                      <div className="icon-container icon-container-teal">
                        <User className="w-5 h-5 text-teal-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">Non-Institutional</h3>
                        <p className="text-sm text-muted">Student or Professional</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {step === 1.5 && (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => handleRoleSelection(category === 'institutional' ? 'mentor' : 'student')}
                    className="glass-card glass-card-hover rounded-2xl p-6 text-left w-full"
                  >
                    <h3 className="text-white font-semibold text-lg">
                      {category === 'institutional' ? 'Mentor' : 'Student'}
                    </h3>
                    <p className="text-sm text-muted">
                      {category === 'institutional' ? 'For faculty and trainers' : 'For students preparing for interviews'}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRoleSelection(category === 'institutional' ? 'mentee' : 'professional')}
                    className="glass-card glass-card-hover rounded-2xl p-6 text-left w-full"
                  >
                    <h3 className="text-white font-semibold text-lg">
                      {category === 'institutional' ? 'Mentee' : 'Professional'}
                    </h3>
                    <p className="text-sm text-muted">
                      {category === 'institutional' ? 'For registered students' : 'For working professionals'}
                    </p>
                  </button>
                </div>
              )}

              {step === 2 && (
                <form onSubmit={handleInitialSubmit} className="space-y-4">
                  <p className="text-white font-medium mb-4">Login as {userType}</p>
                  
                  {userType === 'mentor' && (
                    <div className="space-y-2">
                      <Select
                        label="Select College"
                        value={college}
                        onChange={(e) => setCollege(e.target.value)}
                        options={colleges.map((c: any) => ({ value: c.collegeName, label: c.collegeName }))}
                        placeholder="Select your institution"
                      />
                      {college === 'other' && (
                        <Link href="/register-institution" className="text-sm text-amber-400 hover:text-amber-300">
                          Register your Institution
                        </Link>
                      )}
                    </div>
                  )}

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
                        label="Email ID"
                        type="email"
                        icon={<Mail className="w-4 h-4" />}
                        value={emailIdentifier}
                        onChange={(e) => setEmailIdentifier(e.target.value)}
                        placeholder="Enter your email"
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

              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-white font-medium mb-4 text-center">Verify Identity</p>
                  <p className="text-sm text-muted mb-6 text-center">
                    Enter the {isB2C ? '4' : '6'}-digit code sent to your {isB2C ? 'phone' : 'email'} (Simulated: {isB2C ? '1234' : '123456'}).
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
                        length={isB2C ? 4 : 6}
                        error={!!error}
                        disabled={isLockedOut}
                      />
                      <Button onClick={handleVerifyAndLogin} fullWidth disabled={otp.length !== (isB2C ? 4 : 6) || isLockedOut}>
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

              {step === 5 && (
                <div className="space-y-4">
                  <p className="text-white font-medium mb-4">Reset Password</p>
                  <Input
                    label="OTP Code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter OTP (1234)"
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
                  onClick={() => setStep(step === 1.5 ? 1 : step === 3 ? 2 : (step === 4 ? 2 : (step === 5 ? 4 : 1.5)))}
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