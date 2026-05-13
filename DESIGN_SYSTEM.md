# AI Coach SAI - Design System Documentation

This document explains how to use the design system when adding new components or pages to this project.

---

## Quick Start

When creating a new page or component, follow these steps:

### 1. Use Design System Components

Import UI components from the component library:

```tsx
import { 
  GlassCard, 
  Button, 
  Input, 
  Header, 
  Section, 
  SectionHeader, 
  Container,
  FeatureCard,
  AmbientGlow 
} from './components/ui';
```

### 2. Wrap Your Page

Every page should follow this structure:

```tsx
<div className="min-h-screen bg-grid">
  <AmbientGlow color="amber" size="lg" position="top-left" className="z-0" />
  <AmbientGlow color="teal" size="md" position="bottom-right" className="z-0" />
  
  <Header />
  
  <main className="pt-28 pb-12">
    <Section>
      <Container>
        {/* Your content here */}
      </Container>
    </Section>
  </main>
</div>
```

---

## Available Components

### GlassCard
Base container with glassmorphism effect.

```tsx
<GlassCard padding="md" hover>
  <h3>Card Title</h3>
  <p>Card content...</p>
</GlassCard>
```

Props:
- `padding`: 'none' | 'sm' | 'md' | 'lg' (default: 'md')
- `hover`: boolean - adds hover effects
- `className`: string

### Button
Primary call-to-action button.

```tsx
<Button variant="primary" size="md" icon={<Icon />}>
  Button Text
</Button>
```

Variants:
- `primary` - Amber gradient (main CTA)
- `secondary` - Teal gradient
- `ghost` - Transparent with border
- `danger` - Red for destructive actions

### Input / Textarea / Select
Styled form inputs.

```tsx
<Input 
  label="Email" 
  type="email" 
  placeholder="Enter email"
/>

<Textarea 
  label="Message"
  placeholder="Your message"
/>

<Select 
  label="Country"
  options={[
    { value: 'in', label: 'India' },
    { value: 'us', label: 'USA' }
  ]}
/>
```

### Section & SectionHeader
Page sections with consistent structure.

```tsx
<Section>
  <Container>
    <SectionHeader
      eyebrow="Eyebrow Text"
      eyebrowColor="amber"  // amber, teal, emerald, purple
      title="Section Title"
      subtitle="Optional subtitle text"
    />
    {/* Section content */}
  </Container>
</Section>
```

### FeatureCard
Card with icon for features.

```tsx
<FeatureCard
  icon={<Icon />}
  iconColor="amber"  // amber, teal, emerald, purple
  title="Feature Title"
  description="Feature description text"
/>
```

### Header
Frosted glass navigation header.

```tsx
<Header>
  {/* Optional custom nav content */}
</Header>
```

### AmbientGlow
Floating ambient light blobs.

```tsx
<AmbientGlow 
  color="amber"  // amber, teal, emerald, purple
  size="lg"     // sm, md, lg, xl
  position="top-left"  // top-left, top-right, bottom-left, bottom-right
/>
```

---

## CSS Utilities

The following CSS classes are available:

### Backgrounds
- `bg-grid` - Subtle tech grid pattern
- `min-h-screen` - Full viewport height

### Glass Effects
- `glass-card` - Glassmorphism card
- `glass-card-hover` - Interactive hover state
- `glass-input` - Form input with glass effect

### Text Effects
- `text-gradient-amber` - Amber gradient text
- `text-gradient-teal` - Teal gradient text
- `text-gradient-emerald` - Emerald gradient text
- `text-gradient-purple` - Purple gradient text
- `text-muted` - Muted text (60% opacity)
- `text-subtle` - Subtle text (40% opacity)

### Glow Effects
- `amber-glow` - Amber box shadow glow
- `teal-glow` - Teal box shadow glow

### Icon Containers
- `icon-container` - Base icon container
- `icon-container-amber` - Amber tinted
- `icon-container-teal` - Teal tinted
- `icon-container-emerald` - Emerald tinted
- `icon-container-purple` - Purple tinted

### Buttons
- `btn-primary` - Amber gradient button
- `btn-secondary` - Teal gradient button
- `btn-ghost` - Transparent button

---

## Design Tokens

Design tokens are available in `src/lib/design-tokens.ts`:

```ts
import { colors, spacing, typography, borderRadius, shadows } from '@/lib/design-tokens';
```

---

## Adding New Components

When adding a new reusable component:

### 1. Create in UI Library

Add new components to `src/app/components/ui/`:

```tsx
// src/app/components/ui/NewComponent.tsx
export function NewComponent({ ...props }) {
  return <div className="glass-card">...</div>;
}
```

### 2. Export from Index

Add export to `src/app/components/ui/index.ts`:

```ts
export { NewComponent } from './NewComponent';
```

### 3. Use in Pages

Import and use in your pages:

```tsx
import { NewComponent } from './components/ui';

<NewComponent prop="value" />
```

---

## Color Palette

| Color | Usage |
|-------|-------|
| Amber | Primary brand, CTAs, highlights |
| Teal | Secondary brand, success states |
| Emerald | Success, mentor themes |
| Purple | Platform, admin, special features |

---

## Iconography

Use `lucide-react` icons throughout the project:

```tsx
import { IconName } from 'lucide-react';

<IconName className="w-5 h-5" />
```

Common sizes: `14`, `16`, `18`, `20`, `24`, `32`

---

## Animation Classes

- `animate-fade-in-up` - Fade in from below
- `animate-delay-100` through `animate-delay-500` - Staggered delays

---

## Best Practices

1. **Always use GlassCard** for containers - Never use plain divs for cards
2. **Use consistent padding** - `p-6` or `p-8` for cards, `py-16` or `py-20` for sections
3. **Include ambient glows** - Add `AmbientGlow` to pages for that "AI" feel
4. **Use gradients for CTAs** - Never use solid colors for primary buttons
5. **Maintain contrast** - Use `text-muted` for body, pure white for headings
6. **Follow spacing** - Use `gap-4`, `gap-6`, `gap-8` for grids

---

## File Structure

```
src/
├── app/
│   ├── components/
│   │   └── ui/           # Reusable UI components
│   │       ├── Button.tsx
│   │       ├── GlassCard.tsx
│   │       ├── Input.tsx
│   │       ├── Section.tsx
│   │       ├── Header.tsx
│   │       ├── FeatureCard.tsx
│   │       ├── AmbientGlow.tsx
│   │       └── index.ts
│   ├── globals.css       # Global styles & utilities
│   └── page.tsx
└── lib/
    └── design-tokens.ts  # Design tokens
```

---

## Troubleshooting

### Glow effects not showing?
Make sure the parent has `min-h-screen` and `bg-grid` classes.

### Glass effect not visible?
Ensure the background has `bg-grid` so the transparency is visible.

### Icons not importing?
Install lucide-react: `npm install lucide-react`

### Classes not working?
Make sure Tailwind is configured in `globals.css` with the theme.