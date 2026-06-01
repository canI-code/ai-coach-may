'use client';

import Link from 'next/link';
import { Container, Section, AmbientGlow, Button } from './components/ui';
import { Home, Construction } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-grid flex flex-col justify-center relative overflow-hidden">
      <AmbientGlow color="amber" size="xl" position="top-left" className="z-0" />
      <AmbientGlow color="teal" size="lg" position="bottom-right" className="z-0" />
      
      <main className="relative z-10">
        <Section>
          <Container>
            <div className="text-center max-w-2xl mx-auto glass-card p-12 rounded-3xl border border-white/10">
              <div className="flex justify-center mb-6">
                <div className="p-4 bg-amber-400/10 rounded-full animate-pulse">
                  <Construction className="w-12 h-12 text-amber-400" />
                </div>
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold mb-4 text-white">
                404 - Page Not Found
              </h1>
              
              <div className="h-1 w-20 bg-amber-400 mx-auto mb-8 rounded-full"></div>
              
              <p className="text-xl text-muted mb-8 leading-relaxed">
                The page you are looking for does not exist or is currently 
                <span className="text-amber-400 font-semibold block sm:inline"> under construction</span>. 
              </p>
              
              <p className="text-muted/60 mb-10 italic">
                We're building something great here. Please check back later!
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/">
                  <Button size="lg" icon={<Home className="w-5 h-5" />}>
                    Return Home
                  </Button>
                </Link>
              </div>
            </div>
          </Container>
        </Section>
      </main>
      
      <footer className="absolute bottom-8 w-full text-center text-subtle text-sm z-10">
        &copy; 2026 AI Coach. All rights reserved.
      </footer>
    </div>
  );
}
