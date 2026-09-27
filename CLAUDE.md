# PersonalWallet — project rules

Mobile-first installed PWA for personal finance. Persian UI, `dir="rtl"`. Vanilla JS (`pwa/app.js`), all CSS in `pwa/index.html`, no build step. Backend: Express + Postgres (`api/src/index.js`).

## Design & UI rules

Distilled from [emilkowalski/skills](https://github.com/emilkowalski/skills) (MIT), installed in `.claude/skills/`, and adapted to this app. For deeper guidance use the skill: `apple-design` (motion, materials, foundations), `emil-design-eng` (polish, easing, review), `mobile-native` (PWA/touch fixes), `animate` (build a new animation), `review-animations` / `improve-animations` (audit motion).

### Tokens
- Colors come only from the CSS variables in `:root`. Every new color token needs a value in **both** `:root` (dark) and `:root[data-theme="light"]`. Never hardcode a dark color on chrome (nav, sheets, borders) — it breaks light mode.
- Motion comes only from the tokens `--ease-out`, `--ease-in-out`, `--ease-drawer`, `--dur-*`. Extend these; never add a parallel set or hand-type a new cubic-bezier.
- Theme is toggled by JS (`applyTheme`), not the OS. Anything that depends on theme (e.g. `meta[name="theme-color"]`) must be updated there too.

### Motion
- **Decide by frequency first.** Tab switches, list re-renders, and anything done many times a day: no animation. Modals, sheets, toasts: short animation. Rare moments (OTP success): may add delight.
- Every animation needs a purpose: feedback, spatial consistency, state change, or preventing a jarring jump. "Looks cool" is not one.
- Enter/exit: `--ease-out`. On-screen movement: `--ease-in-out`. Sheets/drawers: `--ease-drawer`. **Never `ease-in`** on UI.
- Durations: press 100–160ms, small popovers 125–200ms, dropdowns 150–250ms, modals/sheets ≤ ~300ms. **Exit faster than enter.**
- Animate only `transform` and `opacity`. Never `transition: all`. Never animate `height`/`width`/`margin`/`padding`.
- Never start from `scale(0)` — use `scale(0.95–0.96)` + `opacity: 0`.
- Spatial consistency: a sheet enters from the bottom and leaves to the bottom. Popovers originate from their trigger (`transform-origin`); modals stay centered.
- Prefer CSS transitions (interruptible) over `@keyframes` for anything that can be re-triggered. Use `@starting-style` for enter and `display … allow-discrete` for exit on `[hidden]` elements, so no JS timers are needed and old browsers fall back to instant.
- This is a finance app: crisp, no bounce. Overshoot only after a physical gesture (a flick) or a rare celebration.
- Continuous/looping motion (the login coin) must be time-based (`performance.now()`), not per-frame increments, so 120Hz screens don't run it twice as fast.
- If drag gestures are ever added: Pointer Events + `setPointerCapture`, follow the finger 1:1 respecting the grab offset, ~10px threshold before committing a direction, hand release velocity to the settle animation, project momentum to pick the snap point, rubber-band at edges instead of a hard stop, and let the user grab it mid-animation.

### Touch & mobile (PWA)
- Every tappable element gets press feedback on touch-down: the global `button:active { scale(0.97) }`. Custom tappables (non-`<button>`) must opt in.
- `:hover` styles only inside `@media (hover: hover) and (pointer: fine)`.
- Inputs, selects, textareas: font-size ≥ 16px (`1rem`) or iOS zooms the page. **Never** `user-scalable=no` / `maximum-scale=1`.
- Use the right keyboard: `inputmode="numeric"` for rial amounts and counts, `"decimal"` for grams/quantities, `type="tel"` for phone numbers.
- `user-select: none` only on controls. Amounts, account numbers and messages are content — they must stay selectable.
- Use `dvh`/`svh`, never `vh`, for full-height layouts. Fixed bars, sheets and modals pad with `env(safe-area-inset-*, 0px)`.
- Inner scroll containers (modals, sheets): `overscroll-behavior: contain`.
- Modals must scroll when their content is taller than the screen (`margin: auto` card inside a scrollable overlay), never get clipped.

### Materials & depth
- Floating chrome (bottom nav) is a translucent material: `var(--material)` + `backdrop-filter: blur(20px) saturate(180%)`, with a light top edge (`--material-edge`), content scrolling underneath.
- Never stack a translucent surface on another translucent surface. Modal tasks use a dimming scrim (`--scrim`) with a solid card.
- Respect `prefers-reduced-motion` (keep fades, drop movement), `prefers-reduced-transparency` (solid chrome, no blur) and `prefers-contrast: more` (solid backgrounds, stronger borders) for every new animated or translucent component.

### Typography (Persian-specific)
- **Never apply `letter-spacing` to Persian/Arabic text** — it breaks the cursive joins. Tracking is only for Latin text or digit strings (e.g. card numbers).
- Amounts and numbers use `.font-num` (IRANSans FaNum). Font sizes in `rem`.
- Build hierarchy with weight + size together; emphasize with weight. Persian body text needs generous line-height (~1.6–1.8) because of tall ascenders/descenders.
- RTL: in new code prefer logical properties (`margin-inline-start`, `padding-inline`, `inset-inline-end`) over `left`/`right`; mirror directional icons (arrows, chevrons).

### Foundations
- **Labels:** any input that is pre-filled (edit forms) needs a visible label above it — a placeholder disappears once there's a value.
- Use `confirm()` only for genuinely destructive, irreversible actions. Prefer the existing trash/restore (undo) flow.
- Feedback comes in four kinds — status, completion, warning, error. Validate inline, next to the field, not only on submit.
- Labels name exactly what's there ("اقساط و وام‌ها"), not vague umbrellas.
- Colors must work in both themes; check pale tints (`#fca5a5`, `#6ee7b7`) against the light background.

### Verifying UI work
- Check both themes and phone width in the browser pane before calling a UI change done.
- Sticky hover, tap delay, input zoom, safe areas, the keyboard, and backdrop blur only really show on a real phone. Say which parts still need a real-device check instead of claiming they're verified.
- When reviewing UI code, report findings as a `| Before | After | Why |` table.
