# Grad Tracker Frontend

## Project Overview
A graduation progress tracking application built with Next.js, React, and Chakra UI v3.

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **UI Library**: Chakra UI v3
- **Language**: TypeScript
- **Styling**: Chakra UI's built-in styling system (no Tailwind)

## Using the Chakra UI MCP

This project has the Chakra UI MCP server configured. **Always use these MCP tools when working with UI:**

### Available MCP Tools
1. **`mcp__chakra-ui__get_component_props`** - Get props and configuration for any component
2. **`mcp__chakra-ui__get_component_example`** - Get example code for components
3. **`mcp__chakra-ui__list_components`** - List all available Chakra UI components
4. **`mcp__chakra-ui__get_theme`** - Get theme tokens (colors, spacing, etc.)
5. **`mcp__chakra-ui__v2_to_v3_code_review`** - Review code for v3 compatibility
6. **`mcp__chakra-ui__customize_theme`** - Get guidance on theme customization

### Workflow for Creating UI
1. **Before writing any component**, use `get_component_props` to understand available props
2. **Use `get_component_example`** to see correct usage patterns
3. **Always use `v2_to_v3_code_review`** after writing components to catch v2 patterns

## Component Structure

### Pre-built Components (src/components/ui/)
These wrappers are already configured - use them instead of importing directly from @chakra-ui/react:
- `provider.tsx` - Chakra Provider (already in layout)
- `button.tsx` - Button with loading states
- `toaster.tsx` - Toast notifications
- `color-mode.tsx` - Light/dark mode toggle
- And many more...

### Custom Components
Place custom components in `src/components/` (outside the ui folder).

## Styling Guidelines

### Use Semantic Tokens
```tsx
// Good - uses semantic tokens that adapt to color mode
<Box bg="bg.subtle" color="fg.muted" />

// Avoid - hard-coded colors don't adapt
<Box bg="gray.100" color="gray.600" />
```

### Common Semantic Tokens
- Backgrounds: `bg`, `bg.subtle`, `bg.muted`, `bg.emphasized`, `bg.panel`
- Foreground: `fg`, `fg.muted`, `fg.subtle`
- Borders: `border`, `border.muted`, `border.subtle`

### Layout Components
- Use `Stack`, `HStack`, `VStack` for flex layouts
- Use `Grid` and `SimpleGrid` for grid layouts
- Use `Container` for max-width content
- Use `Box` for generic containers

### Spacing
Use the spacing scale: `1`, `2`, `3`, `4`, `5`, `6`, `8`, `10`, `12`, `16`, `20`, `24`
```tsx
<Stack gap="4">  // 16px gap
<Box p="6">      // 24px padding
```

## Common Commands
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run lint     # Run ESLint
```

## File Structure
```
src/
├── app/              # Next.js App Router pages
│   ├── layout.tsx    # Root layout with Chakra Provider
│   └── page.tsx      # Home page
├── components/
│   └── ui/           # Chakra UI component wrappers (auto-generated)
└── lib/              # Utilities and helpers
```

## Important Notes for AI Assistants

1. **This is Chakra UI v3** - The API is different from v2. Always verify with MCP tools.
2. **No Tailwind** - Use Chakra's style props instead of utility classes
3. **Use the Provider** - Already configured in `src/app/layout.tsx`
4. **Import from wrappers** - Import from `@/components/ui/` when available, fall back to `@chakra-ui/react`
5. **Check examples first** - Use MCP tools to see correct patterns before writing code
