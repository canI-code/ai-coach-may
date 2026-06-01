'use client';

import Link from 'next/link';
import { Button } from '@/app/components/ui/Button';
import { Home, Construction } from 'lucide-react';
import { AmbientGlow } from '@/app/components/ui/AmbientGlow';

export default function B2CNotFound() {
  return (
    <div className="min-h-screen bg-transparent text-white p-4 md:p-8 flex flex-col items-center justify-center relative">
      <AmbientGlow color="amber" size="lg" position="center" className="opacity-20" />
      
      <div className="text-center max-w-2xl mx-auto glass-card p-12 rounded-3xl border border-white/10 relative z-10">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-amber-400/10 rounded-full animate-pulse">
            <Construction className="w-12 h-12 text-amber-400" />
          </div>
        </div>
        
        <h1 className="text-3xl md:text-4xl font-bold mb-4 text-white">
          Under Construction
        </h1>
        
        <div className="h-1 w-20 bg-amber-400 mx-auto mb-8 rounded-full"></div>
        
        <p className="text-lg md:text-xl text-muted mb-8 leading-relaxed">
          The feature you're looking for is currently 
          <span className="text-amber-400 font-semibold block sm:inline"> under construction</span>. 
        </p>
        
        <p className="text-muted/60 mb-10 italic text-sm">
          We're building something great for your preparation journey. Please check back later!
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/dashboard/b2c">
            <Button size="lg" icon={<Home className="w-5 h-5" />}>
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
