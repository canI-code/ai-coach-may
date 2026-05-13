'use client';

import Link from 'next/link';
import { Container, Section, GlassCard, Header, AmbientGlow, SectionHeader } from '../components/ui';
import { ArrowRight, CheckCircle, MessageSquare, TrendingUp, User, School } from 'lucide-react';

const steps = [
  {
    icon: <User className="w-6 h-6" />,
    color: 'amber' as const,
    title: 'Create Account',
    description: 'Sign up as an individual or institution and choose your preferred plan.',
  },
  {
    icon: <MessageSquare className="w-6 h-6" />,
    color: 'teal' as const,
    title: 'Start Practice',
    description: 'Choose your target role and start a practice session with the AI interviewer.',
  },
  {
    icon: <TrendingUp className="w-6 h-6" />,
    color: 'emerald' as const,
    title: 'Get Feedback',
    description: 'Receive detailed feedback on your responses, tone, and body language.',
  },
  {
    icon: <CheckCircle className="w-6 h-6" />,
    color: 'purple' as const,
    title: 'Improve',
    description: 'Track your progress over time and consistently improve your skills.',
  },
];

const userTypes = [
  {
    icon: <User className="w-5 h-5" />,
    color: 'amber' as const,
    title: 'Individual',
    description: 'Students and professionals preparing for job interviews.',
  },
  {
    icon: <School className="w-5 h-5" />,
    color: 'teal' as const,
    title: 'Institution',
    description: 'Colleges and training centers managing student progress.',
  },
];

export default function Usage() {
  return (
    <div className="min-h-screen bg-grid">
      <AmbientGlow color="amber" size="lg" position="top-left" className="z-0" />
      <AmbientGlow color="teal" size="md" position="bottom-right" className="z-0" />
      
      <Header />
      
      <main className="pt-28 pb-12">
        <Section>
          <Container>
            <SectionHeader
              eyebrow="How It Works"
              eyebrowColor="amber"
              title="Getting Started"
              subtitle="Start your interview preparation journey in just a few steps"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12">
              {steps.map((step, index) => (
                <div key={index} className="relative">
                  <GlassCard padding="lg" className="text-center h-full">
                    <div className={`icon-container icon-container-${step.color} mb-4 mx-auto`}>
                      {step.icon}
                    </div>
                    <span className={`text-lg font-bold text-${step.color}-400`}>
                      {index + 1}
                    </span>
                    <h3 className="text-white font-semibold text-lg mt-3 mb-2">{step.title}</h3>
                    <p className="text-sm text-muted">{step.description}</p>
                  </GlassCard>
                  {index < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                      <ArrowRight className="w-6 h-6 text-white/20" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Container>
        </Section>

        <Section className="py-12">
          <Container>
            <SectionHeader
              eyebrow="User Types"
              eyebrowColor="teal"
              title="Who Can Use AI Coach?"
              subtitle="Whether you're an individual or an institution, we have a solution for you"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12 max-w-3xl mx-auto">
              {userTypes.map((type, index) => (
                <GlassCard key={index} padding="lg" className="glass-card-hover">
                  <div className="flex items-start gap-4">
                    <div className={`icon-container icon-container-${type.color} flex-shrink-0`}>
                      {type.icon}
                    </div>
                    <div>
                      <h3 className="text-white font-semibold text-lg mb-2">{type.title}</h3>
                      <p className="text-sm text-muted">{type.description}</p>
                    </div>
                  </div>
                </GlassCard>
              ))}
            </div>
          </Container>
        </Section>

        <Section className="py-12">
          <Container>
            <GlassCard padding="lg" className="text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Ready to Get Started?</h2>
              <p className="text-muted mb-6 max-w-xl mx-auto">
                Join thousands of candidates who have improved their interview skills with AI Coach.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/signup">
                  <button className="btn-primary">
                    Sign Up Free
                  </button>
                </Link>
                <Link href="/plans">
                  <button className="btn-ghost">
                    View Plans
                  </button>
                </Link>
              </div>
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