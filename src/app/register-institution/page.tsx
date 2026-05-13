'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Webcam from 'react-webcam';
import { Container, GlassCard, Button, Input, Select, Header, AmbientGlow, OtpInput } from '../components/ui';
import { ArrowLeft, ArrowRight, Mail, Phone, User, Building, Upload, Camera, CheckCircle, FileText } from 'lucide-react';

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

export default function RegisterInstitution() {
  const router = useRouter();
  const webcamRef = useRef<Webcam>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const aadhaarInputRef = useRef<HTMLInputElement>(null);

  const [stage, setStep] = useState(1);
  const [subStep, setSubStep] = useState(1);
  
  const [formData, setFormData] = useState({
    mentorEmail: '',
    mentorPhone: '',
    mentorName: '',
    password: '',
    mentorDob: '',
    mentorGender: '',
    collegeName: '',
    collegeLocation: '',
    documentType: '',
    otherDocumentType: '',
    documentName: '',
    aadhaarNumber: '',
    aadhaarPicName: '',
    selfieName: '',
    consent: false
  });

  const [countryCode, setCountryCode] = useState('+91');
  const [otp, setOtp] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [capturedSelfie, setCapturedSelfie] = useState<string | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendTimer > 0) {
      interval = setInterval(() => setResendTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const getFileExtension = (filename: string) => {
    return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
  };

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setCapturedSelfie(imageSrc);
      setFormData(prev => ({ ...prev, selfieName: 'mentor_selfie.jpg' }));
    }
  }, [webcamRef]);

  const sendOtp = async (identifier: string, isPhone: boolean = false) => {
    setError('');
    if (isPhone) {
      if (formData.mentorPhone.length !== 10) {
        setError('Phone number must be exactly 10 digits.');
        return false;
      }
    }
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, role: 'mentor' }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setResendTimer(60);
        return true;
      } else { setError(data.error); return false; }
    } catch (err) { setError('Failed to send OTP'); return false; }
  };

  const verifyOtp = async (identifier: string, nextSubStep: number) => {
    setError('');
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, otp, role: 'mentor' }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubStep(nextSubStep);
        setOtp('');
        setMessage('');
      } else { setError(data.error); }
    } catch (err) { setError('Verification failed'); }
  };

  const handleFinalSubmit = async () => {
    setError('');
    if (!formData.aadhaarNumber || !formData.aadhaarPicName || !formData.selfieName) {
      setError('Please provide your Aadhaar details and capture a selfie.');
      return;
    }
    if (!formData.consent) { setError('You must provide consent.'); return; }
    
    setMessage('Submitting application...');
    try {
      const res = await fetch('/api/institution/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          mentorPhone: countryCode + formData.mentorPhone,
          documentType: formData.documentType === 'other' ? formData.otherDocumentType : formData.documentType
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('Application submitted successfully! Redirecting...');
        setTimeout(() => router.push('/login'), 2000);
      } else { setError(data.error); }
    } catch (err) { setError('Submission failed'); }
  };

  const renderProgress = () => (
    <div className="flex items-center justify-center gap-2 mb-8">
      {[1, 2, 3].map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
            stage >= s ? 'bg-amber-500 text-black' : 'glass-card text-white/60'
          }`}>
            {s}
          </div>
          {s < 3 && <div className={`w-8 h-px ${stage > s ? 'bg-amber-500' : 'bg-white/20'}`} />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-grid">
      <AmbientGlow color="amber" size="lg" position="top-left" className="z-0" />
      <AmbientGlow color="teal" size="md" position="bottom-right" className="z-0" />
      
      <Header />
      
      <main className="pt-28 pb-12">
        <Container>
          <div className="max-w-xl mx-auto">
            <GlassCard padding="lg" className="text-center mb-8">
              <h1 className="text-2xl font-bold text-white mb-2">Institution Registration</h1>
              <p className="text-muted">Register your institution to become a mentor</p>
            </GlassCard>

            {renderProgress()}

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

              {stage === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="icon-container icon-container-amber">
                      <User className="w-5 h-5 text-amber-400" />
                    </div>
                    <h2 className="text-white font-semibold text-lg">Stage 1: Mentor Personal Details</h2>
                  </div>
                  
                  {subStep === 1 && (
                    <div className="space-y-4">
                      <Input
                        label="Official Email ID"
                        type="email"
                        value={formData.mentorEmail}
                        onChange={e => setFormData({...formData, mentorEmail: e.target.value})}
                        placeholder="your@institution.com"
                      />
                      <Button 
                        onClick={async () => { 
                          const success = await sendOtp(formData.mentorEmail); 
                          if (success) setSubStep(2); 
                        }} 
                        fullWidth 
                        icon={<Mail className="w-4 h-4" />}
                      >
                        Verify Email
                      </Button>
                    </div>
                  )}

                  {subStep === 2 && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted mb-4 text-center">
                        Verify: {formData.mentorEmail} (Simulated: 123456)
                      </p>
                      <OtpInput
                        value={otp}
                        onChange={setOtp}
                        length={6}
                      />
                      <Button 
                        onClick={() => verifyOtp(formData.mentorEmail, 3)} 
                        fullWidth
                        disabled={otp.length !== 6}
                      >
                        Verify & Continue
                      </Button>
                    </div>
                  )}

                  {subStep === 3 && (
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
                            value={formData.mentorPhone}
                            onChange={e => {
                              const value = e.target.value.replace(/\D/g, ''); // Remove non-numeric characters
                              setFormData({...formData, mentorPhone: value});
                            }}
                            className="glass-input flex-1"
                            maxLength={10}
                            required
                          />
                        </div>
                      </div>
                      <Button 
                        onClick={async () => { 
                          const success = await sendOtp(countryCode + formData.mentorPhone, true); 
                          if (success) setSubStep(4); 
                        }} 
                        fullWidth 
                        icon={<Phone className="w-4 h-4" />}
                      >
                        Verify Phone
                      </Button>
                    </div>
                  )}

                  {subStep === 4 && (
                    <div className="space-y-4">
                      <p className="text-sm text-muted mb-4 text-center">
                        Verify: {countryCode + formData.mentorPhone} (Simulated: 123456)
                      </p>
                      <OtpInput
                        value={otp}
                        onChange={setOtp}
                        length={6}
                      />
                      <Button 
                        onClick={() => verifyOtp(countryCode + formData.mentorPhone, 5)} 
                        fullWidth
                        disabled={otp.length !== 6}
                      >
                        Verify & Continue
                      </Button>
                    </div>
                  )}

                  {subStep === 5 && (
                    <div className="space-y-4">
                      <Input
                        label="Mentor Full Name"
                        value={formData.mentorName}
                        onChange={e => setFormData({...formData, mentorName: e.target.value})}
                        placeholder="Your full name"
                      />
                      <Input
                        label="Set Password"
                        type="password"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                        placeholder="Create a password"
                      />
                      <Input
                        label="Date of Birth"
                        type="date"
                        value={formData.mentorDob}
                        onChange={e => setFormData({...formData, mentorDob: e.target.value})}
                      />
                      <Select
                        label="Gender"
                        value={formData.mentorGender}
                        onChange={e => setFormData({...formData, mentorGender: e.target.value})}
                        options={[
                          { value: 'male', label: 'Male' },
                          { value: 'female', label: 'Female' },
                          { value: 'other', label: 'Other' },
                        ]}
                        placeholder="Select gender"
                      />
                      <Button 
                        onClick={() => {
                          setError('');
                          if (!formData.mentorName || !formData.password || !formData.mentorDob || !formData.mentorGender) {
                            setError('Please fill in all required fields.');
                            return;
                          }
                          const age = calculateAge(formData.mentorDob);
                          if (age < 20) {
                            setError('Mentors must be at least 20 years old.');
                            return;
                          }
                          if (age > 150) {
                            setError('Please enter a valid Date of Birth.');
                            return;
                          }
                          setStep(2);
                        }} 
                        fullWidth 
                        icon={<ArrowRight className="w-4 h-4" />}
                      >
                        Next: College Details
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {stage === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="icon-container icon-container-teal">
                      <Building className="w-5 h-5 text-teal-400" />
                    </div>
                    <h2 className="text-white font-semibold text-lg">Stage 2: College Details</h2>
                  </div>
                  
                  <Input
                    label="College Name"
                    value={formData.collegeName}
                    onChange={e => setFormData({...formData, collegeName: e.target.value})}
                    placeholder="Your institution name"
                  />
                  
                  <div className="w-full">
                    <label className="block text-sm font-medium text-muted mb-2">College Location / Address</label>
                    <textarea
                      className="glass-input min-h-[100px] resize-y"
                      value={formData.collegeLocation}
                      onChange={e => setFormData({...formData, collegeLocation: e.target.value})}
                      placeholder="Full address"
                    />
                  </div>
                  
                  <Select
                    label="Proof of College Existence"
                    value={formData.documentType}
                    onChange={e => setFormData({...formData, documentType: e.target.value})}
                    options={[
                      { value: 'certificate', label: 'Certificate of Incorporation' },
                      { value: 'affiliation', label: 'Affiliation Letter' },
                      { value: 'other', label: 'Other' },
                    ]}
                    placeholder="Select document type"
                  />

                  {formData.documentType === 'other' && (
                    <Input
                      placeholder="Document name"
                      value={formData.otherDocumentType}
                      onChange={e => setFormData({...formData, otherDocumentType: e.target.value})}
                    />
                  )}

                  <div 
                    className="glass-input cursor-pointer flex items-center gap-3 p-4"
                    onClick={() => documentInputRef.current?.click()}
                  >
                    {formData.documentName ? (
                      <>
                        <FileText className="w-5 h-5 text-teal-400" />
                        <span className="text-white/80 text-sm truncate">{formData.documentName}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-white/40" />
                        <span className="text-white/60 text-sm">Upload Document</span>
                      </>
                    )}
                    <input 
                      ref={documentInputRef}
                      type="file" 
                      accept=".pdf"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const type = formData.documentType === 'other' ? formData.otherDocumentType : formData.documentType;
                          const ext = getFileExtension(file.name);
                          setFormData({...formData, documentName: `${type || 'document'}.${ext}`});
                        }
                      }} 
                    />
                  </div>

                  <div className="flex gap-4">
                    <Button variant="ghost" onClick={() => setStep(1)} fullWidth icon={<ArrowLeft className="w-4 h-4" />}>
                      Back
                    </Button>
                    <Button 
                      onClick={() => {
                        setError('');
                        if (!formData.collegeName || !formData.collegeLocation || !formData.documentType || !formData.documentName) {
                          setError('Please fill in all required college details and upload proof.');
                          return;
                        }
                        if (formData.documentType === 'other' && !formData.otherDocumentType) {
                          setError('Please specify the document type.');
                          return;
                        }
                        setStep(3);
                      }} 
                      fullWidth 
                      icon={<ArrowRight className="w-4 h-4" />}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}

              {stage === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="icon-container icon-container-purple">
                      <Camera className="w-5 h-5 text-purple-400" />
                    </div>
                    <h2 className="text-white font-semibold text-lg">Stage 3: Identity & Consent</h2>
                  </div>
                  
                  <Input
                    label="Aadhaar Card Number"
                    value={formData.aadhaarNumber}
                    onChange={e => setFormData({...formData, aadhaarNumber: e.target.value})}
                    placeholder="XXXX-XXXX-XXXX"
                  />
                  
                  <div 
                    className="glass-input cursor-pointer flex items-center gap-3 p-4"
                    onClick={() => aadhaarInputRef.current?.click()}
                  >
                    {formData.aadhaarPicName ? (
                      <>
                        <FileText className="w-5 h-5 text-purple-400" />
                        <span className="text-white/80 text-sm truncate">{formData.aadhaarPicName}</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 text-white/40" />
                        <span className="text-white/60 text-sm">Upload Aadhaar Card</span>
                      </>
                    )}
                    <input 
                      ref={aadhaarInputRef}
                      type="file" 
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="hidden"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const ext = getFileExtension(file.name);
                          setFormData({...formData, aadhaarPicName: `aadhaar.${ext}`});
                        }
                      }} 
                    />
                  </div>

                  <div className="glass-card rounded-xl p-4">
                    <label className="block text-sm font-medium text-muted mb-3">Live Selfie Capture</label>
                    {!capturedSelfie ? (
                      <div className="space-y-3">
                        <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" className="w-full rounded-lg" />
                        <Button onClick={capture} fullWidth icon={<Camera className="w-4 h-4" />}>
                          Capture Selfie
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <img src={capturedSelfie} alt="selfie" className="w-full rounded-lg" />
                        <Button variant="ghost" onClick={() => setCapturedSelfie(null)} fullWidth>
                          Retake
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5">
                    <input 
                      type="checkbox" 
                      checked={formData.consent} 
                      onChange={e => setFormData({...formData, consent: e.target.checked})}
                      className="mt-1"
                    />
                    <label className="text-sm text-muted">
                      I hereby declare that all the information provided above is correct, true, and not fake. I understand that any false information may lead to rejection or legal action.
                    </label>
                  </div>

                  <div className="flex gap-4">
                    <Button variant="ghost" onClick={() => setStep(2)} fullWidth icon={<ArrowLeft className="w-4 h-4" />}>
                      Back
                    </Button>
                    <Button onClick={handleFinalSubmit} fullWidth icon={<CheckCircle className="w-4 h-4" />}>
                      Submit Registration
                    </Button>
                  </div>
                </div>
              )}
            </GlassCard>

            <p className="text-center text-sm text-muted mt-6">
              <Link href="/login" className="text-white/60 hover:text-white transition-colors">
                Back to Login
              </Link>
            </p>
          </div>
        </Container>
      </main>
    </div>
  );
}