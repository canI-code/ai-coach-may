'use client';

import React, { useState, useRef, useMemo } from 'react';
import type { JSX } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

/**
 * LineChart — dependency-free, highly interactive SVG trend line chart.
 *
 * All geometry is hand-rolled inline SVG; features responsive hover tooltips,
 * coordinates guides, and interactive scale zoom controls (X and Y axis).
 */
export interface LineChartProps {
  points: { label: string; value: number }[];
  /** Rendered/intrinsic height in px. Default 200. */
  height?: number;
  /** Line / fill / dot color. Default amber `#f59e0b`. */
  accent?: string;
  /** Top of the y-axis scale (bottom is always 0). Default 100. */
  max?: number;
  className?: string;
}

const VIEW_W = 720;
const PAD_LEFT = 34;
const PAD_RIGHT = 14;
const PAD_TOP = 16;
const PAD_BOTTOM = 34;

const GRID_FRACTIONS = [0, 0.25, 0.5, 0.75, 1] as const;
const MUTED = '#a1a1aa';

function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function truncate(label: string, maxChars: number): string {
  if (label.length <= maxChars) return label;
  return `${label.slice(0, Math.max(1, maxChars - 1))}…`;
}

export function LineChart({
  points,
  height = 200,
  accent = '#f59e0b',
  max = 100,
  className = '',
}: LineChartProps): JSX.Element {
  const uid = React.useId().replace(/[:]/g, '');
  const gradientId = `lc-area-${uid}`;

  // Interactive Zoom States
  const [xZoomLevel, setXZoomLevel] = useState(0); // 0 = show all, 1 = show 75%, 2 = show 50%, 3 = show 25% (min 3)
  const [yZoomMax, setYZoomMax] = useState(max);

  // Hover states
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // X-zoom points filter
  const visiblePoints = useMemo(() => {
    if (!points || points.length === 0) return [];
    if (xZoomLevel <= 0 || points.length <= 3) return points;
    const keepCount = Math.max(3, Math.ceil(points.length * (1 - xZoomLevel * 0.25)));
    return points.slice(-keepCount);
  }, [points, xZoomLevel]);

  // Empty state check
  if (!points || points.length === 0) {
    return (
      <div
        className={`flex items-center justify-center rounded-2xl border border-white/5 bg-white/[0.02] text-sm text-[#a1a1aa] ${className}`}
        style={{ height }}
        role="img"
        aria-label="No trend data available yet"
      >
        No trend data yet
      </div>
    );
  }

  const H = height;
  const safeMax = yZoomMax > 0 ? yZoomMax : 1;

  const plotLeft = PAD_LEFT;
  const plotRight = VIEW_W - PAD_RIGHT;
  const plotTop = PAD_TOP;
  const plotBottom = H - PAD_BOTTOM;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  const n = visiblePoints.length;

  const xOf = (index: number): number => {
    if (n === 1) return (plotLeft + plotRight) / 2;
    return plotLeft + (index / (n - 1)) * plotWidth;
  };

  const yOf = (value: number): number => {
    const v = clamp(value, 0, safeMax);
    return plotBottom - (v / safeMax) * plotHeight;
  };

  const visibleCoords = visiblePoints.map((p, i) => ({
    x: xOf(i),
    y: yOf(p.value),
    label: p.label,
    value: p.value,
  }));

  const last = visibleCoords[visibleCoords.length - 1];
  let linePath = '';
  if (n > 0) {
    linePath = `M ${visibleCoords[0].x.toFixed(2)} ${visibleCoords[0].y.toFixed(2)}`;
    for (let i = 1; i < n; i++) {
      const p0 = visibleCoords[i - 1];
      const p1 = visibleCoords[i];
      const dx = (p1.x - p0.x) * 0.4;
      const cp1x = p0.x + dx;
      const cp1y = p0.y;
      const cp2x = p1.x - dx;
      const cp2y = p1.y;
      linePath += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
    }
  }

  const areaPath =
    n > 1
      ? `${linePath} L ${last.x.toFixed(2)} ${plotBottom.toFixed(2)} ` +
        `L ${visibleCoords[0].x.toFixed(2)} ${plotBottom.toFixed(2)} Z`
      : '';

  const maxLabels = 12;
  const step = Math.max(1, Math.ceil(n / maxLabels));
  const rotate = n > 6;
  const labelY = plotBottom + (rotate ? 12 : 16);
  const labelChars = rotate ? 8 : 10;

  const visibleLabelIndices = visibleCoords
    .map((_, i) => i)
    .filter((i) => i % step === 0 || i === n - 1);

  // Interactive Hover Handler
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || visiblePoints.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Scale mouse position to intrinsic VIEW_W
    const svgX = (mouseX / rect.width) * VIEW_W;
    
    // Find nearest point
    let nearestIdx = 0;
    let minDist = Infinity;
    
    visibleCoords.forEach((coord, i) => {
      const dist = Math.abs(coord.x - svgX);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    });
    
    setHoveredIndex(nearestIdx);
    
    // Map SVG coordinates back to client coordinates for HTML tooltip positioning
    const coord = visibleCoords[nearestIdx];
    const tooltipX = (coord.x / VIEW_W) * rect.width;
    const tooltipY = (coord.y / H) * rect.height;
    
    setTooltipPos({ x: tooltipX, y: tooltipY });
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
    setTooltipPos(null);
  };

  // Zoom handlers
  const handleXZoomIn = () => {
    if (points.length > 3) {
      setXZoomLevel((prev) => Math.min(3, prev + 1));
    }
  };

  const handleXZoomOut = () => {
    setXZoomLevel((prev) => Math.max(0, prev - 1));
  };

  const handleYZoomIn = () => {
    setYZoomMax((prev) => Math.max(10, Math.round(prev * 0.8)));
  };

  const handleYZoomOut = () => {
    setYZoomMax((prev) => Math.min(200, Math.round(prev * 1.25)));
  };

  const handleResetZoom = () => {
    setXZoomLevel(0);
    setYZoomMax(max);
  };

  const isZoomed = xZoomLevel > 0 || yZoomMax !== max;

  return (
    <div ref={containerRef} className={`w-full relative group/chart ${className}`}>
      {/* Zoom Toolbar */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 opacity-0 group-hover/chart:opacity-100 transition-opacity duration-200 bg-[#0a0a0b]/80 border border-white/5 p-1 rounded-lg backdrop-blur-md">
        <button
          onClick={handleXZoomIn}
          disabled={xZoomLevel === 3 || points.length <= 3}
          className="p-1 text-[#a1a1aa] hover:text-white disabled:opacity-30 transition-colors text-xs font-semibold cursor-pointer"
          title="Zoom In Timeline"
        >
          X+
        </button>
        <button
          onClick={handleXZoomOut}
          disabled={xZoomLevel === 0}
          className="p-1 text-[#a1a1aa] hover:text-white disabled:opacity-30 transition-colors text-xs font-semibold cursor-pointer"
          title="Zoom Out Timeline"
        >
          X-
        </button>
        <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
        <button
          onClick={handleYZoomIn}
          className="p-1 text-[#a1a1aa] hover:text-white transition-colors text-xs font-semibold cursor-pointer"
          title="Zoom In Scale"
        >
          Y+
        </button>
        <button
          onClick={handleYZoomOut}
          className="p-1 text-[#a1a1aa] hover:text-white transition-colors text-xs font-semibold cursor-pointer"
          title="Zoom Out Scale"
        >
          Y-
        </button>
        {isZoomed && (
          <>
            <div className="w-[1px] h-3 bg-white/10 mx-0.5" />
            <button
              onClick={handleResetZoom}
              className="p-1 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
              title="Reset Zoom"
            >
              <RotateCcw size={12} />
            </button>
          </>
        )}
      </div>

      {/* Floating Interactive Tooltip */}
      {tooltipPos && hoveredIndex !== null && (
        <div
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-[#161827] border border-amber-500/30 text-white rounded-lg px-2.5 py-1.5 text-xs shadow-xl flex flex-col items-center gap-0.5 animate-fade-in"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 12}px`,
          }}
        >
          <span className="font-semibold text-[10px] text-gray-400 uppercase tracking-wider leading-none">
            {visiblePoints[hoveredIndex].label}
          </span>
          <span className="text-sm font-extrabold text-amber-400 leading-none mt-1">
            {Number(visiblePoints[hoveredIndex].value.toFixed(3))}
          </span>
        </div>
      )}

      {/* SVG Canvas */}
      <svg
        viewBox={`0 0 ${VIEW_W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.32} />
            <stop offset="55%" stopColor={accent} stopOpacity={0.1} />
            <stop offset="100%" stopColor={accent} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {GRID_FRACTIONS.map((frac) => {
          const gy = plotBottom - frac * plotHeight;
          return (
            <g key={`grid-${frac}`}>
              <line
                x1={plotLeft}
                y1={gy}
                x2={plotRight}
                y2={gy}
                stroke="#ffffff"
                strokeOpacity={frac === 0 ? 0.12 : 0.06}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={plotLeft - 8}
                y={gy + 3}
                textAnchor="end"
                fontSize={10}
                fill={MUTED}
                fillOpacity={0.7}
              >
                {Math.round(frac * safeMax)}
              </text>
            </g>
          );
        })}

        {/* Gradient area fill under the line (2+ points only) */}
        {n > 1 && <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />}

        {/* Vertical hover guide-line */}
        {hoveredIndex !== null && (
          <line
            x1={visibleCoords[hoveredIndex].x}
            y1={plotTop}
            x2={visibleCoords[hoveredIndex].x}
            y2={plotBottom}
            stroke={accent}
            strokeOpacity={0.25}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* The trend line (2+ points only) */}
        {n > 1 && (
          <path
            d={linePath}
            fill="none"
            stroke={accent}
            strokeWidth={2.2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Data dots */}
        {visibleCoords.map((c, i) => {
          const isHovered = i === hoveredIndex;
          const isLast = i === n - 1 && hoveredIndex === null;
          
          if (isHovered || isLast) {
            return (
              <g key={`dot-${i}`}>
                {/* Glowing halo */}
                <circle cx={c.x} cy={c.y} r={8} fill={accent} fillOpacity={0.22} className="animate-pulse" />
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={4}
                  fill={accent}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            );
          }

          return (
            <circle
              key={`dot-${i}`}
              cx={c.x}
              cy={c.y}
              r={2.8}
              fill={accent}
              stroke="#0a0a0a"
              strokeWidth={1}
              strokeOpacity={0.4}
              vectorEffect="non-scaling-stroke"
              className="hover:scale-150 transition-transform duration-200"
            />
          );
        })}

        {/* X-axis labels */}
        {visibleLabelIndices.map((i) => {
          const c = visibleCoords[i];
          const text = truncate(c.label, labelChars);
          const isActive = i === hoveredIndex;
          
          if (rotate) {
            return (
              <text
                key={`xlabel-${i}`}
                x={c.x}
                y={labelY}
                fontSize={10}
                fill={isActive ? '#ffffff' : MUTED}
                fontWeight={isActive ? 700 : 400}
                textAnchor="end"
                transform={`rotate(-40 ${c.x} ${labelY})`}
              >
                {text}
              </text>
            );
          }
          return (
            <text
              key={`xlabel-${i}`}
              x={c.x}
              y={labelY}
              fontSize={isActive ? 12 : 11}
              fontWeight={isActive ? 700 : 400}
              fill={isActive ? '#ffffff' : MUTED}
              textAnchor="middle"
            >
              {text}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default LineChart;
