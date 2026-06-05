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
export interface LineChartSeries {
  name: string;
  color: string;
  points: { date?: Date; label: string; value: number }[];
}

export interface LineChartProps {
  points?: { date?: Date; label: string; value: number }[];
  series?: LineChartSeries[];
  /** Rendered/intrinsic height in px. Default 200. */
  height?: number;
  /** Line / fill / dot color. Default amber `#f59e0b`. */
  accent?: string;
  /** Top of the y-axis scale (bottom is always 0). Default 100. */
  max?: number;
  className?: string;
  levelMapping?: (value: number) => string;
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
  series,
  height = 200,
  accent = '#f59e0b',
  max = 100,
  className = '',
  levelMapping,
}: LineChartProps): JSX.Element {
  const uid = React.useId().replace(/[:]/g, '');

  // Interactive Zoom States
  const [xZoomLevel, setXZoomLevel] = useState(0); // 0 = show all, 1 = show 75%, 2 = show 50%, 3 = show 25% (min 3)
  const [yZoomMax, setYZoomMax] = useState(max);

  // Hover states
  const [hoveredLabelIndex, setHoveredLabelIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeSeries = useMemo<LineChartSeries[]>(() => {
    if (series) return series;
    if (points) {
      return [{
        name: 'Overall',
        color: accent,
        points: points
      }];
    }
    return [];
  }, [series, points, accent]);

  // Resolve unique sorted labels based on dates
  const allLabels = useMemo(() => {
    const datesMap = new Map<string, Date>();
    
    const addPt = (p: { date?: Date; label: string }) => {
      if (p.date) {
        datesMap.set(p.label, p.date);
      } else {
        const parsed = new Date(p.label);
        datesMap.set(p.label, Number.isNaN(parsed.getTime()) ? new Date() : parsed);
      }
    };

    activeSeries.forEach(s => s.points.forEach(addPt));

    const list = Array.from(datesMap.entries()).map(([label, date]) => ({ label, date }));
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
    return list.map(item => item.label);
  }, [activeSeries]);

  // X-zoom labels filter
  const visibleLabels = useMemo(() => {
    if (xZoomLevel <= 0 || allLabels.length <= 3) return allLabels;
    const keepCount = Math.max(3, Math.ceil(allLabels.length * (1 - xZoomLevel * 0.25)));
    return allLabels.slice(-keepCount);
  }, [allLabels, xZoomLevel]);

  // Empty state check
  const hasData = activeSeries.some(s => s.points && s.points.length > 0);
  if (!hasData) {
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

  const xOf = (label: string): number => {
    const idx = visibleLabels.indexOf(label);
    if (idx === -1) return plotLeft;
    if (visibleLabels.length === 1) return (plotLeft + plotRight) / 2;
    return plotLeft + (idx / (visibleLabels.length - 1)) * plotWidth;
  };

  const yOf = (value: number): number => {
    const v = clamp(value, 0, safeMax);
    return plotBottom - (v / safeMax) * plotHeight;
  };

  const seriesWithVisiblePoints = useMemo(() => {
    return activeSeries.map(s => {
      // Filter points to only those present in visibleLabels
      const visiblePts = s.points.filter(p => visibleLabels.includes(p.label));
      
      // Sort visiblePts by the order of label in visibleLabels to keep it chronological
      visiblePts.sort((a, b) => visibleLabels.indexOf(a.label) - visibleLabels.indexOf(b.label));

      const coords = visiblePts.map(p => ({
        x: xOf(p.label),
        y: yOf(p.value),
        label: p.label,
        value: p.value
      }));

      // Calculate path
      let linePath = '';
      const n = coords.length;
      if (n > 0) {
        linePath = `M ${coords[0].x.toFixed(2)} ${coords[0].y.toFixed(2)}`;
        for (let i = 1; i < n; i++) {
          const p0 = coords[i - 1];
          const p1 = coords[i];
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
          ? `${linePath} L ${coords[n - 1].x.toFixed(2)} ${plotBottom.toFixed(2)} ` +
            `L ${coords[0].x.toFixed(2)} ${plotBottom.toFixed(2)} Z`
          : '';

      return {
        ...s,
        points: visiblePts,
        coords,
        linePath,
        areaPath
      };
    });
  }, [activeSeries, visibleLabels, plotBottom]);

  // Interactive Hover Handler
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!containerRef.current || visibleLabels.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Scale mouse position to intrinsic VIEW_W
    const svgX = (mouseX / rect.width) * VIEW_W;
    
    // Find nearest label
    let nearestIdx = 0;
    let minDist = Infinity;
    
    visibleLabels.forEach((label, i) => {
      const coordX = xOf(label);
      const dist = Math.abs(coordX - svgX);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    });
    
    setHoveredLabelIndex(nearestIdx);
    
    // Map SVG coordinates back to client coordinates for HTML tooltip positioning
    const activeLabel = visibleLabels[nearestIdx];
    const tooltipX = (xOf(activeLabel) / VIEW_W) * rect.width;
    
    // Find average Y position of all active points on this label for vertical tooltip positioning
    let ySum = 0;
    let yCount = 0;
    
    seriesWithVisiblePoints.forEach(s => {
      const p = s.coords.find(pt => pt.label === activeLabel);
      if (p) {
        ySum += p.y;
        yCount++;
      }
    });
    
    const finalY = yCount > 0 ? ySum / yCount : plotBottom / 2;
    const tooltipY = (finalY / H) * rect.height;
    
    setTooltipPos({ x: tooltipX, y: tooltipY });
  };

  const handleMouseLeave = () => {
    setHoveredLabelIndex(null);
    setTooltipPos(null);
  };

  // Zoom handlers
  const handleXZoomIn = () => {
    if (allLabels.length > 3) {
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

  const maxLabels = 12;
  const step = Math.max(1, Math.ceil(visibleLabels.length / maxLabels));
  const rotate = visibleLabels.length > 6;
  const labelY = plotBottom + (rotate ? 12 : 16);
  const labelChars = rotate ? 8 : 10;

  const visibleLabelIndices = visibleLabels
    .map((_, i) => i)
    .filter((i) => i % step === 0 || i === visibleLabels.length - 1);

  // Compile active hover details
  const activeLabel = hoveredLabelIndex !== null ? visibleLabels[hoveredLabelIndex] : null;
  const hoveredPoints = hoveredLabelIndex !== null && activeLabel
    ? seriesWithVisiblePoints
        .map(s => {
          const pt = s.coords.find(p => p.label === activeLabel);
          return pt ? { name: s.name, color: s.color, value: pt.value } : null;
        })
        .filter((p): p is { name: string; color: string; value: number } => p !== null)
    : [];

  return (
    <div ref={containerRef} className={`w-full relative group/chart ${className}`}>
      {/* Zoom Toolbar */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5 opacity-0 group-hover/chart:opacity-100 transition-opacity duration-200 bg-[#0a0a0b]/80 border border-white/5 p-1 rounded-lg backdrop-blur-md">
        <button
          onClick={handleXZoomIn}
          disabled={xZoomLevel === 3 || allLabels.length <= 3}
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
      {tooltipPos && hoveredLabelIndex !== null && activeLabel && (
        <div
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full bg-[#161827] border border-white/10 text-white rounded-lg px-3 py-2 text-xs shadow-xl flex flex-col gap-1.5 animate-fade-in min-w-[150px]"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y - 12}px`,
          }}
        >
          <span className="font-semibold text-[10px] text-gray-400 uppercase tracking-wider leading-none border-b border-white/5 pb-1">
            {activeLabel}
          </span>
          <div className="flex flex-col gap-1">
            {hoveredPoints.map((hp, idx) => (
              <div key={idx} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hp.color }} />
                  <span className="text-gray-300 font-medium">{hp.name}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-bold text-white">
                    {Number(hp.value.toFixed(1))}%
                  </span>
                  {levelMapping && (
                    <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider leading-none scale-90 origin-right">
                      {levelMapping(hp.value)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
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
          {seriesWithVisiblePoints.map((s, idx) => (
            <linearGradient key={`gradient-${idx}`} id={`lc-area-${uid}-${idx}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
              <stop offset="55%" stopColor={s.color} stopOpacity={0.1} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
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
        {seriesWithVisiblePoints.map((s, idx) => {
          if (s.coords.length > 1 && s.areaPath) {
            return (
              <path
                key={`area-${idx}`}
                d={s.areaPath}
                fill={`url(#lc-area-${uid}-${idx})`}
                stroke="none"
              />
            );
          }
          return null;
        })}

        {/* Vertical hover guide-line */}
        {hoveredLabelIndex !== null && activeLabel && (
          <line
            x1={xOf(activeLabel)}
            y1={plotTop}
            x2={xOf(activeLabel)}
            y2={plotBottom}
            stroke={seriesWithVisiblePoints[0]?.color || accent}
            strokeOpacity={0.25}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* Horizontal hover guide-line and level indicator label (only when single series) */}
        {hoveredLabelIndex !== null && activeLabel && seriesWithVisiblePoints.length === 1 && (
          <g>
            <line
              x1={plotLeft}
              y1={seriesWithVisiblePoints[0].coords.find(c => c.label === activeLabel)?.y ?? plotBottom}
              x2={plotRight}
              y2={seriesWithVisiblePoints[0].coords.find(c => c.label === activeLabel)?.y ?? plotBottom}
              stroke={seriesWithVisiblePoints[0].color}
              strokeOpacity={0.2}
              strokeWidth={1}
              strokeDasharray="3 3"
              vectorEffect="non-scaling-stroke"
            />
            {levelMapping && (
              <text
                x={plotRight - 6}
                y={(seriesWithVisiblePoints[0].coords.find(c => c.label === activeLabel)?.y ?? plotBottom) - 4}
                textAnchor="end"
                fontSize={9}
                fontWeight={700}
                fill={seriesWithVisiblePoints[0].color}
                fillOpacity={0.8}
                className="uppercase tracking-wider select-none font-semibold"
              >
                {levelMapping(seriesWithVisiblePoints[0].coords.find(c => c.label === activeLabel)?.value ?? 0)}
              </text>
            )}
          </g>
        )}

        {/* The trend line (2+ points only) */}
        {seriesWithVisiblePoints.map((s, idx) => {
          if (s.coords.length > 1 && s.linePath) {
            return (
              <path
                key={`line-${idx}`}
                d={s.linePath}
                fill="none"
                stroke={s.color}
                strokeWidth={2.2}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          }
          return null;
        })}

        {/* Data dots */}
        {seriesWithVisiblePoints.flatMap((s, sIdx) => {
          return s.coords.map((c, i) => {
            const isHovered = hoveredLabelIndex !== null && activeLabel === c.label;
            const isLast = i === s.coords.length - 1 && hoveredLabelIndex === null;

            if (isHovered || isLast) {
              return (
                <g key={`dot-${sIdx}-${i}`}>
                  {/* Glowing halo */}
                  <circle cx={c.x} cy={c.y} r={8} fill={s.color} fillOpacity={0.22} className="animate-pulse" />
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={4}
                    fill={s.color}
                    stroke="#ffffff"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            }

            return (
              <circle
                key={`dot-${sIdx}-${i}`}
                cx={c.x}
                cy={c.y}
                r={2.8}
                fill={s.color}
                stroke="#0a0a0a"
                strokeWidth={1}
                strokeOpacity={0.4}
                vectorEffect="non-scaling-stroke"
                className="hover:scale-150 transition-transform duration-200"
              />
            );
          });
        })}

        {/* X-axis labels */}
        {visibleLabelIndices.map((idx) => {
          const label = visibleLabels[idx];
          const cX = xOf(label);
          const text = truncate(label, labelChars);
          const isActive = hoveredLabelIndex !== null && visibleLabels[hoveredLabelIndex] === label;
          
          if (rotate) {
            return (
              <text
                key={`xlabel-${label}`}
                x={cX}
                y={labelY}
                fontSize={10}
                fill={isActive ? '#ffffff' : MUTED}
                fontWeight={isActive ? 700 : 400}
                textAnchor="end"
                transform={`rotate(-40 ${cX} ${labelY})`}
              >
                {text}
              </text>
            );
          }
          return (
            <text
              key={`xlabel-${label}`}
              x={cX}
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
