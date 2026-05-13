'use client';

import React from 'react';

interface SectionProps {
  children: React.ReactNode;
  className?: string;
}

export function Section({ children, className = '' }: SectionProps) {
  return (
    <section className={`py-16 md:py-20 lg:py-24 ${className}`}>
      {children}
    </section>
  );
}

interface SectionHeaderProps {
  eyebrow?: string;
  eyebrowColor?: 'amber' | 'teal' | 'emerald' | 'purple';
  title: string;
  subtitle?: string;
  align?: 'center' | 'left' | 'right';
  className?: string;
}

export function SectionHeader({
  eyebrow,
  eyebrowColor = 'amber',
  title,
  subtitle,
  align = 'center',
  className = '',
}: SectionHeaderProps) {
  const alignClasses = {
    center: 'text-center mx-auto',
    left: 'text-left',
    right: 'text-right ml-auto',
  };

  const eyebrowColorClasses = {
    amber: 'text-amber-400',
    teal: 'text-teal-400',
    emerald: 'text-emerald-400',
    purple: 'text-purple-400',
  };

  return (
    <div className={`max-w-2xl ${alignClasses[align]} ${className}`}>
      {eyebrow && (
        <p className={`section-eyebrow ${eyebrowColorClasses[eyebrowColor]} mb-3`}>
          {eyebrow}
        </p>
      )}
      <h2 className="section-title mb-4">{title}</h2>
      {subtitle && (
        <p className="text-muted text-base md:text-lg max-w-xl">
          {subtitle}
        </p>
      )}
    </div>
  );
}

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function Container({ children, className = '' }: ContainerProps) {
  return (
    <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}