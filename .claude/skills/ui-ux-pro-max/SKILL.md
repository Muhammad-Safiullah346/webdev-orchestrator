---
name: ui-ux-pro-max
description: "UI/UX design intelligence for WEB development. 67 styles, 161 palettes, 57 font pairings, 25 charts, 12 web stacks (React, Next.js, Vue, Svelte, Astro, Nuxt, Nuxt UI, Tailwind/HTML, shadcn/ui, Three.js, Angular, Laravel). Actions: plan, build, create, design, implement, review, fix, improve, optimize, enhance, refactor, check UI/UX code. Projects: website, landing page, dashboard, admin panel, e-commerce, SaaS, portfolio, blog, web app, .html, .tsx, .vue, .svelte. Elements: button, modal, navbar, sidebar, card, table, form, chart. Styles: glassmorphism, claymorphism, minimalism, brutalism, neumorphism, bento grid, dark mode, responsive, skeuomorphism, flat design. Topics: color palette, accessibility, animation, layout, typography, font pairing, spacing, hover, shadow, gradient. Integrations: shadcn/ui MCP for component search and examples."
---
# UI/UX Pro Max - Design Intelligence

Comprehensive design guide for **web applications**. Contains 67 styles, 161 color palettes, 57 font pairings, 99 UX guidelines, and 25 chart types across 12 web technology stacks. Searchable database with priority-based recommendations.

## When to Apply

当任务涉及 **UI 结构、视觉设计决策、交互模式或用户体验质量控制** 时，应使用此 Skill。

### Must Use

在以下情况必须调用此 Skill：

- 设计新的页面（Landing Page、Dashboard、Admin、SaaS、Web App）
- 创建或重构 UI 组件（按钮、弹窗、表单、表格、图表等）
- 选择配色方案、字体系统、间距规范或布局体系
- 审查 UI 代码的用户体验、可访问性或视觉一致性
- 实现导航结构、动效或响应式行为
- 做产品层级的设计决策（风格、信息层级、品牌表达）
- 提升界面的感知质量、清晰度或可用性

### Recommended

在以下情况建议使用此 Skill：

- UI 看起来"不够专业"，但原因不明确
- 收到可用性或体验方面的反馈
- 准备上线前的 UI 质量优化
- 需要确保跨浏览器、响应式的一致 Web 体验
- 构建设计系统或可复用组件库

### Skip

在以下情况无需使用此 Skill：

- 纯后端逻辑开发
- 仅涉及 API 或数据库设计
- 与界面无关的性能优化
- 基础设施或 DevOps 工作
- 非视觉类脚本或自动化任务

**判断准则**：如果任务会改变某个功能 **看起来如何、使用起来如何、如何运动或如何被交互**，就应该使用此 Skill。

## Rule Categories by Priority

*供人工/AI 查阅：按 1→10 决定先关注哪类规则；需要细则时用 `--domain <Domain>` 查询。脚本不读取本表。*

| Priority | Category | Impact | Domain | Key Checks (Must Have) | Anti-Patterns (Avoid) |
|----------|----------|--------|--------|------------------------|------------------------|
| 1 | Accessibility | CRITICAL | `ux` | Contrast 4.5:1, Alt text, Keyboard nav, Aria-labels | Removing focus rings, Icon-only buttons without labels |
| 2 | Interaction | CRITICAL | `ux` | Click target 44×44px, 8px+ spacing, Loading feedback | Reliance on hover only, Instant state changes (0ms) |
| 3 | Performance | HIGH | `ux` | WebP/AVIF, Lazy loading, Reserve space (CLS &lt; 0.1) | Layout thrashing, Cumulative Layout Shift |
| 4 | Style Selection | HIGH | `style`, `product` | Match product type, Consistency, SVG icons (no emoji) | Mixing flat & skeuomorphic randomly, Emoji as icons |
| 5 | Layout & Responsive | HIGH | `ux` | Mobile-first breakpoints, Viewport meta, No horizontal scroll | Horizontal scroll, Fixed px container widths, Disable zoom |
| 6 | Typography & Color | MEDIUM | `typography`, `color` | Base 16px, Line-height 1.5, Semantic color tokens | Text &lt; 12px body, Gray-on-gray, Raw hex in components |
| 7 | Animation | MEDIUM | `ux` | Duration 150–300ms, Motion conveys meaning, Spatial continuity | Decorative-only animation, Animating width/height, No reduced-motion |
| 8 | Forms & Feedback | MEDIUM | `ux` | Visible labels, Error near field, Helper text, Progressive disclosure | Placeholder-only label, Errors only at top, Overwhelm upfront |
| 9 | Navigation Patterns | HIGH | `ux` | Predictable back, Clear active state, Deep linking | Overloaded nav, Broken back behavior, No deep links |
| 10 | Charts & Data | LOW | `chart` | Legends, Tooltips, Accessible colors | Relying on color alone to convey meaning |

## Quick Reference

### 1. Accessibility (CRITICAL)

- `color-contrast` - Minimum 4.5:1 ratio for normal text (large text 3:1); WCAG AA
- `focus-states` - Visible focus rings on interactive elements (2–4px; never remove `:focus-visible`)
- `alt-text` - Descriptive alt text for meaningful images; empty alt for decorative
- `aria-labels` - aria-label / aria-labelledby for icon-only buttons and unlabeled controls
- `keyboard-nav` - Tab order matches visual order; full keyboard support; no keyboard traps
- `form-labels` - Use `<label>` with `for` attribute
- `skip-links` - Skip to main content for keyboard users
- `heading-hierarchy` - Sequential h1→h6, no level skip
- `color-not-only` - Don't convey info by color alone (add icon/text)
- `text-scaling` - Support browser zoom to 200% and rem-based text; avoid truncation as text grows (WCAG reflow)
- `reduced-motion` - Respect `prefers-reduced-motion`; reduce/disable animations when requested
- `screen-reader` - Meaningful accessible names and logical DOM reading order for screen readers (NVDA/JAWS/VoiceOver)
- `escape-routes` - Provide cancel/close in modals and multi-step flows (Esc key + visible control)
- `keyboard-alternatives` - Offer keyboard alternatives for drag-and-drop and pointer-only interactions

### 2. Interaction (CRITICAL)

- `click-target-size` - Min 44×44px interactive area; extend hit area beyond visual bounds if needed
- `target-spacing` - Minimum 8px gap between adjacent click/tap targets
- `hover-vs-click` - Use click for primary interactions; never rely on hover alone (fails on touch + keyboard)
- `loading-buttons` - Disable button during async operations; show spinner or progress
- `error-feedback` - Clear error messages near the problem
- `cursor-pointer` - Add `cursor: pointer` to clickable elements
- `tap-delay` - Use `touch-action: manipulation` to remove the 300ms tap delay on touch screens
- `press-feedback` - Visual feedback on press/active (color/opacity/elevation change)
- `gesture-alternative` - Never rely on gesture-only interactions; always provide visible controls for critical actions
- `no-precision-required` - Avoid requiring pixel-perfect clicks on tiny icons or thin edges
- `disabled-affordance` - Disabled controls must look disabled and be non-interactive (not just visually dimmed)

### 3. Performance (HIGH)

- `image-optimization` - Use WebP/AVIF, responsive images (srcset/sizes), lazy load non-critical assets
- `image-dimension` - Declare width/height or use aspect-ratio to prevent layout shift (Core Web Vitals: CLS)
- `font-loading` - Use font-display: swap/optional to avoid invisible text (FOIT); reserve space to reduce layout shift
- `font-preload` - Preload only critical fonts; avoid overusing preload on every variant
- `critical-css` - Prioritize above-the-fold CSS (inline critical CSS or early-loaded stylesheet)
- `lazy-loading` - Lazy load non-hero components via dynamic import / route-level splitting
- `bundle-splitting` - Split code by route/feature (React Suspense / Next.js dynamic) to reduce initial load and TTI
- `third-party-scripts` - Load third-party scripts async/defer; audit and remove unnecessary ones
- `reduce-reflows` - Avoid frequent layout reads/writes; batch DOM reads then writes
- `content-jumping` - Reserve space for async content to avoid layout jumps (Core Web Vitals: CLS)
- `lazy-load-below-fold` - Use loading="lazy" for below-the-fold images and heavy media
- `virtualize-lists` - Virtualize lists with 50+ items to improve memory efficiency and scroll performance
- `main-thread-budget` - Keep per-frame work under ~16ms for 60fps; move heavy tasks off main thread
- `progressive-loading` - Use skeleton screens / shimmer instead of long blocking spinners for >1s operations
- `input-latency` - Keep input latency under ~100ms for taps/scrolls
- `feedback-speed` - Provide visual feedback within 100ms of a click/tap
- `debounce-throttle` - Use debounce/throttle for high-frequency events (scroll, resize, input)
- `offline-support` - Provide offline state messaging and basic fallback (PWA / mobile)
- `network-fallback` - Offer degraded modes for slow networks (lower-res images, fewer animations)

### 4. Style Selection (HIGH)

- `style-match` - Match style to product type (use `--design-system` for recommendations)
- `consistency` - Use same style across all pages
- `no-emoji-icons` - Use SVG icons (Heroicons, Lucide), not emojis
- `color-palette-from-product` - Choose palette from product/industry (search `--domain color`)
- `effects-match-style` - Shadows, blur, radius aligned with chosen style (glass / flat / clay etc.)
- `state-clarity` - Make hover/pressed/disabled states visually distinct while staying on-style
- `elevation-consistent` - Use a consistent elevation/shadow scale for cards, popovers, modals; avoid random shadow values
- `dark-mode-pairing` - Design light/dark variants together to keep brand, contrast, and style consistent
- `icon-style-consistent` - Use one icon set/visual language (stroke width, corner radius) across the product
- `native-controls` - Prefer native HTML controls (`<button>`, `<select>`, `<input>`) over custom ones; only customize when branding requires it, and preserve semantics/keyboard behavior
- `blur-purpose` - Use backdrop blur to indicate background dismissal (modals, popovers), not as decoration
- `primary-action` - Each view should have only one primary CTA; secondary actions visually subordinate

### 5. Layout & Responsive (HIGH)

- `viewport-meta` - width=device-width initial-scale=1 (never disable zoom)
- `mobile-first` - Design mobile-first, then scale up to tablet and desktop
- `breakpoint-consistency` - Use systematic breakpoints (e.g. 375 / 768 / 1024 / 1440)
- `readable-font-size` - Minimum 16px body text (prevents mobile browser auto-zoom on focus)
- `line-length-control` - Mobile 35–60 chars per line; desktop 60–75 chars
- `horizontal-scroll` - No horizontal scroll on mobile; ensure content fits viewport width
- `spacing-scale` - Use a consistent 4px/8px incremental spacing system
- `touch-density` - Keep component spacing comfortable for touch: not cramped, not causing mis-taps
- `container-width` - Consistent max-width on desktop (max-w-6xl / 7xl)
- `z-index-management` - Define layered z-index scale (e.g. 0 / 10 / 20 / 40 / 100 / 1000)
- `fixed-element-offset` - Fixed navbar/bottom bar must reserve safe padding for underlying content
- `scroll-behavior` - Avoid nested scroll regions that interfere with the main scroll experience
- `viewport-units` - Prefer min-h-dvh over 100vh on mobile
- `orientation-support` - Keep layout readable and operable in landscape mode
- `content-priority` - Show core content first on mobile; fold or hide secondary content
- `visual-hierarchy` - Establish hierarchy via size, spacing, contrast — not color alone

### 6. Typography & Color (MEDIUM)

- `line-height` - Use 1.5-1.75 for body text
- `line-length` - Limit to 65-75 characters per line
- `font-pairing` - Match heading/body font personalities
- `font-scale` - Consistent type scale (e.g. 12 14 16 18 24 32)
- `contrast-readability` - Darker text on light backgrounds (e.g. slate-900 on white)
- `text-styles-system` - Define a reusable type scale/roles (display, headline, title, body, label) as tokens, not ad-hoc sizes
- `weight-hierarchy` - Use font-weight to reinforce hierarchy: Bold headings (600–700), Regular body (400), Medium labels (500)
- `color-semantic` - Define semantic color tokens (primary, secondary, error, surface, on-surface) not raw hex in components
- `color-dark-mode` - Dark mode uses desaturated / lighter tonal variants, not inverted colors; test contrast separately
- `color-accessible-pairs` - Foreground/background pairs must meet 4.5:1 (AA) or 7:1 (AAA); use tools to verify (WCAG)
- `color-not-decorative-only` - Functional color (error red, success green) must include icon/text; avoid color-only meaning (WCAG)
- `truncation-strategy` - Prefer wrapping over truncation; when truncating use ellipsis and provide full text via tooltip/expand
- `letter-spacing` - Use restrained tracking; avoid tight tracking on body text and loose tracking on large headings only
- `number-tabular` - Use tabular/monospaced figures (`font-variant-numeric: tabular-nums`) for data columns, prices, and timers to prevent layout shift
- `whitespace-balance` - Use whitespace intentionally to group related items and separate sections; avoid visual clutter

### 7. Animation (MEDIUM)

- `duration-timing` - Use 150–300ms for micro-interactions; complex transitions ≤400ms; avoid >500ms
- `transform-performance` - Use transform/opacity only; avoid animating width/height/top/left
- `loading-states` - Show skeleton or progress indicator when loading exceeds 300ms
- `excessive-motion` - Animate 1-2 key elements per view max
- `easing` - Use ease-out for entering, ease-in for exiting; avoid linear for UI transitions
- `motion-meaning` - Every animation must express a cause-effect relationship, not just be decorative
- `state-transition` - State changes (hover / active / expanded / collapsed / modal) should animate smoothly, not snap
- `continuity` - Page/view transitions should maintain spatial continuity (shared element, directional slide)
- `parallax-subtle` - Use parallax sparingly; must respect reduced-motion and not cause disorientation
- `spring-physics` - Prefer spring/physics-based curves (e.g. Framer Motion) over linear/cubic-bezier for a natural feel
- `exit-faster-than-enter` - Exit animations shorter than enter (~60–70% of enter duration) to feel responsive
- `stagger-sequence` - Stagger list/grid item entrance by 30–50ms per item; avoid all-at-once or too-slow reveals
- `shared-element-transition` - Use shared-element / hero transitions (e.g. View Transitions API) for visual continuity between views
- `interruptible` - Animations must be interruptible; a user click/keypress cancels an in-progress animation immediately
- `no-blocking-animation` - Never block user input during an animation; UI must stay interactive
- `fade-crossfade` - Use crossfade for content replacement within the same container
- `scale-feedback` - Subtle scale (0.95–1.05) on press for clickable cards/buttons; restore on release
- `hierarchy-motion` - Use translate/scale direction to express hierarchy: enter from below = deeper, exit upward = back
- `motion-consistency` - Unify duration/easing tokens globally; all animations share the same rhythm and feel
- `opacity-threshold` - Fading elements should not linger below opacity 0.2; either fade fully or remain visible
- `modal-motion` - Modals/popovers should animate from their trigger source (scale+fade or slide-in) for spatial context
- `navigation-direction` - Forward navigation animates left/up; backward animates right/down — keep direction logically consistent
- `layout-shift-avoid` - Animations must not cause layout reflow or CLS; use transform for position changes

### 8. Forms & Feedback (MEDIUM)

- `input-labels` - Visible label per input (not placeholder-only)
- `error-placement` - Show error below the related field
- `submit-feedback` - Loading then success/error state on submit
- `required-indicators` - Mark required fields (e.g. asterisk)
- `empty-states` - Helpful message and action when no content
- `toast-dismiss` - Auto-dismiss toasts in 3-5s
- `confirmation-dialogs` - Confirm before destructive actions
- `input-helper-text` - Provide persistent helper text below complex inputs, not just placeholder
- `disabled-states` - Disabled elements use reduced opacity (0.38–0.5) + cursor change + the `disabled` attribute
- `progressive-disclosure` - Reveal complex options progressively; don't overwhelm users upfront
- `inline-validation` - Validate on blur (not keystroke); show error only after user finishes input
- `input-type-keyboard` - Use semantic input types (`type="email"`/`tel`/`number`) to trigger the correct on-screen keyboard and validation
- `password-toggle` - Provide show/hide toggle for password fields
- `autofill-support` - Use `autocomplete` attributes so the browser/password manager can autofill
- `undo-support` - Allow undo for destructive or bulk actions (e.g. "Undo delete" toast)
- `success-feedback` - Confirm completed actions with brief visual feedback (checkmark, toast, color flash)
- `error-recovery` - Error messages must include a clear recovery path (retry, edit, help link)
- `multi-step-progress` - Multi-step flows show step indicator or progress bar; allow back navigation
- `form-autosave` - Long forms should auto-save drafts to prevent data loss on accidental navigation
- `sheet-dismiss-confirm` - Confirm before closing a modal/dialog with unsaved changes
- `error-clarity` - Error messages must state cause + how to fix (not just "Invalid input")
- `field-grouping` - Group related fields logically (`fieldset`/`legend` or visual grouping)
- `read-only-distinction` - Read-only state should be visually and semantically different from disabled
- `focus-management` - After submit error, auto-focus the first invalid field (WCAG)
- `error-summary` - For multiple errors, show summary at top with anchor links to each field (WCAG)
- `touch-friendly-input` - Input height ≥44px to meet click/tap target requirements
- `destructive-emphasis` - Destructive actions use semantic danger color (red) and are visually separated from primary actions
- `toast-accessibility` - Toasts must not steal focus; use `aria-live="polite"` for screen reader announcement (WCAG)
- `aria-live-errors` - Form errors use aria-live region or `role="alert"` to notify screen readers (WCAG)
- `contrast-feedback` - Error and success state colors must meet 4.5:1 contrast ratio (WCAG)
- `timeout-feedback` - Request timeout must show clear feedback with retry option

### 9. Navigation Patterns (HIGH)

- `nav-primary-limit` - Keep primary nav concise (≈5–7 top-level items); use labels with icons
- `drawer-usage` - Use a drawer/sidebar for secondary navigation, not primary actions
- `back-behavior` - Browser back/forward must work correctly; preserve scroll/state on back
- `deep-linking` - Every key view must have its own URL, reachable and shareable
- `nav-label-icon` - Navigation items should have a text label; icon-only nav harms discoverability
- `nav-state-active` - Current location must be visually highlighted (color, weight, indicator) in navigation
- `nav-hierarchy` - Primary nav (top bar / sidebar) vs secondary nav (sub-menu / settings) must be clearly separated
- `modal-escape` - Modals and dialogs must offer a clear close affordance (visible control + Esc + backdrop click)
- `search-accessible` - Search must be easily reachable (top bar); provide recent/suggested queries
- `breadcrumb-web` - Use breadcrumbs for 3+ level deep hierarchies to aid orientation
- `state-preservation` - Navigating back must restore previous scroll position, filter state, and input
- `route-transitions` - Keep route transitions consistent and non-disorienting; respect reduced-motion
- `badge-indicators` - Use badges on nav items sparingly to indicate unread/pending; clear after the user visits
- `overflow-menu` - When actions exceed available space, use an overflow/more menu instead of cramming
- `responsive-nav` - Large screens (≥1024px) prefer a sidebar/top bar; small screens collapse to a menu (hamburger/drawer)
- `history-integrity` - Never silently reset browser history or unexpectedly redirect to home
- `navigation-consistency` - Navigation placement must stay the same across all pages; don't change by page type
- `avoid-mixed-patterns` - Don't mix multiple competing nav patterns at the same hierarchy level
- `modal-vs-navigation` - Modals must not be used for primary navigation flows; they break the user's path and URL
- `focus-on-route-change` - After a route change, move focus to the main content region for screen reader users (WCAG)
- `persistent-nav` - Core navigation must remain reachable from deep pages; don't hide it entirely in sub-flows
- `destructive-nav-separation` - Dangerous actions (delete account, logout) must be visually and spatially separated from normal nav items
- `empty-nav-state` - When a nav destination is unavailable, explain why instead of silently hiding it

### 10. Charts & Data (LOW)

- `chart-type` - Match chart type to data type (trend → line, comparison → bar, proportion → pie/donut)
- `color-guidance` - Use accessible color palettes; avoid red/green only pairs for colorblind users (WCAG)
- `data-table` - Provide table alternative for accessibility; charts alone are not screen-reader friendly (WCAG)
- `pattern-texture` - Supplement color with patterns, textures, or shapes so data is distinguishable without color (WCAG)
- `legend-visible` - Always show legend; position near the chart, not detached below a scroll fold
- `tooltip-on-interact` - Provide tooltips/data labels on hover and focus (and tap on touch screens) showing exact values (WCAG)
- `axis-labels` - Label axes with units and readable scale; avoid truncated or rotated labels on mobile
- `responsive-chart` - Charts must reflow or simplify on small screens (e.g. horizontal bar instead of vertical, fewer ticks)
- `empty-data-state` - Show meaningful empty state when no data exists ("No data yet" + guidance), not a blank chart
- `loading-chart` - Use skeleton or shimmer placeholder while chart data loads; don't show an empty axis frame
- `animation-optional` - Chart entrance animations must respect prefers-reduced-motion; data should be readable immediately
- `large-dataset` - For 1000+ data points, aggregate or sample; provide drill-down for detail instead of rendering all
- `number-formatting` - Use locale-aware formatting for numbers, dates, currencies on axes and labels
- `touch-target-chart` - Interactive chart elements (points, segments) must have a ≥44px hit area or expand on hover/focus (WCAG)
- `no-pie-overuse` - Avoid pie/donut for >5 categories; switch to bar chart for clarity
- `contrast-data` - Data lines/bars vs background ≥3:1; data text labels ≥4.5:1 (WCAG)
- `legend-interactive` - Legends should be clickable to toggle series visibility
- `direct-labeling` - For small datasets, label values directly on the chart to reduce eye travel
- `tooltip-keyboard` - Tooltip content must be keyboard-reachable and not rely on hover alone (WCAG)
- `sortable-table` - Data tables must support sorting with aria-sort indicating current sort state (WCAG)
- `axis-readability` - Axis ticks must not be cramped; maintain readable spacing, auto-skip on small screens
- `data-density` - Limit information density per chart to avoid cognitive overload; split into multiple charts if needed
- `trend-emphasis` - Emphasize data trends over decoration; avoid heavy gradients/shadows that obscure the data
- `gridline-subtle` - Grid lines should be low-contrast (e.g. gray-200) so they don't compete with data
- `focusable-elements` - Interactive chart elements (points, bars, slices) must be keyboard-navigable (WCAG)
- `screen-reader-summary` - Provide a text summary or aria-label describing the chart's key insight for screen readers (WCAG)
- `error-state-chart` - Data load failure must show error message with retry action, not a broken/empty chart
- `export-option` - For data-heavy products, offer CSV/image export of chart data
- `drill-down-consistency` - Drill-down interactions must maintain a clear back-path and hierarchy breadcrumb
- `time-scale-clarity` - Time series charts must clearly label time granularity (day/week/month) and allow switching

## How to Use

Search specific domains using the CLI tool below.

---
# Prerequisites

Check if Python is installed:

```bash
python3 --version || python --version
```

If Python is not installed, install it based on user's OS:

**macOS:**
```bash
brew install python3
```

**Ubuntu/Debian:**
```bash
sudo apt update && sudo apt install python3
```

**Windows:**
```powershell
winget install Python.Python.3.12
```

> **Note:** On Windows, use `python` instead of `python3` to run scripts (e.g., `python scripts/search.py` instead of `python3 scripts/search.py`).

---

## How to Use This Skill

Use this skill when the user requests any of the following:

| Scenario | Trigger Examples | Start From |
|----------|-----------------|------------|
| **New project / page** | "做一个 landing page"、"Build a dashboard" | Step 1 → Step 2 (design system) |
| **New component** | "Create a pricing card"、"Add a modal" | Step 3 (domain search: style, ux) |
| **Choose style / color / font** | "What style fits a fintech app?"、"推荐配色" | Step 2 (design system) |
| **Review existing UI** | "Review this page for UX issues"、"检查无障碍" | Quick Reference checklist above |
| **Fix a UI bug** | "Button hover is broken"、"Layout shifts on load" | Quick Reference → relevant section |
| **Improve / optimize** | "Make this faster"、"Improve mobile experience" | Step 3 (domain search: ux, react) |
| **Implement dark mode** | "Add dark mode support" | Step 3 (domain: style "dark mode") |
| **Add charts / data viz** | "Add an analytics dashboard chart" | Step 3 (domain: chart) |
| **Stack best practices** | "React performance tips"、"Next.js data fetching" | Step 4 (stack search) |

Follow this workflow:

### Step 1: Analyze User Requirements

Extract key information from user request:
- **Product type**: Entertainment (social, video, music, gaming), Tool (scanner, editor, converter), Productivity (task manager, notes, calendar), or hybrid
- **Target audience**: C-end consumer users; consider age group, usage context (commute, leisure, work)
- **Style keywords**: playful, vibrant, minimal, dark mode, content-first, immersive, etc.
- **Stack**: the web stack from the request or repo (React, Next.js, Vue, Svelte, Angular, Astro, HTML+Tailwind, shadcn, Laravel…)

### Step 2: Generate Design System (REQUIRED)

**Always start with `--design-system`** to get comprehensive recommendations with reasoning:

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<product_type> <industry> <keywords>" --design-system [-p "Project Name"]
```

This command:
1. Searches domains in parallel (product, style, color, landing, typography)
2. Applies reasoning rules from `ui-reasoning.csv` to select best matches
3. Returns complete design system: pattern, style, colors, typography, effects
4. Includes anti-patterns to avoid

**Example:**
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "beauty spa wellness service" --design-system -p "Serenity Spa"
```

### Step 2b: Persist Design System (Master + Overrides Pattern)

To save the design system for **hierarchical retrieval across sessions**, add `--persist`:

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name"
```

This creates:
- `design-system/MASTER.md` — Global Source of Truth with all design rules
- `design-system/pages/` — Folder for page-specific overrides

**With page-specific override:**
```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "Project Name" --page "dashboard"
```

This also creates:
- `design-system/pages/dashboard.md` — Page-specific deviations from Master

**How hierarchical retrieval works:**
1. When building a specific page (e.g., "Checkout"), first check `design-system/pages/checkout.md`
2. If the page file exists, its rules **override** the Master file
3. If not, use `design-system/MASTER.md` exclusively

**Context-aware retrieval prompt:**
```
I am building the [Page Name] page. Please read design-system/MASTER.md.
Also check if design-system/pages/[page-name].md exists.
If the page file exists, prioritize its rules.
If not, use the Master rules exclusively.
Now, generate the code...
```

### Step 3: Supplement with Detailed Searches (as needed)

After getting the design system, use domain searches to get additional details:

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<keyword>" --domain <domain> [-n <max_results>]
```

**When to use detailed searches:**

| Need | Domain | Example |
|------|--------|---------|
| Product type patterns | `product` | `--domain product "entertainment social"` |
| More style options | `style` | `--domain style "glassmorphism dark"` |
| Color palettes | `color` | `--domain color "entertainment vibrant"` |
| Font pairings | `typography` | `--domain typography "playful modern"` |
| Chart recommendations | `chart` | `--domain chart "real-time dashboard"` |
| UX best practices | `ux` | `--domain ux "animation accessibility"` |
| Landing structure | `landing` | `--domain landing "hero social-proof"` |
| React/Next.js perf | `react` | `--domain react "rerender memo list"` |
| Web a11y / semantics | `web` | `--domain web "aria focus semantic form"` |
| AI prompt / CSS keywords | `prompt` | `--domain prompt "minimalism"` |

### Step 4: Stack Guidelines

Get implementation-specific best practices for the user's stack:

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "<keyword>" --stack <stack>
```

---

## Search Reference

### Available Domains

| Domain | Use For | Example Keywords |
|--------|---------|------------------|
| `product` | Product type recommendations | SaaS, e-commerce, portfolio, healthcare, beauty, service |
| `style` | UI styles, colors, effects | glassmorphism, minimalism, dark mode, brutalism |
| `typography` | Font pairings, Google Fonts | elegant, playful, professional, modern |
| `color` | Color palettes by product type | saas, ecommerce, healthcare, beauty, fintech, service |
| `landing` | Page structure, CTA strategies | hero, hero-centric, testimonial, pricing, social-proof |
| `chart` | Chart types, library recommendations | trend, comparison, timeline, funnel, pie |
| `ux` | Best practices, anti-patterns | animation, accessibility, z-index, loading |
| `react` | React/Next.js performance | waterfall, bundle, suspense, memo, rerender, cache |
| `web` | Web semantics & accessibility guidelines | aria, focus rings, semantic HTML, input types, autocomplete, preconnect |
| `prompt` | AI prompts, CSS keywords | (style name) |

### Available Stacks

Web stacks only. Pass one via `--stack`:

| Stack | Focus |
|-------|-------|
| `react` / `nextjs` | Components, hooks, RSC, routing, performance |
| `vue` / `nuxtjs` / `nuxt-ui` | SFCs, composition API, Nuxt conventions |
| `svelte` | Components, stores, transitions |
| `angular` | Components, services, signals |
| `astro` | Islands, content-driven sites |
| `html-tailwind` | Plain HTML + Tailwind utility styling |
| `shadcn` | shadcn/ui + Radix + Tailwind component patterns |
| `threejs` | WebGL / 3D scenes on the web |
| `laravel` | Blade/Livewire server-rendered web UI |

**Examples:**

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "server component data fetching" --stack nextjs
python3 skills/ui-ux-pro-max/scripts/search.py "accessible dialog with radix" --stack shadcn
```

---

## Example Workflow

**User request:** "Make an AI search homepage。"

### Step 1: Analyze Requirements
- Product type: Tool (AI search engine)
- Target audience: C-end users looking for fast, intelligent search
- Style keywords: modern, minimal, content-first, dark mode
- Stack: the project's web stack (e.g. Next.js, React, Vue)

### Step 2: Generate Design System (REQUIRED)

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "AI search tool modern minimal" --design-system -p "AI Search"
```

**Output:** Complete design system with pattern, style, colors, typography, effects, and anti-patterns.

### Step 3: Supplement with Detailed Searches (as needed)

```bash
# Get style options for a modern tool product
python3 skills/ui-ux-pro-max/scripts/search.py "minimalism dark mode" --domain style

# Get UX best practices for search interaction and loading
python3 skills/ui-ux-pro-max/scripts/search.py "search loading animation" --domain ux
```

### Step 4: Stack Guidelines

```bash
python3 skills/ui-ux-pro-max/scripts/search.py "list performance data fetching" --stack nextjs
```

**Then:** Synthesize design system + detailed searches and implement the design.

---

## Output Formats

The `--design-system` flag supports two output formats:

```bash
# ASCII box (default) - best for terminal display
python3 skills/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system

# Markdown - best for documentation
python3 skills/ui-ux-pro-max/scripts/search.py "fintech crypto" --design-system -f markdown
```

---

## Tips for Better Results

### Query Strategy

- Use **multi-dimensional keywords** — combine product + industry + tone + density: `"entertainment social vibrant content-dense"` not just `"app"`
- Try different keywords for the same need: `"playful neon"` → `"vibrant dark"` → `"content-first minimal"`
- Use `--design-system` first for full recommendations, then `--domain` to deep-dive any dimension you're unsure about
- Add `--stack <stack>` for implementation-specific guidance when the target stack is known

### Common Sticking Points

| Problem | What to Do |
|---------|------------|
| Can't decide on style/color | Re-run `--design-system` with different keywords |
| Dark mode contrast issues | Quick Reference §6: `color-dark-mode` + `color-accessible-pairs` |
| Animations feel unnatural | Quick Reference §7: `spring-physics` + `easing` + `exit-faster-than-enter` |
| Form UX is poor | Quick Reference §8: `inline-validation` + `error-clarity` + `focus-management` |
| Navigation feels confusing | Quick Reference §9: `nav-hierarchy` + `bottom-nav-limit` + `back-behavior` |
| Layout breaks on small screens | Quick Reference §5: `mobile-first` + `breakpoint-consistency` |
| Performance / jank | Quick Reference §3: `virtualize-lists` + `main-thread-budget` + `debounce-throttle` |

### Pre-Delivery Checklist

- Run `--domain ux "animation accessibility z-index loading"` as a UX validation pass before implementation
- Run through Quick Reference **§1–§3** (CRITICAL + HIGH) as a final review
- Test on 375px (small phone) and landscape orientation
- Verify behavior with **reduced-motion** enabled and **browser zoom at 200%**
- Check dark mode contrast independently (don't assume light mode values work)
- Confirm all click/tap targets are ≥44×44px and no content is hidden behind sticky bars

---

## Common Rules for Professional UI

These are frequently overlooked issues that make a web UI look unprofessional.

### Icons & Visual Elements

- Default icon library: **Lucide** (`lucide-react`) or **Phosphor** (`@phosphor-icons/react`). The `data/icons.csv` list is common recommendations, not the full set.
- When no listed icon fits: pick any semantically closer icon from the full set of your chosen library first; if still nothing fits, fall back to Heroicons (`@heroicons/react`), keeping one consistent visual style (line/fill, stroke width, corner radius).

| Rule | Standard | Avoid | Why It Matters |
|------|----------|--------|----------------|
| **No Emoji as Structural Icons** | Use vector SVG icons (Lucide, Phosphor, Heroicons). | Using emojis (🎨 🚀 ⚙️) for navigation, settings, or controls. | Emojis are font-dependent, inconsistent across browsers/OSes, and can't be controlled via design tokens. |
| **Vector-Only Assets** | Use SVG icons that scale cleanly and support `currentColor` theming. | Raster PNG icons that blur or pixelate on retina/zoom. | Ensures crisp rendering and dark/light adaptability. |
| **Stable Interaction States** | Use color/opacity/shadow transitions for hover/active without changing layout bounds. | Layout-shifting transforms that move surrounding content or cause jitter. | Prevents reflow and preserves perceived quality. |
| **Correct Brand Logos** | Use official brand assets and follow their usage guidelines (spacing, color, clear space). | Guessing logo paths, recoloring unofficially, or modifying proportions. | Prevents brand misuse and legal issues. |
| **Consistent Icon Sizing** | Define icon sizes as tokens (e.g., icon-sm 16px, icon-md 24px, icon-lg 32px). | Mixing arbitrary values like 20 / 24 / 28px randomly. | Maintains rhythm and visual hierarchy. |
| **Stroke Consistency** | Use a consistent stroke width within the same visual layer (e.g., 1.5px or 2px). | Mixing thick and thin strokes arbitrarily. | Inconsistent strokes reduce perceived polish. |
| **Filled vs Outline Discipline** | Use one icon style per hierarchy level. | Mixing filled and outline icons at the same level. | Maintains semantic clarity and coherence. |
| **Click Target Minimum** | Minimum 44×44px interactive area; pad small icons to reach it. | Small icons without expanded click/tap area. | Meets accessibility and usability standards. |
| **Icon Alignment** | Align icons to text baseline and maintain consistent padding. | Misaligned icons or inconsistent spacing. | Prevents subtle visual imbalance. |
| **Icon Contrast** | Follow WCAG: 4.5:1 for small elements, 3:1 minimum for larger UI glyphs. | Low-contrast icons that blend into the background. | Ensures accessibility in both themes. |

### Interaction

| Rule | Do | Don't |
|------|----|----- |
| **Press feedback** | Provide clear hover + active feedback (color/opacity/shadow) within 80-150ms | No visual response on hover/click |
| **Animation timing** | Keep micro-interactions around 150-300ms with a consistent easing token | Instant transitions or slow animations (>500ms) |
| **Accessibility focus** | Ensure DOM/focus order matches visual order and controls have descriptive accessible names | Unlabeled controls or confusing focus traversal |
| **Disabled state clarity** | Use the `disabled` attribute (or `aria-disabled`), reduced emphasis, and no action | Controls that look clickable but do nothing |
| **Click target minimum** | Keep click/tap areas ≥44×44px; expand hit area when the icon is smaller | Tiny targets or icon-only hit areas without padding |
| **Semantic controls** | Use native primitives (`<button>`, `<a>`, `<input>`) with proper roles | Generic `<div>`/`<span>` used as primary controls without semantics |

### Light/Dark Mode Contrast

| Rule | Do | Don't |
|------|----|----- |
| **Surface readability (light)** | Keep cards/surfaces clearly separated from background with sufficient contrast/elevation | Overly transparent surfaces that blur hierarchy |
| **Text contrast (light)** | Maintain body text contrast ≥4.5:1 against light surfaces | Low-contrast gray body text |
| **Text contrast (dark)** | Maintain primary text ≥4.5:1 and secondary text ≥3:1 on dark surfaces | Dark mode text that blends into background |
| **Border and divider visibility** | Ensure separators are visible in both themes | Theme-specific borders disappearing in one mode |
| **State contrast parity** | Keep hover/focus/disabled states equally distinguishable in light and dark | Defining interaction states for one theme only |
| **Token-driven theming** | Use semantic color tokens mapped per theme across surfaces/text/icons | Hardcoded per-page hex values |
| **Scrim and modal legibility** | Use a modal backdrop strong enough to isolate foreground content (typically 40-60% black) | Weak scrim that leaves the background visually competing |

### Layout & Spacing

| Rule | Do | Don't |
|------|----|----- |
| **Sticky-element clearance** | Reserve padding so content isn't hidden behind sticky headers/footers | Content colliding with or hidden under fixed bars |
| **Consistent content width** | Keep a predictable max-width per breakpoint (e.g. `max-w-6xl`/`7xl`) | Mixing arbitrary widths between pages |
| **8px spacing rhythm** | Use a consistent 4/8px spacing system for padding/gaps/section spacing | Random spacing increments with no rhythm |
| **Readable text measure** | Keep long-form text at 60–75 chars per line on large screens | Full-width edge-to-edge paragraphs that hurt readability |
| **Section spacing hierarchy** | Define clear vertical rhythm tiers (e.g., 16/24/32/48px) by hierarchy | Similar levels with inconsistent spacing |
| **Adaptive gutters by breakpoint** | Increase horizontal insets on larger viewports | Same narrow gutter at all viewport sizes |
| **Scroll and fixed coexistence** | Add top/bottom insets so content isn't hidden behind sticky bars | Scroll content obscured by sticky headers/footers |

---

## Pre-Delivery Checklist

Before delivering web UI code, verify these items:

### Visual Quality
- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons come from a consistent icon family and style
- [ ] Official brand assets are used with correct proportions and clear space
- [ ] Hover/active visuals do not shift layout bounds or cause jitter
- [ ] Semantic theme tokens are used consistently (no ad-hoc per-page hardcoded colors)

### Interaction
- [ ] All interactive elements provide clear hover + active feedback
- [ ] Click/tap targets meet minimum size (≥44×44px)
- [ ] Micro-interaction timing stays in the 150-300ms range with consistent easing
- [ ] Disabled states are visually clear and non-interactive
- [ ] DOM/focus order matches visual order, and controls have descriptive accessible names
- [ ] Visible `:focus-visible` ring on every interactive element; full keyboard operability

### Light/Dark Mode
- [ ] Primary text contrast ≥4.5:1 in both light and dark mode
- [ ] Secondary text contrast ≥3:1 in both light and dark mode
- [ ] Dividers/borders and interaction states are distinguishable in both modes
- [ ] Modal/drawer backdrop opacity preserves foreground legibility (typically 40-60% black)
- [ ] Both themes are tested before delivery (not inferred from a single theme)

### Layout
- [ ] Content is not hidden behind fixed/sticky bars
- [ ] Verified across breakpoints: mobile (375px), tablet (768px), desktop (1280px+)
- [ ] No horizontal scroll on mobile; use `min-h-dvh` over `100vh`
- [ ] Horizontal gutters adapt correctly by viewport size
- [ ] 4/8px spacing rhythm is maintained across component, section, and page levels
- [ ] Long-form text measure stays readable (60–75 chars) on large screens

### Accessibility
- [ ] All meaningful images/icons have alt text or accessible labels
- [ ] Form fields have `<label>`s, helper text, and clear error messages
- [ ] Color is not the only indicator
- [ ] `prefers-reduced-motion` and browser zoom (to 200%) are supported without layout breakage
- [ ] ARIA roles/states (selected, disabled, expanded) are set and announced correctly
