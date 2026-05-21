'use client';

import React, { useState, useEffect } from 'react';
import { GlassCard, CardTitle, CardDescription } from '@/app/components/ui/GlassCard';
import { Button } from '@/app/components/ui/Button';
import { Input, Select } from '@/app/components/ui/Input';
import { User, GraduationCap, Target, ChevronRight, Check } from 'lucide-react';
import { INTERESTS_TAXONOMY, MAIN_FIELDS } from '@/lib/taxonomy';

interface ProfileWizardProps {
  pendingFields: string[];
  onComplete: () => void;
}

export function ProfileWizard({ pendingFields, onComplete }: ProfileWizardProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Step 1: Username
  const [username, setUsername] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Step 2: Education
  const [education, setEducation] = useState({
    degree: '',
    course: '',
    currentMarks: ''
  });

  // Step 3: Interests
  const [mainField, setMainField] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  const steps = pendingFields.map(field => {
    if (field === 'username') return { id: 'username', title: 'Choose Username', description: 'Create a unique identity for your profile.' };
    if (field === 'education') return { id: 'education', title: 'Education Details', description: 'Tell us about your academic background.' };
    if (field === 'interests') return { id: 'interests', title: 'Your Interests', description: 'Select fields you want to practice and improve in.' };
    return { id: field, title: field, description: '' };
  });

  const currentStep = steps[step];

  // Real-time username validation
  useEffect(() => {
    if (currentStep?.id !== 'username' || !username || username.length < 3) {
      setUsernameError('');
      return;
    }

    const verifyUsername = async () => {
      setIsVerifying(true);
      try {
        const res = await fetch('/api/auth/username-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (data.exists) {
          setUsernameError('Username already taken');
        } else {
          setUsernameError('');
        }
      } catch (err) {
        console.error('Verify username error:', err);
      } finally {
        setIsVerifying(false);
      }
    };

    const timer = setTimeout(verifyUsername, 500);
    return () => clearTimeout(timer);
  }, [username, currentStep?.id]);

  const handleNext = async () => {
    setError('');
    setLoading(true);

    try {
      if (currentStep.id === 'username') {
        if (!username || usernameError) throw new Error('Valid username is required');
        const res = await fetch('/api/students/profile/username', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username })
        });
        if (!res.ok) throw new Error('Failed to update username');
      }

      if (currentStep.id === 'education') {
        if (!education.degree || !education.course || !education.currentMarks) throw new Error('All education fields are required');
        const res = await fetch('/api/students/profile/education', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(education)
        });
        if (!res.ok) throw new Error('Failed to update education');
      }

      if (currentStep.id === 'interests') {
        if (!mainField || selectedInterests.length < 3) throw new Error('Main field and at least 3 interests are required');
        
        const res = await fetch('/api/students/profile/interests', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mainField, interests: selectedInterests })
        });
        
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to update interests');
        }
      }

      if (step < steps.length - 1) {
        setStep(step + 1);
      } else {
        onComplete();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <GlassCard className="w-full max-w-lg shadow-2xl border-white/10" padding="lg">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-gradient-amber flex items-center justify-center text-black">
              {currentStep.id === 'username' && <User size={20} />}
              {currentStep.id === 'education' && <GraduationCap size={20} />}
              {currentStep.id === 'interests' && <Target size={20} />}
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                Step {step + 1} of {steps.length}
              </p>
              <CardTitle className="text-2xl">{currentStep.title}</CardTitle>
            </div>
          </div>
          <CardDescription>{currentStep.description}</CardDescription>
        </div>

        <div className="space-y-6">
          {currentStep.id === 'username' && (
            <Input
              label="Username"
              placeholder="e.g. jdoe_2024"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              error={usernameError}
              icon={<User size={18} />}
              disabled={loading}
            />
          )}

          {currentStep.id === 'education' && (
            <div className="space-y-4">
              <Select
                label="Degree"
                placeholder="Select your degree"
                value={education.degree}
                onChange={(e) => setEducation({ ...education, degree: e.target.value })}
                options={[
                  { value: 'B.Tech', label: 'Bachelor of Technology' },
                  { value: 'M.Tech', label: 'Master of Technology' },
                  { value: 'BCA', label: 'BCA' },
                  { value: 'MCA', label: 'MCA' },
                  { value: 'B.Sc', label: 'B.Sc' },
                  { value: 'M.Sc', label: 'M.Sc' },
                  { value: 'Other', label: 'Other' }
                ]}
                disabled={loading}
              />
              <Input
                label="Course/Major"
                placeholder="e.g. Computer Science"
                value={education.course}
                onChange={(e) => setEducation({ ...education, course: e.target.value })}
                disabled={loading}
              />
              <Input
                label="Current Marks (CGPA/Percentage)"
                placeholder="e.g. 8.5 or 85%"
                value={education.currentMarks}
                onChange={(e) => setEducation({ ...education, currentMarks: e.target.value })}
                disabled={loading}
              />
            </div>
          )}

          {currentStep.id === 'interests' && (
            <div className="space-y-4">
              <Select
                label="Main Field of Study"
                placeholder="Select main field"
                value={mainField}
                onChange={(e) => {
                  setMainField(e.target.value);
                  setSelectedInterests([]);
                }}
                options={MAIN_FIELDS.map(f => ({ value: f, label: f }))}
                disabled={loading}
              />
              
              {mainField && (
                <div>
                  <label className="block text-sm font-medium text-muted mb-2">
                    Interests (Select Min 3)
                  </label>
                  <div className="flex flex-wrap gap-2 min-h-[40px] p-4 rounded-2xl bg-white/5 border border-white/10">
                    {(INTERESTS_TAXONOMY[mainField] || []).map(interest => (
                      <span 
                        key={interest}
                        onClick={() => toggleInterest(interest)}
                        className={`px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-all flex items-center gap-1.5
                          ${selectedInterests.includes(interest)
                            ? 'bg-amber-400/10 border-amber-400/40 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                            : 'bg-white/5 border-white/5 text-muted hover:border-white/20 hover:bg-white/10'
                          }
                        `}
                      >
                        {interest}
                        {selectedInterests.includes(interest) && <Check size={14} />}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-400 bg-red-400/10 p-3 rounded-lg">{error}</p>}

          <Button 
            fullWidth 
            onClick={handleNext} 
            disabled={loading || isVerifying || (currentStep.id === 'username' && !!usernameError)}
            icon={<ChevronRight size={18} />}
          >
            {loading ? 'Saving...' : step < steps.length - 1 ? 'Continue' : 'Complete Profile'}
          </Button>
        </div>
      </GlassCard>
    </div>
  );
}
