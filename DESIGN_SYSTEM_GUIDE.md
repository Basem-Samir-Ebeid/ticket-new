# Design System Implementation Guide

## Quick Start

The ticket system now uses a centralized design system located at `src/config/design.js`. All components should import and use these design tokens for consistency.

## How to Use the Design System

### Basic Import

```javascript
import {
  COLORS,
  SPACING,
  BORDER_RADIUS,
  SHADOWS,
  getAccentColor,
  COMMON_STYLES,
  PRIORITY_BADGE_STYLES,
  STATUS_BADGE_STYLES,
} from '../config/design'
```

### Color Usage

#### Primary Accent Color (Adapts to User Role)

```javascript
const accentColor = getAccentColor(isSuperAdmin)
// Returns: '#f59e0b' for super admin, '#6366f1' for admin
```

#### Status Colors

```javascript
// For status badges
const statusStyle = {
  background: `${statusColor}15`,
  color: statusColor,
  border: `1px solid ${statusColor}35`,
}
```

#### Priority Colors

```javascript
import { PRIORITY_BADGE_STYLES } from '../config/design'

const priorityStyle = PRIORITY_BADGE_STYLES[ticketPriority]
// Results in: { label, color, background, border, glow }
```

### Spacing

```javascript
import { SPACING } from '../config/design'

// Use predefined spacing values
style={{ 
  padding: SPACING.lg,      // 16px
  margin: SPACING.md,        // 12px
  gap: SPACING.sm,           // 8px
}}
```

### Common Component Styles

For consistent styling across the app, use pre-defined style objects:

```javascript
import { COMMON_STYLES } from '../config/design'

// Card styling
<div style={COMMON_STYLES.cardBg}>Card content</div>

// Input styling
<input style={COMMON_STYLES.inputBg} />

// Filter area styling
<div style={COMMON_STYLES.filterBg}>Filters</div>

// Empty state
<div style={COMMON_STYLES.emptyState}>No data</div>

// Divider line
<div style={COMMON_STYLES.divider} />
```

## Color Palette Reference

### Semantic Colors
- **Primary**: `#6366f1` (Indigo for Admin)
- **Primary Alt**: `#f59e0b` (Amber for Super Admin)
- **Success**: `#10b981` (Emerald)
- **Warning**: `#f59e0b` (Amber)
- **Error**: `#ef4444` (Red)
- **Info**: `#6366f1` (Indigo)

### Status Colors
- **Open**: `#6366f1` (Indigo)
- **Pending**: `#f59e0b` (Amber)
- **Solved**: `#10b981` (Emerald)
- **Merged**: `#64748b` (Slate)

### Priority Colors
- **Low**: `#22c55e` (Green)
- **Medium**: `#eab308` (Yellow)
- **High**: `#f97316` (Orange)
- **Urgent**: `#ef4444` (Red)

### Neutral Colors
- **Slate-50**: `#f8fafc`
- **Slate-100**: `#f1f5f9`
- **Slate-400**: `#94a3b8`
- **Slate-500**: `#64748b`
- **Slate-900**: `#0f172a`

## Helper Functions

### getAccentColor(isSuperAdmin)
Returns the appropriate accent color based on user role.

```javascript
const accentColor = getAccentColor(isSuperAdmin)
```

### getAccentGradient(isSuperAdmin)
Returns a gradient suitable for buttons or backgrounds based on user role.

```javascript
const gradient = getAccentGradient(isSuperAdmin)
// Use with: style={{ background: gradient }}
```

### getAccentGlow(isSuperAdmin)
Returns a box-shadow value for glow effects based on user role.

```javascript
const glow = getAccentGlow(isSuperAdmin)
// Use with: style={{ boxShadow: glow }}
```

## Badge Creation

### Automatic Badge Styling

```javascript
import { STATUS_BADGE_STYLES, PRIORITY_BADGE_STYLES } from '../config/design'

// Status badge
const status = STATUS_BADGE_STYLES.opened
// Returns: { label: 'Open', color, dot, background, border }

// Priority badge
const priority = PRIORITY_BADGE_STYLES.urgent
// Returns: { label: 'Urgent', color, background, border, glow }
```

### Custom Badge Factory

```javascript
import { createBadgeStyle } from '../config/design'

const customBadge = createBadgeStyle('type', 'indigo')
// Returns: { background, color, border, dot }
```

## Best Practices

### 1. Always Use Design Tokens
❌ Bad:
```javascript
<div style={{ color: '#6366f1', background: 'rgba(99,102,241,0.2)' }}>
```

✅ Good:
```javascript
import { COLORS } from '../config/design'
<div style={{ color: COLORS.primary }}>
```

### 2. Use Helper Functions for Role-Based Colors
❌ Bad:
```javascript
const color = isSuperAdmin ? '#f59e0b' : '#6366f1'
```

✅ Good:
```javascript
import { getAccentColor } from '../config/design'
const color = getAccentColor(isSuperAdmin)
```

### 3. Use Common Styles for Consistency
❌ Bad:
```javascript
style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
```

✅ Good:
```javascript
import { COMMON_STYLES } from '../config/design'
style={COMMON_STYLES.cardBg}
```

### 4. Leverage Badge Styles
❌ Bad:
```javascript
<span style={{
  background: `${color}15`,
  color: color,
  border: `1px solid ${color}35`
}}>Badge</span>
```

✅ Good:
```javascript
import { PRIORITY_BADGE_STYLES } from '../config/design'
<span style={PRIORITY_BADGE_STYLES[priority]}>Badge</span>
```

## Adding New Design Tokens

If you need to add new colors or styles:

1. Open `src/config/design.js`
2. Add your token to the appropriate export object
3. Update this guide with the new token
4. Use the token in your components

Example:
```javascript
// In src/config/design.js
export const SPECIAL_COLORS = {
  customColor: '#...',
}

// In your component
import { SPECIAL_COLORS } from '../config/design'
```

## Migration Guide

### Converting Existing Components

If you're updating an existing component:

1. **Identify inline styles**
   ```javascript
   // OLD
   style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
   
   // NEW
   import { COMMON_STYLES } from '../config/design'
   style={COMMON_STYLES.cardBg}
   ```

2. **Replace hardcoded colors**
   ```javascript
   // OLD
   const accentColor = isSuperAdmin ? '#f59e0b' : '#6366f1'
   
   // NEW
   import { getAccentColor } from '../config/design'
   const accentColor = getAccentColor(isSuperAdmin)
   ```

3. **Use badge factories**
   ```javascript
   // OLD
   color: PRIORITY_MAP[priority].color
   
   // NEW
   import { PRIORITY_BADGE_STYLES } from '../config/design'
   ...PRIORITY_BADGE_STYLES[priority]
   ```

## Components Using Design System

Currently integrated:
- TicketList.jsx
- TicketDetail.jsx
- TicketCreateModal.jsx
- Sidebar.jsx

## Troubleshooting

### Colors not applying?
- Check that you've imported from `src/config/design.js`
- Verify the path is correct (adjust `../` as needed)
- Check for CSS conflicts with Tailwind classes

### Type mismatch errors?
- Ensure you're destructuring the correct exports
- Verify property names match exactly
- Check TypeScript type definitions if using TS

### Performance issues?
- Design tokens are constants and don't impact performance
- Consider memoizing components if re-renders are excessive
- Use React DevTools Profiler for optimization

## Support

For questions or issues with the design system:
1. Check this guide first
2. Review `src/config/design.js` source code
3. Look at existing components for usage examples
4. Consult the refactoring summary for context

---

**Last Updated**: June 2026
**Version**: 1.0
