'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Container, Section, GlassCard, Input, Textarea, Button, Header, AmbientGlow, SectionHeader } from '../components/ui';
import { Send, Mail, Phone, MapPin, CheckCircle } from 'lucide-react';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setFormData({ name: '', email: '', message: '' });
      } else {
        setStatus('error');
        setErrorMsg(data.error || 'Something went wrong');
      }
    } catch (err) {
      setStatus('error');
      setErrorMsg('An error occurred. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-grid">
      <AmbientGlow color="amber" size="lg" position="top-left" className="z-0" />
      <AmbientGlow color="teal" size="md" position="bottom-right" className="z-0" />
      
      <Header />
      
      <main className="pt-28 pb-12">
        <Section>
          <Container>
            <SectionHeader
              eyebrow="Contact Us"
              eyebrowColor="amber"
              title="Get in Touch"
              subtitle="Have questions? We'd love to hear from you."
            />
            
            <div className="grid md:grid-cols-2 gap-8 mt-12">
              <GlassCard padding="lg">
                <h3 className="text-white font-semibold text-xl mb-6">Send us a Message</h3>
                
                {status === 'success' ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-teal-400" />
                    </div>
                    <h4 className="text-white font-semibold text-lg mb-2">Message Sent!</h4>
                    <p className="text-muted mb-6">We'll get back to you as soon as possible.</p>
                    <Button onClick={() => setStatus('idle')}>Send Another Message</Button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                      label="Name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Your name"
                      required
                    />
                    <Input
                      label="Email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="your@email.com"
                      required
                    />
                    <Textarea
                      label="Message"
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder="How can we help?"
                      required
                    />
                    
                    {status === 'error' && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                        {errorMsg}
                      </div>
                    )}
                    
                    <Button 
                      type="submit" 
                      fullWidth 
                      icon={<Send className="w-4 h-4" />}
                      disabled={status === 'loading'}
                    >
                      {status === 'loading' ? 'Sending...' : 'Send Message'}
                    </Button>
                  </form>
                )}
              </GlassCard>
              
              <div className="space-y-6">
                <GlassCard padding="lg">
                  <h3 className="text-white font-semibold text-xl mb-6">Contact Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="icon-container icon-container-amber">
                        <Mail className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Email</p>
                        <p className="text-sm text-muted">support@aicoach.com</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="icon-container icon-container-teal">
                        <Phone className="w-5 h-5 text-teal-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Phone</p>
                        <p className="text-sm text-muted">+91 98765 43210</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="icon-container icon-container-purple">
                        <MapPin className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-white font-medium">Location</p>
                        <p className="text-sm text-muted">Bengaluru, India</p>
                      </div>
                    </div>
                  </div>
                </GlassCard>
                
                <GlassCard padding="lg">
                  <h3 className="text-white font-semibold text-xl mb-4">Business Hours</h3>
                  <div className="space-y-2 text-muted">
                    <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
                    <p>Saturday: 10:00 AM - 2:00 PM</p>
                    <p>Sunday: Closed</p>
                  </div>
                </GlassCard>
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