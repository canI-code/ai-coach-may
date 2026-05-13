'use client';

import React from 'react';

type IconColor = 'amber' | 'teal' | 'emerald' | 'purple';

interface FeatureCardProps {
  icon: React.ReactNode;
  iconColor?: IconColor;
  title: string;
  description: string;
  className?: string;
}

export function FeatureCard({
  icon,
  iconColor = 'amber',
  title,
  description,
  className = '',
}: FeatureCardProps) {
  const iconColorClasses: Record<IconColor, string> = {
    amber: 'icon-container-amber',
    teal: 'icon-container-teal',
    emerald: 'icon-container-emerald',
    purple: 'icon-container-purple',
  };

  return (
    <div className={`glass-card glass-card-hover rounded-2xl p-6 ${className}`}>
      <div className={`icon-container ${iconColorClasses[iconColor]} mb-4`}>
        {icon}
      </div>
      <h3 className="text-white font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">
        {description}
      </p>
    </div>
  );
}

interface PricingCardProps {
  title: string;
  price: string;
  description: string;
  features: string[];
  variant?: 'default' | 'featured';
  cta?: React.ReactNode;
  className?: string;
}

export function PricingCard({
  title,
  price,
  description,
  features,
  variant = 'default',
  cta,
  className = '',
}: PricingCardProps) {
  return (
    <div 
      className={`
        glass-card 
        rounded-2xl 
        p-8 
        ${variant === 'featured' ? 'border-amber-500/30 amber-glow' : ''}
        ${className}
      `}
    >
      <h3 className="text-white font-semibold text-xl mb-2">{title}</h3>
      <div className="mb-4">
        <span className="text-4xl font-bold text-gradient-amber">{price}</span>
      </div>
      <p className="text-muted mb-6">{description}</p>
      <ul className="space-y-3 mb-8">
        {features.map((feature, index) => (
          <li key={index} className="flex items-center gap-3 text-sm text-white/80">
            <CheckIcon className="w-4 h-4 text-teal-400 flex-shrink-0" />
            {feature}
          </li>
        ))}
      </ul>
      {cta}
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      fill="none" 
      viewBox="0 0 24 24" 
      stroke="currentColor"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M5 13l4 4L19 7" 
      />
    </svg>
  );
}