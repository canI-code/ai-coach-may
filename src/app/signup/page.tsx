'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Container, GlassCard, Button, Input, Select, Header, AmbientGlow, OtpInput } from '../components/ui';
import { ArrowLeft, ArrowRight, User, School, Mail, Phone, Calendar } from 'lucide-react';

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

export default function Signup() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [category, setCategory] = useState('');
  const [userType, setUserType] = useState('');
  
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [emailIdentifier, setEmailIdentifier] = useState('');
  
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  
  const [details, setDetails] = useState({ fullName: '', dob: '', gender: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);

  const [colleges, setColleges] = useState([]);
  const [selectedCollege, setSelectedCollege] = useState('');

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

  const handleCategorySelection = (cat: string) => {
    setCategory(cat);
    setStep(1.5);
  };

  const handleRoleSelection = (role: string) => {
    setUserType(role);
    if (role === 'mentor') {
      router.push('/register-institution');
    } else if (role === 'mentee') {
      setStep(2.5);
    } else {
      setStep(3);
    }
  };

  const handleMenteeSubmit = async () => {
    setError('');
    
    if (!selectedCollege || !details.fullName || !emailIdentifier || !phoneNumber || !details.gender || !details.dob) {
      setError('Please fill in all required fields.');
      return;
    }
    if (phoneNumber.length !== 10) {
      setError('Phone number must be exactly 10 digits.');
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

    setMessage('Submitting request...');
    try {
      const payload = {
        collegeName: selectedCollege,
        fullName: details.fullName,
        email: emailIdentifier,
        phone: countryCode + phoneNumber,
        gender: details.gender,
        dob: details.dob,
      };

      const res = await fetch('/api/auth/mentee-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Request submitted successfully! Waiting for mentor approval.');
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to submit request.');
    }
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
        setStep(4);
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
      const payload: any = {
        accountType: category === 'institutional' ? 'institution' : 'personal',
        role: userType,
        fullName: details.fullName,
        dob: details.dob
      };

      if (userType === 'student' || userType === 'professional') {
        payload.phone = countryCode + phoneNumber;
      } else {
        payload.email = emailIdentifier;
        payload.password = 'simulated_b2b_pass';
      }

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
      setError('Final registration failed.');
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

              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-white font-medium mb-4">I am a...</p>
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
                        <h3 className="text-white font-semibold">Institutional User</h3>
                        <p className="text-sm text-muted">Colleges/Training Centers</p>
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
                        <h3 className="text-white font-semibold">Individual User</h3>
                        <p className="text-sm text-muted">Student or Professional</p>
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {step === 1.5 && (
                <div className="space-y-4">
                  <p className="text-white font-medium mb-4">I want to...</p>
                  {category === 'institutional' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRoleSelection('mentor')}
                        className="glass-card glass-card-hover rounded-2xl p-6 text-left w-full"
                      >
                        <h3 className="text-white font-semibold text-lg">Register as Mentor</h3>
                        <p className="text-sm text-muted">Faculty or trainer at an institution</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRoleSelection('mentee')}
                        className="glass-card glass-card-hover rounded-2xl p-6 text-left w-full"
                      >
                        <h3 className="text-white font-semibold text-lg">Request as Mentee</h3>
                        <p className="text-sm text-muted">Student needing mentor approval</p>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => handleRoleSelection('student')}
                        className="glass-card glass-card-hover rounded-2xl p-6 text-left w-full"
                      >
                        <h3 className="text-white font-semibold text-lg">Practice as Student</h3>
                        <p className="text-sm text-muted">Preparing for college/placements</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRoleSelection('professional')}
                        className="glass-card glass-card-hover rounded-2xl p-6 text-left w-full"
                      >
                        <h3 className="text-white font-semibold text-lg">Practice as Professional</h3>
                        <p className="text-sm text-muted">Preparing for job interviews</p>
                      </button>
                    </>
                  )}
                </div>
              )}

              {step === 2.5 && (
                <div className="space-y-4">
                  <p className="text-white font-medium mb-4">Request Mentee Access</p>
                  
                  <Select
                    label="Select College"
                    value={selectedCollege}
                    onChange={(e) => setSelectedCollege(e.target.value)}
                    options={colleges.map((c: any) => ({ value: c.collegeName, label: c.collegeName }))}
                    placeholder="Choose your institution"
                  />
                  
                  <Input
                    label="Full Name"
                    value={details.fullName}
                    onChange={(e) => setDetails({ ...details, fullName: e.target.value })}
                    placeholder="Your full name"
                  />
                  
                  <Input
                    label="Email"
                    type="email"
                    value={emailIdentifier}
                    onChange={(e) => setEmailIdentifier(e.target.value)}
                    placeholder="your@email.com"
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
                  
                  <Select
                    label="Gender"
                    value={details.gender}
                    onChange={(e) => setDetails({ ...details, gender: e.target.value })}
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
                    value={details.dob}
                    onChange={(e) => setDetails({ ...details, dob: e.target.value })}
                  />
                  
                  <Button onClick={handleMenteeSubmit} fullWidth icon={<ArrowRight className="w-4 h-4" />}>
                    Submit Request
                  </Button>
                </div>
              )}

              {step === 3 && (
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
                        Enter the 4-digit code sent to your phone (Simulated: 1234)
                      </p>
                      {attemptsRemaining < 5 && (
                        <p className="text-amber-400 text-sm text-center">
                          {attemptsRemaining} attempt{attemptsRemaining > 1 ? 's' : ''} remaining before lockout
                        </p>
                      )}
                      <OtpInput
                        value={otp}
                        onChange={setOtp}
                        length={4}
                        error={!!error}
                      />
                      <Button onClick={handleVerifyOtp} fullWidth disabled={otp.length !== 4}>
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

              {step === 4 && (
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
                  onClick={() => setStep(step === 1.5 ? 1 : (step === 3 ? 1.5 : (step === 4 ? 3 : 1)))}
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