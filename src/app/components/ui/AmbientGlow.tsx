'use client';

import React from 'react';

type GlowColor = 'amber' | 'teal' | 'purple' | 'emerald' | 'red';

interface AmbientGlowProps {
  color?: GlowColor;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  className?: string;
}

export function AmbientGlow({
  color = 'amber',
  size = 'lg',
  position = 'top-left',
  className = '',
}: AmbientGlowProps) {
  const sizeClasses = {
    sm: 'w-48 h-48',
    md: 'w-64 h-64',
    lg: 'w-96 h-96',
    xl: 'w-[30rem] h-[30rem]',
  };

  const positionClasses = {
    'top-left': 'top-0 left-0',
    'top-right': 'top-0 right-0',
    'bottom-left': 'bottom-0 left-0',
    'bottom-right': 'bottom-0 right-0',
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  };

  const colorClasses: Record<GlowColor, string> = {
    amber: 'bg-amber-500/5',
    teal: 'bg-teal-500/5',
    purple: 'bg-purple-500/5',
    emerald: 'bg-emerald-500/5',
    red: 'bg-red-500/5',
  };

  const gradients: Record<GlowColor, string> = {
    amber: 'radial-gradient(circle, rgba(251,146,60,0.08) 0%, transparent 70%)',
    teal: 'radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)',
    purple: 'radial-gradient(circle, rgba(139,92,246,0.08) 0%, transparent 70%)',
    emerald: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
    red: 'radial-gradient(circle, rgba(239,68,68,0.08) 0%, transparent 70%)',
  };

  return (
    <div
      className={`absolute pointer-events-none ${sizeClasses[size]} ${positionClasses[position]} ${className}`}
      style={{ background: gradients[color] }}
    />
  );
}

interface FloatingBlobProps {
  color?: GlowColor;
  size?: number;
  className?: string;
}

export function FloatingBlob({
  color = 'amber',
  size = 120,
  className = '',
}: FloatingBlobProps) {
  const gradients: Record<GlowColor, string> = {
    amber: 'radial-gradient(circle, rgba(251,146,60,0.12) 0%, transparent 70%)',
    teal: 'radial-gradient(circle, rgba(20,184,166,0.12) 0%, transparent 70%)',
    purple: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
    emerald: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
    red: 'radial-gradient(circle, rgba(239,68,68,0.12) 0%, transparent 70%)',
  };

  return (
    <div
      className={`absolute pointer-events-none rounded-full animate-pulse ${className}`}
      style={{
        width: size,
        height: size,
        background: gradients[color],
      }}
    />
  );
}