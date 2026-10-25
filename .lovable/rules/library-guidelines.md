# Truth Weaver — Guidelines

## Components

The design system exports these components — import them from `@ws-0dfe240cdcdbfcf99736/8ef43cd3-8d93-4494-a685-59ce0f795614` and compose them before building anything from scratch:

`AppShell`, `AuthorityChip`, `CartDrawer`, `Constants`, `CounselPage`, `Field`, `IntegrationBadge`, `IssueTriageBanner`, `LegalNavigator`, `OcrUnreadableError`, `Panel`, `ProductCard`, `SheetClose`, `SheetContent`, `SheetDescription`, `SheetFooter`, `SheetHeader`, `SheetOverlay`, `SheetPortal`, `SheetTitle`, `SheetTrigger`, `Sheet`, `ShopifyAdminUnavailable`, `ShopifyCustomerConnect`, `SiteChrome`, `StateBox`, `StatusPill`, `TruthBadge`, `WorkspaceNav`

Per-component details (import stanzas, props, variants, examples) live in `.lovable/rules/libraries/{slug}/components.md` — on disk, not auto-loaded. Read that file or the component source when the name alone isn't enough.

## Theme Files

The design system's theme is delivered through the following files. The author's original source files carry the full wiring the design system needs — variable declarations, framework-specific directives, provider objects, etc. — and are the canonical import target.

- `@ws-0dfe240cdcdbfcf99736/8ef43cd3-8d93-4494-a685-59ce0f795614/styles.css` (source — preferred import)
- `@ws-0dfe240cdcdbfcf99736/8ef43cd3-8d93-4494-a685-59ce0f795614/dist/tokens.css` (auto-generated flat list of CSS custom properties — a raw-values fallback only; does NOT carry framework-specific wiring that the source files above provide)

