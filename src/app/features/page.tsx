'use client';

import Link from 'next/link';
import { Container, Section, SectionHeader, FeatureCard, Header, AmbientGlow, GlassCard } from '../components/ui';
import { 
  Mic, 
  Video, 
  Brain, 
  Users, 
  TrendingUp, 
  Shield, 
  MessageSquare,
  Zap,
  Target,
  BarChart3
} from 'lucide-react';

const features = [
  {
    icon: <Mic className="w-5 h-5" />,
    iconColor: 'amber' as const,
    title: 'Voice Analysis',
    description: 'Advanced speech recognition evaluates clarity, pace, tone, and confidence in your verbal responses.',
  },
  {
    icon: <Video className="w-5 h-5" />,
    iconColor: 'teal' as const,
    title: 'Video Practice',
    description: 'Record yourself answering questions with webcam and get AI feedback on body language.',
  },
  {
    icon: <Brain className="w-5 h-5" />,
    iconColor: 'purple' as const,
    title: 'Smart Questions',
    description: 'AI generates personalized questions based on your target role, industry, and experience level.',
  },
  {
    icon: <TrendingUp className="w-5 h-5" />,
    iconColor: 'emerald' as const,
    title: 'Progress Tracking',
    description: 'Monitor your improvement over time with detailed analytics, charts, and actionable insights.',
  },
  {
    icon: <MessageSquare className="w-5 h-5" />,
    iconColor: 'amber' as const,
    title: 'Text Responses',
    description: 'Practice written answers and get instant feedback on structure, content, and grammar.',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    iconColor: 'teal' as const,
    title: 'Interview Security',
    description: 'End-to-end encryption ensures your practice sessions and data remain private and secure.',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    iconColor: 'purple' as const,
    title: 'Real-time Feedback',
    description: 'Get instant feedback during your practice session with suggestions for improvement.',
  },
  {
    icon: <Target className="w-5 h-5" />,
    iconColor: 'emerald' as const,
    title: 'Confidence Index',
    description: 'AI calculates your confidence score across multiple dimensions to identify weak areas.',
  },
  {
    icon: <BarChart3 className="w-5 h-5" />,
    iconColor: 'amber' as const,
    title: 'Detailed Analytics',
    description: 'Comprehensive reports on your performance with comparative benchmarks.',
  },
  {
    icon: <Users className="w-5 h-5" />,
    iconColor: 'teal' as const,
    title: 'Institution Dashboard',
    description: 'For colleges and training centers to monitor student progress and manage bulk licenses.',
  },
];

export default function Features() {
  return (
    <div className="min-h-screen bg-grid">
      <AmbientGlow color="amber" size="lg" position="top-left" className="z-0" />
      <AmbientGlow color="teal" size="md" position="bottom-right" className="z-0" />
      
      <Header />
      
      <main className="pt-28 pb-12">
        <Section>
          <Container>
            <SectionHeader
              eyebrow="Features"
              eyebrowColor="amber"
              title="Powerful AI Features"
              subtitle="Everything you need to ace your next interview"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
              {features.map((feature, index) => (
                <FeatureCard
                  key={index}
                  icon={feature.icon}
                  iconColor={feature.iconColor}
                  title={feature.title}
                  description={feature.description}
                />
              ))}
            </div>
          </Container>
        </Section>

        <Section className="py-12 bg-white/5">
          <Container>
            <SectionHeader
              eyebrow="How It Works"
              eyebrowColor="teal"
              title="Get Started in 3 Simple Steps"
              subtitle="Start your interview preparation journey today"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
              <div className="text-center">
                <div className="glass-card rounded-2xl p-8 h-full">
                  <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-gradient-amber">1</span>
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">Sign Up</h3>
                  <p className="text-sm text-muted">
                    Create your free account and choose your plan
                  </p>
                </div>
              </div>
              <div className="text-center">
                <div className="glass-card rounded-2xl p-8 h-full">
                  <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-gradient-teal">2</span>
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">Practice</h3>
                  <p className="text-sm text-muted">
                    Start a practice session with AI interviewer
                  </p>
                </div>
              </div>
              <div className="text-center">
                <div className="glass-card rounded-2xl p-8 h-full">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold text-gradient-emerald">3</span>
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">Improve</h3>
                  <p className="text-sm text-muted">
                    Review feedback and track your progress
                  </p>
                </div>
              </div>
            </div>
          </Container>
        </Section>

        <Section className="py-12">
          <Container>
            <GlassCard padding="lg" className="text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Ready to Start Practicing?</h2>
              <p className="text-muted mb-6 max-w-xl mx-auto">
                Join thousands of candidates who have improved their interview skills with AI Coach.
              </p>
              <Link href="/signup">
                <button className="btn-primary">
                  Get Started Free
                </button>
              </Link>
            </GlassCard>
          </Container>
        </Section>

        <footer className="py-8 border-t border-white/5 mt-12">
          <Container>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-subtle">&copy; 2026 AI Coach. All rights reserved.</p>
              <Link href="/" className="text-sm text-muted hover:text-white transition-colors">
                Back to Home
              </Link>
            </div>
          </Container>
        </footer>
      </main>
    </div>
  );
}