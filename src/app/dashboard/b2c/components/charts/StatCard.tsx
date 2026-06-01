'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { GlassCard } from '@/app/components/ui/GlassCard';

export type StatAccent = 'amber' | 'teal' | 'emerald' | 'red';

export interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string; // pre-formatted, e.g. "82", "5", "12.5 min", "--"
  sub?: string; // small caption under value, e.g. "+4 this week"
  accent?: StatAccent; // default 'amber'
  trend?: number | null; // optional signed delta; renders an up/down chip when provided
  className?: string;
}

/**
 * Full literal class strings (no runtime concatenation of fragments) so the
 * Tailwind JIT scanner can detect every variant used here.
 */
const ACCENT_TEXT: Record<StatAccent, string> = {
  amber: 'text-amber-500',
  teal: 'text-teal-400',
  emerald: 'text-emerald-400',
  red: 'text-red-400',
};

const ACCENT_CHIP: Record<StatAccent, string> = {
  amber: 'bg-amber-500/10 text-amber-500',
  teal: 'bg-teal-500/10 text-teal-400',
  emerald: 'bg-emerald-500/10 text-emerald-400',
  red: 'bg-red-500/10 text-red-400',
};

export function StatCard({
  icon,
  label,
  value,
  sub,
  accent = 'amber',
  trend,
  className = '',
}: StatCardProps): React.JSX.Element {
  const hasTrend = typeof trend === 'number';
  const isPositive = hasTrend && (trend as number) >= 0;
  const trendLabel = hasTrend ? `${isPositive ? '+' : ''}${trend}` : '';

  return (
    <GlassCard
      padding="md"
      className={`relative overflow-hidden group bg-[#0a0a0b]/40 border-white/5 ${className}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center ${ACCENT_CHIP[accent]}`}
        >
          {icon}
        </div>

        {hasTrend ? (
          <div
            className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
              isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
            }`}
          >
            {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {trendLabel}
          </div>
        ) : (
          <ArrowUpRight
            size={16}
            className="text-white/20 group-hover:text-white/40 transition-colors"
          />
        )}
      </div>

      <div className={`text-3xl font-bold mb-1 ${ACCENT_TEXT[accent]}`}>{value}</div>
      <div className="text-sm text-white/80 font-medium">{label}</div>
      {sub ? <div className="text-xs text-[#a1a1aa] mt-1">{sub}</div> : null}
    </GlassCard>
  );
}
