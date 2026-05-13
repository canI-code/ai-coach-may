'use client';

import Link from 'next/link';
import { Container, Section, SectionHeader, GlassCard, Button, PricingCard, Header, AmbientGlow } from '../components/ui';
import { Check, ArrowRight, Star } from 'lucide-react';

const plans = [
  {
    title: 'Free',
    price: '₹0',
    description: 'Perfect for getting started',
    features: [
      '5 Practice sessions',
      'Basic voice analysis',
      'Text responses only',
      'Community support',
      'Limited question bank',
    ],
  },
  {
    title: 'Pro',
    price: '₹499',
    description: 'For serious candidates',
    features: [
      'Unlimited practice sessions',
      'Full voice & video analysis',
      'AI-generated personalized questions',
      'Detailed confidence index',
      'Priority support',
      'Industry-specific training',
      'Resume evaluation',
    ],
    featured: true,
  },
  {
    title: 'Institution',
    price: 'Custom',
    description: 'For colleges and training centers',
    features: [
      'Bulk licenses',
      'Progress monitoring dashboard',
      'Mentor coordination tools',
      'Custom branding',
      'Dedicated account manager',
      'API access',
      'Priority support',
    ],
  },
];

export default function Plans() {
  return (
    <div className="min-h-screen bg-grid">
      <AmbientGlow color="amber" size="lg" position="top-left" className="z-0" />
      <AmbientGlow color="teal" size="md" position="bottom-right" className="z-0" />
      
      <Header />
      
      <main className="pt-28 pb-12">
        <Section>
          <Container>
            <SectionHeader
              eyebrow="Pricing"
              eyebrowColor="amber"
              title="Simple, Transparent Pricing"
              subtitle="Choose the plan that fits your needs. All plans include a 7-day free trial."
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              {plans.map((plan, index) => (
                <div key={index} className={plan.featured ? 'md:-mt-4 md:mb-4' : ''}>
                  {plan.featured ? (
                    <div className="glass-card rounded-t-2xl p-4 bg-amber-500/10 border-b border-amber-500/20">
                      <div className="flex items-center justify-center gap-2 text-amber-400">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-semibold">Most Popular</span>
                      </div>
                    </div>
                  ) : null}
                  <PricingCard
                    title={plan.title}
                    price={plan.price}
                    description={plan.description}
                    features={plan.features}
                    variant={plan.featured ? 'featured' : 'default'}
                    cta={
                      plan.title === 'Institution' ? (
                        <Link href="/contact">
                          <Button variant="ghost" fullWidth icon={<ArrowRight className="w-4 h-4" />}>
                            Contact Sales
                          </Button>
                        </Link>
                      ) : (
                        <Link href="/signup">
                          <Button variant={plan.featured ? 'primary' : 'secondary'} fullWidth icon={<ArrowRight className="w-4 h-4" />}>
                            Get Started
                          </Button>
                        </Link>
                      )
                    }
                  />
                </div>
              ))}
            </div>

            <div className="mt-16 glass-card rounded-2xl p-8">
              <h3 className="text-white font-semibold text-xl mb-4 text-center">
                Frequently Asked Questions
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-white font-medium mb-2">Can I cancel anytime?</h4>
                  <p className="text-sm text-muted">
                    Yes, you can cancel your subscription at any time. No questions asked.
                  </p>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">Is there a free trial?</h4>
                  <p className="text-sm text-muted">
                    Yes, all paid plans include a 7-day free trial. No credit card required.
                  </p>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">What payment methods do you accept?</h4>
                  <p className="text-sm text-muted">
                    We accept all major credit/debit cards, UPI, and net banking.
                  </p>
                </div>
                <div>
                  <h4 className="text-white font-medium mb-2">Can I switch plans later?</h4>
                  <p className="text-sm text-muted">
                    Yes, you can upgrade or downgrade your plan at any time from your dashboard.
                  </p>
                </div>
              </div>
            </div>
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