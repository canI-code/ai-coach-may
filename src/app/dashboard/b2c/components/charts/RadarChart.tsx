'use client';

import React, { useState, useRef } from 'react';
import type { JSX } from 'react';

/**
 * RadarChart — a dependency-free, highly interactive pure-SVG radar/spider chart.
 *
 * All geometry is hand-computed SVG geometry. Features interactive vertex hovers,
 * text label highlighting, spoke line indicators, and glowing center-anchored tooltips.
 */
export interface RadarChartProps {
  /** Categories to plot. Each `value` is expected within `0..max`. */
  axes: { label: string; value: number }[];
  /** Upper bound for the value scale. Default 100. */
  max?: number;
  /** SVG square size in px. Default 240. */
  size?: number;
  /** Accent color for the data polygon, dots and stroke. Default teal. */
  accent?: string;
  /** Optional extra classes for the wrapping element. */
  className?: string;
}

const MUTED = '#a1a1aa';
const GRID = 'rgba(255,255,255,0.10)';
const SPOKE = 'rgba(255,255,255,0.07)';
const RINGS = 4;
const TAU = Math.PI * 2;

function clampValue(value: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > max) return max;
  return value;
}

function fmt(n: number): string {
  return Number(n.toFixed(2)).toString();
}

export function RadarChart(props: RadarChartProps): JSX.Element {
  const {
    axes,
    max = 100,
    size = 240,
    accent = '#14b8a6',
    className,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredAxisIndex, setHoveredAxisIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const wrapClass = ['inline-block relative group/radar', className].filter(Boolean).join(' ');
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;

  // --- Empty: placeholder ---
  if (!axes || axes.length === 0) {
    return (
      <div
        className={wrapClass}
        role="img"
        aria-label="Radar chart with no data"
        style={{ width: size, height: size }}
      >
        <div
          className="flex h-full w-full items-center justify-center rounded-2xl border border-dashed text-xs"
          style={{ borderColor: GRID, color: MUTED }}
        >
          No data to display
        </div>
      </div>
    );
  }

  // --- Degenerate (< 3 axes): fall back to labeled bars ---
  if (axes.length < 3) {
    return (
      <div
        ref={containerRef}
        className={wrapClass}
        role="img"
        style={{ width: size }}
      >
        <div className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
          {axes.map((a, i) => {
            const v = clampValue(a.value, safeMax);
            const pct = (v / safeMax) * 100;
            const isHovered = hoveredAxisIndex === i;
            
            return (
              <div
                key={`${a.label}-${i}`}
                className="flex flex-col gap-1 cursor-pointer transition-all duration-200"
                onMouseEnter={(e) => {
                  setHoveredAxisIndex(i);
                  const rect = e.currentTarget.getBoundingClientRect();
                  const containerRect = containerRef.current?.getBoundingClientRect() || rect;
                  setTooltipPos({
                    x: rect.left - containerRect.left + rect.width / 2,
                    y: rect.top - containerRect.top - 8,
                  });
                }}
                onMouseLeave={() => {
                  setHoveredAxisIndex(null);
                  setTooltipPos(null);
                }}
              >
                <div className="flex items-baseline justify-between text-xs transition-colors text-left">
                  <span className={isHovered ? 'text-white' : 'text-[#a1a1aa]'}>{a.label}</span>
                  <span className={`font-semibold ${isHovered ? 'text-teal-400' : 'text-white'}`}>{fmt(v)}%</span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full"
                  style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: accent,
                      boxShadow: isHovered ? `0 0 8px ${accent}` : 'none'
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // --- Radar geometry ---
  const n = axes.length;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 36;
  const labelRadius = radius + 16;
  const startAngle = -Math.PI / 2; // straight up

  const angleAt = (i: number): number => startAngle + (i / n) * TAU;

  const pointAt = (i: number, r: number): { x: number; y: number } => {
    const ang = angleAt(i);
    return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) };
  };

  const polygonPoints = (r: number): string =>
    Array.from({ length: n }, (_, i) => {
      const p = pointAt(i, r);
      return `${fmt(p.x)},${fmt(p.y)}`;
    }).join(' ');

  const rings = Array.from({ length: RINGS }, (_, k) => {
    const frac = (RINGS - k) / RINGS;
    return polygonPoints(radius * frac);
  });

  const dataVertices = axes.map((a, i) => {
    const v = clampValue(a.value, safeMax);
    const r = (v / safeMax) * radius;
    return { ...pointAt(i, r), value: v, label: a.label, index: i };
  });

  const dataPoints = dataVertices
    .map((p) => `${fmt(p.x)},${fmt(p.y)}`)
    .join(' ');

  const ariaLabel =
    'Radar chart showing scores: ' +
    axes
      .map((a) => `${a.label} ${clampValue(a.value, safeMax)} out of ${safeMax}`)
      .join(', ');

  return (
    <div
      ref={containerRef}
      className={wrapClass}
      role="img"
      aria-label={ariaLabel}
      style={{ width: size, height: size }}
    >
      {/* Absolute Tooltip */}
      {tooltipPos && hoveredAxisIndex !== null && (
        <div
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-[#161827] border border-teal-500/30 text-white rounded-lg px-2.5 py-1.5 text-xs shadow-xl flex flex-col items-center gap-0.5 animate-fade-in"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 8}px`,
          }}
        >
          <span className="font-semibold text-[10px] text-gray-400 uppercase tracking-wider leading-none">
            {axes[hoveredAxisIndex].label}
          </span>
          <span className="text-sm font-extrabold text-teal-400 leading-none mt-1">
            {fmt(clampValue(axes[hoveredAxisIndex].value, safeMax))}%
          </span>
        </div>
      )}

      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        style={{ display: 'block', background: 'transparent', overflow: 'visible' }}
      >
        {/* grid rings */}
        {rings.map((pts, i) => (
          <polygon
            key={`ring-${i}`}
            points={pts}
            fill="none"
            stroke={GRID}
            strokeWidth={1}
          />
        ))}

        {/* axis spokes */}
        {Array.from({ length: n }, (_, i) => {
          const p = pointAt(i, radius);
          const isHovered = hoveredAxisIndex === i;
          
          return (
            <line
              key={`spoke-${i}`}
              x1={fmt(cx)}
              y1={fmt(cy)}
              x2={fmt(p.x)}
              y2={fmt(p.y)}
              stroke={isHovered ? accent : SPOKE}
              strokeOpacity={isHovered ? 0.35 : 1}
              strokeWidth={isHovered ? 1.5 : 1}
              strokeDasharray={isHovered ? '4 2' : 'none'}
              className="transition-all duration-200"
            />
          );
        })}

        {/* data polygon */}
        <polygon
          points={dataPoints}
          fill={accent}
          fillOpacity={0.18}
          stroke={accent}
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Vertex dots & hitboxes */}
        {dataVertices.map((p, i) => {
          const isHovered = i === hoveredAxisIndex;
          
          return (
            <g key={`dot-${i}`}>
              {isHovered && (
                <circle
                  cx={fmt(p.x)}
                  cy={fmt(p.y)}
                  r={8}
                  fill={accent}
                  fillOpacity={0.22}
                  className="animate-pulse"
                />
              )}
              <circle
                cx={fmt(p.x)}
                cy={fmt(p.y)}
                r={isHovered ? 4.5 : 3}
                fill={accent}
                stroke={isHovered ? '#ffffff' : '#0a0a0b'}
                strokeWidth={isHovered ? 1.5 : 1}
                className="transition-all duration-200"
              />
              {/* Invisible interactive hitbox */}
              <circle
                cx={fmt(p.x)}
                cy={fmt(p.y)}
                r={16}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => {
                  setHoveredAxisIndex(i);
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (rect) {
                    const parentX = (p.x / size) * rect.width;
                    const parentY = (p.y / size) * rect.height;
                    setTooltipPos({ x: parentX, y: parentY });
                  }
                }}
                onMouseLeave={() => {
                  setHoveredAxisIndex(null);
                  setTooltipPos(null);
                }}
              />
            </g>
          );
        })}

        {/* Text labels outside vertices */}
        {axes.map((a, i) => {
          const ang = angleAt(i);
          const cos = Math.cos(ang);
          const sin = Math.sin(ang);
          const lp = pointAt(i, labelRadius);
          const isHovered = i === hoveredAxisIndex;

          const anchor =
            cos > 0.3 ? 'start' : cos < -0.3 ? 'end' : 'middle';
          const baseline =
            sin > 0.3 ? 'hanging' : sin < -0.3 ? 'auto' : 'middle';

          return (
            <text
              key={`label-${i}`}
              x={fmt(lp.x)}
              y={fmt(lp.y)}
              textAnchor={anchor}
              dominantBaseline={baseline}
              fontSize={isHovered ? 12 : 11}
              fontWeight={isHovered ? 700 : 400}
              className="transition-all duration-200 cursor-pointer select-none text-left"
              onMouseEnter={() => {
                setHoveredAxisIndex(i);
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                  const parentX = (lp.x / size) * rect.width;
                  const parentY = (lp.y / size) * rect.height;
                  setTooltipPos({ x: parentX, y: parentY - 4 });
                }
              }}
              onMouseLeave={() => {
                setHoveredAxisIndex(null);
                setTooltipPos(null);
              }}
            >
              <tspan fill={isHovered ? '#ffffff' : MUTED}>{a.label}</tspan>
              <tspan
                fill={isHovered ? accent : '#ffffff'}
                fontWeight={600}
                dx={4}
              >
                {fmt(clampValue(a.value, safeMax))}%
              </tspan>
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default RadarChart;
