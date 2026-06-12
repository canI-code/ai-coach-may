'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Header, Container, Section, SectionHeader, FeatureCard, AmbientGlow, Button } from './components/ui';
import { 
  Mic, 
  Video, 
  Brain, 
  Users, 
  TrendingUp, 
  Shield,
  ArrowRight,
  CheckCircle
} from 'lucide-react';

export default function Home() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/status');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setIsLoggedIn(true);
            setUserRole(data.user.role);
          }
        }
      } catch (err) {
        console.error('Home Auth Error:', err);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const getDashboardLink = () => {
    if (userRole === 'admin') return '/admin';
    if (userRole === 'superadmin') return '/superadmin';
    if (userRole === 'institution') return '/dashboard/b2b/institution';
    if (userRole === 'mentor') return '/dashboard/b2b/mentor';
    if (userRole === 'mentee') return '/dashboard/b2b';
    return '/dashboard/b2c';
  };

  return (
    <div className="min-h-screen bg-grid">
      <AmbientGlow color="amber" size="xl" position="top-left" className="z-0" />
      <AmbientGlow color="teal" size="lg" position="bottom-right" className="z-0" />
      
      <Header />

      <main>
        <Section className="pt-28 pb-20">
          <Container>
            <div className="text-center max-w-4xl mx-auto">
              <p className="section-eyebrow text-amber-400 mb-4 animate-fade-in-up opacity-0">
                AI-Powered Interview Preparation
              </p>
              <h1 
                className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 animate-fade-in-up opacity-0 animate-delay-100"
                style={{ color: 'white' }}
              >
                Master Your Interview with{' '}
                <span className="text-gradient-amber">AI Coaching</span>
              </h1>
              <p 
                className="text-lg md:text-xl text-muted mb-8 max-w-2xl mx-auto animate-fade-in-up opacity-0 animate-delay-200"
              >
                Practice with intelligent AI interviewers that analyze your voice, 
                video, and responses to give you real-time feedback.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up opacity-0 animate-delay-300">
                {loading ? (
                  <div className="w-40 h-12 bg-white/5 animate-pulse rounded-xl" />
                ) : isLoggedIn ? (
                  <Link href={getDashboardLink()}>
                    <Button size="lg" icon={<ArrowRight className="w-5 h-5" />}>
                      Go to Dashboard
                    </Button>
                  </Link>
                ) : (
                  <>
                    <Link href="/signup">
                      <Button size="lg" icon={<ArrowRight className="w-5 h-5" />}>
                        Start Free Trial
                      </Button>
                    </Link>
                    <Link href="/features">
                      <Button variant="ghost" size="lg">
                        See Features
                      </Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </Container>
        </Section>

        <Section className="py-12">
          <Container>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <FeatureCard
                icon={<Mic className="w-5 h-5" />}
                iconColor="amber"
                title="Voice Analysis"
                description="Advanced speech recognition to evaluate clarity, pace, and confidence in your answers."
              />
              <FeatureCard
                icon={<Video className="w-5 h-5" />}
                iconColor="teal"
                title="Video Practice"
                description="Record yourself answering questions and get AI feedback on body language."
              />
              <FeatureCard
                icon={<Brain className="w-5 h-5" />}
                iconColor="purple"
                title="Smart Questions"
                description="AI generates personalized questions based on your target role and industry."
              />
              <FeatureCard
                icon={<TrendingUp className="w-5 h-5" />}
                iconColor="emerald"
                title="Progress Tracking"
                description="Monitor your improvement over time with detailed analytics and insights."
              />
            </div>
          </Container>
        </Section>

        <Section className="py-16">
          <Container>
            <div className="glass-card rounded-2xl p-8 md:p-12">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                    Ready to Land Your Dream Job?
                  </h2>
                  <p className="text-muted mb-6">
                    Join thousands of candidates who have improved their interview 
                    skills with AI Coach. Start your free trial today.
                  </p>
                  <ul className="space-y-3 mb-8">
                    <li className="flex items-center gap-3 text-white/80">
                      <CheckCircle className="w-5 h-5 text-teal-400" />
                      <span>Free 7-day trial</span>
                    </li>
                    <li className="flex items-center gap-3 text-white/80">
                      <CheckCircle className="w-5 h-5 text-teal-400" />
                      <span>No credit card required</span>
                    </li>
                    <li className="flex items-center gap-3 text-white/80">
                      <CheckCircle className="w-5 h-5 text-teal-400" />
                      <span>Cancel anytime</span>
                    </li>
                  </ul>
                  <Link href="/signup">
                    <Button icon={<ArrowRight className="w-5 h-5" />}>
                      Get Started Free
                    </Button>
                  </Link>
                </div>
                <div className="flex justify-center">
                  <div className="relative w-64 h-64">
                    <AmbientGlow color="amber" size="lg" position="center" className="opacity-60" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Brain className="w-32 h-32 text-gradient-amber" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </Section>

        <Section className="py-16">
          <Container>
            <SectionHeader
              eyebrow="Why Choose Us"
              eyebrowColor="teal"
              title="Trusted by Institutions & Individuals"
              subtitle="Whether you're a student, professional, or institution, we have the right plan for you."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <div className="glass-card rounded-2xl p-6">
                <div className="icon-container icon-container-amber mb-4">
                  <Users className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">For Individuals</h3>
                <p className="text-sm text-muted">
                  Personal coaching for students and professionals looking to ace their interviews.
                </p>
              </div>
              <div className="glass-card rounded-2xl p-6">
                <div className="icon-container icon-container-teal mb-4">
                  <Users className="w-5 h-5 text-teal-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">For Institutions</h3>
                <p className="text-sm text-muted">
                  Bulk licenses for colleges and training centers to help their students succeed.
                </p>
              </div>
              <div className="glass-card rounded-2xl p-6">
                <div className="icon-container icon-container-purple mb-4">
                  <Shield className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Enterprise</h3>
                <p className="text-sm text-muted">
                  Custom solutions for large organizations with dedicated support and analytics.
                </p>
              </div>
            </div>
          </Container>
        </Section>

        <footer className="py-12 border-t border-white/5">
          <Container>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gradient-amber">AI Coach</span>
              </div>
              <nav className="flex flex-wrap items-center gap-6 text-sm text-muted">
                <Link href="/features" className="hover:text-white transition-colors">Features</Link>
                <Link href="/plans" className="hover:text-white transition-colors">Plans</Link>
                <Link href="/about" className="hover:text-white transition-colors">About</Link>
                <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
              </nav>
              <p className="text-sm text-subtle">&copy; 2026 AI Coach. All rights reserved.</p>
            </div>
          </Container>
        </footer>
      </main>
    </div>
  );
}