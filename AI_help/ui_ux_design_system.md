# AI Coach SAI - UI/UX Design System & Implementation Guide

This document is specifically crafted for AI coding assistants. It provides a highly detailed, token-level breakdown of the UI/UX architecture for the "AI Coach SAI" project. By following these exact specifications, any AI model can replicate this premium, modern, glassmorphic dark-theme design in another project.

---

## 1. Core Visual Identity

The project utilizes a **premium dark mode** aesthetic characterized by:
- Deep space-like backgrounds with subtle grid overlays.
- Heavy use of **Glassmorphism** (frosted glass effects).
- **Glow effects** (neon shadows and ambient radial blobs).
- **Vibrant Gradients** for primary actions and text emphasis.

### 1.1. Color Palette (OKLCH & HEX)
The core theme uses OKLCH color spaces for rich, consistent perceptual lightness, but HEX fallbacks are provided for CSS compatibility.

**Backgrounds:**
- Base Background: `oklch(0.1 0.01 260)` (approx. `#0d0f1a`)
- Card Background: `oklch(0.15 0.015 260)`
- Sidebar: `oklch(0.12 0.015 260)`

**Primary Brand Accents:**
- **Amber (Primary):** `oklch(0.75 0.18 50)` / Gradient: `linear-gradient(135deg, #fb923c, #f59e0b)`
- **Teal (Secondary):** `oklch(0.65 0.15 185)` / Gradient: `linear-gradient(135deg, #14b8a6, #06b6d4)`
- **Emerald (Success/Mentor):** Gradient `linear-gradient(135deg, #10b981, #059669)`
- **Purple (Platform/Admin):** Gradient `linear-gradient(135deg, #8b5cf6, #7c3aed)`

**Typography Colors:**
- Foreground/Base Text: `oklch(0.96 0 0)` (near white)
- Muted/Secondary Text: `text-white/60`, `text-white/50`, `text-white/40`
- Borders: `oklch(1 0 0 / 8%)` or `rgba(255, 255, 255, 0.08)`

---

## 2. Core CSS Utilities & Classes

To replicate the design, inject these exact CSS rules into the global stylesheet.

### 2.1. Backgrounds & Overlays
```css
body {
  background-color: #0d0f1a;
  color: oklch(0.96 0 0);
  /* Ambient glow behind the entire app */
  background-image:
    radial-gradient(ellipse 80% 50% at 20% -10%, rgba(251, 146, 60, 0.07) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 100%, rgba(20, 184, 166, 0.05) 0%, transparent 60%);
}

/* Subtle tech grid background */
.bg-grid {
  background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

### 2.2. Glassmorphism Architecture
This is the most critical UI component. Apply this to all cards, containers, and modules.
```css
.glass-card {
  background: rgba(255, 255, 255, 0.04);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  border-radius: 1rem; /* rounded-2xl or 3xl depending on size */
}

/* Interactive Glass Cards */
.glass-card-hover {
  transition: all 0.2s ease;
}
.glass-card-hover:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  /* Adds a subtle amber rim light on hover */
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(251, 146, 60, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transform: translateY(-1px);
}
```

### 2.3. Text & Box Glows
```css
.text-gradient-amber {
  background: linear-gradient(135deg, #fb923c, #f59e0b);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.text-gradient-teal {
  background: linear-gradient(135deg, #14b8a6, #06b6d4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.amber-glow {
  box-shadow: 0 0 20px rgba(251, 146, 60, 0.3), 0 0 60px rgba(251, 146, 60, 0.1);
}
.teal-glow {
  box-shadow: 0 0 20px rgba(20, 184, 166, 0.3), 0 0 60px rgba(20, 184, 166, 0.1);
}
```

### 2.4. Scrollbars
```css
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}
```

---

## 3. Structural Patterns & Component Blueprints

When building UI components in React/Next.js, use these exact Tailwind structural patterns.

### 3.1. Primary Call-to-Action (CTA) Buttons
Buttons are heavily styled with gradients, glow effects, and scale animations.
```tsx
// Primary Amber Button Pattern
<button 
  className="group flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-black transition-all hover:scale-105"
  style={{ 
    background: "linear-gradient(135deg, #fb923c, #f59e0b)", 
    boxShadow: "0 0 30px rgba(251, 146, 60, 0.3)" 
  }}
>
  Start Action
  {/* The arrow translates slightly to the right on group hover */}
  <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
</button>
```

### 3.2. Navigation Bar (Frosted Glass Header)
```tsx
<nav 
  className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4"
  style={{ 
    background: "rgba(10,12,24,0.8)", 
    backdropFilter: "blur(20px)", 
    borderBottom: "1px solid rgba(255,255,255,0.06)" 
  }}
>
  {/* Content */}
</nav>
```

### 3.3. Floating Ambient Blobs (Hero Sections)
Always include floating color orbs in hero/header sections to give the "AI" vibe.
```tsx
{/* Absolute positioned behind content, pointer-events-none so it doesn't block clicks */}
<div 
  className="absolute top-20 left-1/4 w-96 h-96 rounded-full pointer-events-none"
  style={{ background: "radial-gradient(circle, rgba(251,146,60,0.08) 0%, transparent 70%)" }} 
/>
```

### 3.4. Section Headers
Use a consistent hierarchy: Small colored uppercase eyebrow text, bold white main heading, muted subtitle.
```tsx
<div className="text-center mb-14">
  <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-3">
    Eyebrow Text
  </p>
  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
    Main Section Title
  </h2>
  <p className="text-white/40 max-w-xl mx-auto">
    Muted descriptive subtitle text goes here.
  </p>
</div>
```

### 3.5. Feature/Icon Cards
Cards use `.glass-card` and have a distinct colored icon container.
```tsx
<div className="glass-card glass-card-hover rounded-2xl p-6">
  {/* Icon Container with tinted background & border matching the icon color */}
  <div 
    className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
    style={{
      background: "rgba(251,146,60,0.12)",
      border: "1px solid rgba(251,146,60,0.2)"
    }}
  >
    <LucideIcon size={18} className="text-amber-400" />
  </div>
  <h3 className="text-white font-semibold mb-2">Card Title</h3>
  <p className="text-sm text-white/40 leading-relaxed">
    Card description with relaxed line height.
  </p>
</div>
```

---

## 4. UI/UX Rules & Constraints for AI Agents

When expanding this project or applying this design system elsewhere, the AI **MUST** follow these rules:

1. **Never use solid flat colors for backgrounds.** Always use `rgba()` or `oklch` with transparency to allow the `bg-grid` and ambient blobs to bleed through.
2. **Never use standard border colors.** Borders must always be highly transparent (e.g., `rgba(255,255,255,0.06)` or `0.08`). Hard borders ruin the glass effect.
3. **Typography Contrast:** 
   - Headings: Pure white or text-gradient.
   - Body text: `text-white/50` or `text-white/40` (never pure white, to reduce eye strain).
   - Micro-copy/Labels: `text-xs text-white/30`.
4. **Interactive States:** 
   - Buttons must have `hover:scale-105` and `transition-all`.
   - Cards must have `.glass-card-hover` to slightly elevate (`translateY(-1px)`) and brighten the border on hover.
5. **Iconography:** Use `lucide-react` icons exclusively. Icons should generally be sized at `14`, `16`, `18`, or `24` pixels.
6. **Layout Spacing:** Use generous padding (e.g., `py-20` for sections, `p-6` or `p-10` for cards, `gap-5` or `gap-8` for grids) to create a breathable, premium feel.

### Summary of Prompt for AI implementation:
If you are an AI tasked with generating a page for this system, inject `globals.css` with the CSS provided above, wrap the page in `<div className="min-h-screen bg-grid">`, apply `<div className="glass-card">` to all containers, and heavily utilize `text-gradient-amber`, `amber-glow`, and deep transparent borders. Ensure buttons use the exact inline style gradients provided in section 3.1.
