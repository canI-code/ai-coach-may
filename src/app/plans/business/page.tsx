'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Container, GlassCard, Button, Input, Select, Header, AmbientGlow } from '@/app/components/ui';
import { 
  Building2, ArrowRight, Check, Upload, User, Mail, Phone, MapPin, 
  Camera, Globe, ShieldCheck, RefreshCw, AlertTriangle, FileText
} from 'lucide-react';

export default function BusinessPurchase() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [form, setForm] = useState({
    collegeName: '',
    location: '',
    websiteUrl: '',
    representativeName: '',
    representativeEmail: '',
    representativePhone: '',
    documentType: 'Incorporation Certificate',
    documentName: '',
    documentBase64: '',
    aadhaarNumber: '', // document number
    aadhaarBase64: '', // optional secondary ID
    aadhaarPicName: '',
    selfieBase64: '',
    consent: false,
  });

  const [countryCode, setCountryCode] = useState('+91');
  
  // Camera state
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const updateField = (field: string, value: any) => setForm({ ...form, [field]: value });

  useEffect(() => {
    if (step === 3 && typeof window !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [step]);

  const startCamera = async () => {
    setError('');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 300 } });
      setStream(mediaStream);
      setCameraActive(true);
      
      // Allow DOM to update first
      setTimeout(() => {
        const videoElement = document.getElementById('webcam') as HTMLVideoElement;
        if (videoElement) {
          videoElement.srcObject = mediaStream;
        }
      }, 100);
    } catch (err) {
      console.warn('Error accessing webcam, falling back to upload:', err);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    const video = document.getElementById('webcam') as HTMLVideoElement;
    const canvas = document.createElement('canvas');
    if (video) {
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, 400, 300);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedPhoto(dataUrl);
        updateField('selfieBase64', dataUrl);
        stopCamera();
      }
    }
  };

  const retakePhoto = () => {
    setCapturedPhoto(null);
    updateField('selfieBase64', '');
    startCamera();
  };

  const handleLivePicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCapturedPhoto(reader.result as string);
      updateField('selfieBase64', reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'documentBase64' | 'aadhaarBase64', nameField: 'documentName' | 'aadhaarPicName') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setForm(prev => ({
        ...prev,
        [fieldName]: reader.result as string,
        [nameField]: file.name
      }));
    };
    reader.readAsDataURL(file);
  };

  const validateStep1 = () => {
    setError('');
    if (!form.representativeName.trim()) {
      setError('Representative name is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.representativeEmail)) {
      setError('Please enter a valid representative email address');
      return false;
    }
    if (form.representativePhone.length !== 10) {
      setError('Phone number must be exactly 10 digits');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    setError('');
    if (!form.collegeName.trim()) {
      setError('Institution / College Name is required');
      return false;
    }
    if (!form.location.trim()) {
      setError('Location is required');
      return false;
    }
    if (!form.aadhaarNumber.trim()) {
      setError('Document / Registration Number is required');
      return false;
    }
    if (!form.documentBase64) {
      setError('Please upload proof of institution existence');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    setError('');
    if (!form.selfieBase64) {
      setError('Please capture a live photo for verification');
      return false;
    }
    if (!form.consent) {
      setError('You must consent to proceed');
      return false;
    }
    return true;
  };

  const nextStep = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const prevStep = () => {
    if (step === 3) {
      stopCamera();
      setCapturedPhoto(null);
    }
    setStep(prev => prev - 1);
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    setLoading(true);
    try {
      const res = await fetch('/api/b2b/institution/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          representativePhone: countryCode + form.representativePhone,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(data.error || 'Submission failed');
      }
    } catch {
      setError('An error occurred during request submission.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-grid">
        <AmbientGlow color="purple" size="lg" position="top-left" className="z-0" />
        <Header />
        <main className="pt-28 pb-12">
          <Container>
            <div className="max-w-md mx-auto text-center">
              <GlassCard padding="lg">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-3">Request Submitted!</h1>
                <p className="text-muted mb-6">
                  Thank you for your interest. Our admin team will verify your documents and contact you
                  within 24-48 hours. The approval process may take up to 1 week to complete.
                </p>
                <Button onClick={() => router.push('/')} icon={<ArrowRight className="w-4 h-4" />}>
                  Back to Home
                </Button>
              </GlassCard>
            </div>
          </Container>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-grid">
      <AmbientGlow color="purple" size="lg" position="top-left" className="z-0" />
      <AmbientGlow color="amber" size="md" position="bottom-right" className="z-0" />
      <Header />

      <main className="pt-28 pb-12">
        <Container>
          <div className="max-w-lg mx-auto">
            <GlassCard padding="lg" className="text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Building2 className="w-6 h-6 text-purple-400" />
                <h1 className="text-2xl font-bold text-white">Business Purchase</h1>
              </div>
              <p className="text-muted">Register your institution for bulk access</p>
            </GlassCard>

            <GlassCard padding="lg">
              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Step Indicators */}
              <div className="flex items-center justify-center gap-2 mb-8">
                {[1, 2, 3].map((s) => (
                  <div key={s} className={`flex items-center gap-2 ${s <= step ? 'text-purple-400' : 'text-[#a1a1aa]'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${s <= step ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-white/5 border border-white/10'}`}>
                      {s < step ? <Check className="w-4 h-4" /> : s}
                    </div>
                    <span className="text-xs hidden sm:block">
                      {s === 1 ? 'Representative' : s === 2 ? 'Institution' : 'Verification'}
                    </span>
                    {s < 3 && <div className={`w-8 h-0.5 ${s < step ? 'bg-purple-400' : 'bg-white/10'}`} />}
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                {/* Step 1: Representative details */}
                {step === 1 && (
                  <>
                    <Input
                      label="Representative Name *"
                      icon={<User className="w-4 h-4" />}
                      value={form.representativeName}
                      onChange={(e) => updateField('representativeName', e.target.value)}
                      placeholder="Dr. Rajesh Sharma"
                      required
                    />
                    <Input
                      label="Email Address *"
                      icon={<Mail className="w-4 h-4" />}
                      type="email"
                      value={form.representativeEmail}
                      onChange={(e) => updateField('representativeEmail', e.target.value)}
                      placeholder="representative@college.edu"
                      required
                    />
                    <div>
                      <label className="block text-sm font-medium text-muted mb-2">Phone Number *</label>
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
                          value={form.representativePhone}
                          onChange={(e) => updateField('representativePhone', e.target.value.replace(/\D/g, ''))}
                          className="glass-input flex-1"
                          maxLength={10}
                        />
                      </div>
                    </div>
                    <div className="pt-2">
                      <Button onClick={nextStep} fullWidth icon={<ArrowRight className="w-4 h-4" />}>
                        Next: Institution Details
                      </Button>
                    </div>
                  </>
                )}

                {/* Step 2: Institution details */}
                {step === 2 && (
                  <>
                    <Input
                      label="Institution / College Name *"
                      icon={<Building2 className="w-4 h-4" />}
                      value={form.collegeName}
                      onChange={(e) => updateField('collegeName', e.target.value)}
                      placeholder="IIT Delhi"
                      required
                    />
                    <Input
                      label="Location *"
                      icon={<MapPin className="w-4 h-4" />}
                      value={form.location}
                      onChange={(e) => updateField('location', e.target.value)}
                      placeholder="New Delhi, India"
                      required
                    />
                    <Input
                      label="Institute Website URL (Optional)"
                      icon={<Globe className="w-4 h-4" />}
                      value={form.websiteUrl}
                      onChange={(e) => updateField('websiteUrl', e.target.value)}
                      placeholder="www.college.edu.in"
                    />
                    <Select
                      label="Verification Document Type *"
                      value={form.documentType}
                      onChange={(e) => updateField('documentType', e.target.value)}
                      options={[
                        { value: 'Incorporation Certificate', label: 'Incorporation / AICTE Certificate' },
                        { value: 'Govt Registration Document', label: 'Govt Registration Document' },
                        { value: 'Tax Identification Document', label: 'Tax Identification Document' },
                        { value: 'Aadhaar ID Card', label: 'Representative ID (Aadhaar Card)' },
                      ]}
                    />
                    <Input
                      label="Document / Registration Number *"
                      value={form.aadhaarNumber}
                      onChange={(e) => updateField('aadhaarNumber', e.target.value)}
                      placeholder="Document Number (e.g. AICTE-XX-12345)"
                      required
                    />
                    
                    {/* Document Upload */}
                    <div>
                      <label className="block text-sm font-medium text-muted mb-2">Upload Proof of Existence Document *</label>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center justify-center px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white hover:bg-white/10 transition-colors cursor-pointer font-semibold">
                          <Upload className="w-4 h-4 mr-2 text-purple-400" />
                          Choose File
                          <input 
                            type="file" 
                            accept=".pdf,image/*" 
                            onChange={(e) => handleFileUpload(e, 'documentBase64', 'documentName')} 
                            className="hidden" 
                          />
                        </label>
                        <span className="text-xs text-muted truncate max-w-xs">
                          {form.documentName || 'No file chosen (PDF or Image)'}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button variant="ghost" onClick={prevStep} fullWidth>Back</Button>
                      <Button onClick={nextStep} fullWidth icon={<ArrowRight className="w-4 h-4" />}>
                        Next: Verification & Consent
                      </Button>
                    </div>
                  </>
                )}

                {/* Step 3: Verification & Consent */}
                {step === 3 && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-muted mb-2">Live Verification Selfie *</label>
                        <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-white/10 bg-black/40 flex flex-col items-center justify-center">
                          {cameraActive && !capturedPhoto ? (
                            <>
                              <video id="webcam" autoPlay playsInline className="w-full h-full object-cover" />
                              <div className="absolute bottom-4 inset-x-0 flex justify-center">
                                <Button 
                                  onClick={capturePhoto} 
                                  className="bg-purple-600 hover:bg-purple-700 text-white shadow-lg" 
                                  size="sm" 
                                  icon={<Camera className="w-4 h-4" />}
                                >
                                  Capture Photo
                                </Button>
                              </div>
                            </>
                          ) : capturedPhoto ? (
                            <>
                              <img src={capturedPhoto} alt="Captured Live Selfie" className="w-full h-full object-cover" />
                              <div className="absolute bottom-4 inset-x-0 flex justify-center gap-2">
                                <Button onClick={retakePhoto} variant="secondary" size="sm" icon={<RefreshCw className="w-4 h-4" />}>
                                  Retake
                                </Button>
                              </div>
                            </>
                          ) : (
                            <div className="p-6 text-center space-y-4">
                              <Camera className="w-12 h-12 text-muted mx-auto animate-pulse" />
                              <p className="text-sm text-muted">Webcam inactive or not supported. You can upload a selfie directly.</p>
                              <label className="inline-flex items-center justify-center px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-white hover:bg-white/10 transition-colors cursor-pointer font-semibold">
                                <Upload className="w-4 h-4 mr-2 text-purple-400" />
                                Upload Selfie
                                <input type="file" accept="image/*" onChange={handleLivePicUpload} className="hidden" />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Consent & Warnings */}
                      <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10 text-xs text-muted space-y-2">
                        <div className="flex gap-2 text-purple-400 font-semibold mb-1">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Verification Notice</span>
                        </div>
                        <p>
                          Our administration team manually reviews all B2B requests. We will cross-reference your representative credentials, college details, and submitted document.
                        </p>
                        <p className="text-purple-300 font-medium">
                          ⚠️ Notice: Document verification and activation approval may take up to 1 week.
                        </p>
                      </div>

                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={form.consent}
                          onChange={(e) => updateField('consent', e.target.checked)}
                          className="mt-1 w-4 h-4 rounded border-white/10 bg-white/5 text-purple-500 focus:ring-0 cursor-pointer"
                        />
                        <span className="text-xs text-muted">
                          I agree to submit these details for B2B verification. I certify that I am an authorized representative of the institution and the provided information is true. *
                        </span>
                      </label>
                    </div>

                    <div className="flex gap-3 pt-2">
                      <Button variant="ghost" onClick={prevStep} fullWidth>Back</Button>
                      <Button onClick={handleSubmit} fullWidth disabled={loading} icon={<ArrowRight className="w-4 h-4" />}>
                        {loading ? 'Submitting Request...' : 'Submit Request'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </GlassCard>
          </div>
        </Container>
      </main>
    </div>
  );
}
