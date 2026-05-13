'use client';

import Link from 'next/link';
import { Container, Section, SectionHeader, GlassCard, Header, AmbientGlow, Button } from '../components/ui';
import { Users, Brain, Target, ArrowRight, Mail, Phone, MapPin } from 'lucide-react';

export default function About() {
  return (
    <div className="min-h-screen bg-grid">
      <AmbientGlow color="amber" size="lg" position="top-left" className="z-0" />
      <AmbientGlow color="teal" size="md" position="bottom-right" className="z-0" />
      
      <Header />
      
      <main className="pt-28 pb-12">
        <Section>
          <Container>
            <SectionHeader
              eyebrow="About Us"
              eyebrowColor="amber"
              title="Empowering Interview Success with AI"
              subtitle="We're on a mission to help every candidate ace their interview and land their dream job."
            />
            
            <div className="grid md:grid-cols-2 gap-8 mt-12">
              <GlassCard padding="lg">
                <h3 className="text-white font-semibold text-xl mb-4">Our Mission</h3>
                <p className="text-muted leading-relaxed">
                  AI Coach was founded with a simple mission: to make high-quality interview preparation accessible to everyone. 
                  We believe that every candidate deserves a fair chance to showcase their true potential, regardless of 
                  their background or resources.
                </p>
                <p className="text-muted leading-relaxed mt-4">
                  By harnessing the power of artificial intelligence, we've created a platform that provides 
                  personalized, real-time feedback to help candidates improve their skills and build confidence.
                </p>
              </GlassCard>
              
              <GlassCard padding="lg">
                <h3 className="text-white font-semibold text-xl mb-4">Our Vision</h3>
                <p className="text-muted leading-relaxed">
                  We envision a world where interview preparation is no longer a barrier to success. 
                  A world where everyone has access to expert-level coaching and feedback to polish their skills.
                </p>
                <p className="text-muted leading-relaxed mt-4">
                  Through continuous innovation and a commitment to excellence, we're building the future of interview 
                  preparation—one practice session at a time.
                </p>
              </GlassCard>
            </div>
          </Container>
        </Section>

        <Section className="py-12">
          <Container>
            <SectionHeader
              eyebrow="Our Values"
              eyebrowColor="teal"
              title="What Drives Us"
              subtitle="Our core values guide every decision we make"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <GlassCard padding="lg">
                <div className="icon-container icon-container-amber mb-4">
                  <Brain className="w-5 h-5 text-amber-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Innovation</h3>
                <p className="text-sm text-muted">
                  We constantly push the boundaries of AI to provide the best interview preparation experience.
                </p>
              </GlassCard>
              
              <GlassCard padding="lg">
                <div className="icon-container icon-container-teal mb-4">
                  <Users className="w-5 h-5 text-teal-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Accessibility</h3>
                <p className="text-sm text-muted">
                  We believe quality interview prep should be accessible to everyone, not just the privileged few.
                </p>
              </GlassCard>
              
              <GlassCard padding="lg">
                <div className="icon-container icon-container-purple mb-4">
                  <Target className="w-5 h-5 text-purple-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Results</h3>
                <p className="text-sm text-muted">
                  We're focused on one thing: helping you get real results in your interview journey.
                </p>
              </GlassCard>
            </div>
          </Container>
        </Section>

        <Section className="py-12">
          <Container>
            <GlassCard padding="lg">
              <div className="grid md:grid-cols-2 gap-8 items-center">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4">Get in Touch</h2>
                  <p className="text-muted mb-6">
                    Have questions? We'd love to hear from you. Reach out to us anytime.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-muted">
                      <Mail className="w-5 h-5 text-amber-400" />
                      <span>support@aicoach.com</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted">
                      <Phone className="w-5 h-5 text-teal-400" />
                      <span>+91 98765 43210</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted">
                      <MapPin className="w-5 h-5 text-purple-400" />
                      <span>Bengaluru, India</span>
                    </div>
                  </div>
                </div>
                <div className="flex justify-center">
                  <Link href="/contact">
                    <Button icon={<ArrowRight className="w-4 h-4" />}>
                      Contact Us
                    </Button>
                  </Link>
                </div>
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