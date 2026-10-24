# E2E tests marked `test.fixme`

These E2E tests never actually ran in CI: `@opencad/e2e` ran Playwright from `e2e/` while the config lived at the repo root (where `@playwright/test` is not installed), so there was no webServer/baseURL — 60/62 failed and `continue-on-error: true` hid it. On Node 26 the job hangs until the 35 min timeout.

After fixing the config (moved to `e2e/playwright.config.ts`), a real run on Chromium gives **29 passed, 1 skipped, 31 failed — all but `visual.spec.ts` since fixed** (+ `house-build.spec.ts`, which is an experiment harness and is now excluded unless `ITER` is set).

The failing tests are marked `test.fixme` pointing here so the passing ones can gate CI. Fix them and remove the `fixme`:

### Causes

- **`visual.spec.ts`** — no snapshot baselines are committed (and baselines are OS-specific); needs baselines generated in CI's environment (e.g. Playwright Docker image).

### Failing tests

- [ ] `visual.spec.ts:29:3` › T-VIS-001: App shell layout › light theme — default 3D view
- [ ] `visual.spec.ts:35:3` › T-VIS-001: App shell layout › dark theme
- [ ] `visual.spec.ts:44:3` › T-VIS-001: App shell layout › floor plan view
- [ ] `visual.spec.ts:52:3` › T-VIS-001: App shell layout › section view
- [ ] `visual.spec.ts:68:3` › T-VIS-002: Panels and overlays › AI chat panel open
- [ ] `visual.spec.ts:76:3` › T-VIS-002: Panels and overlays › import modal
- [ ] `visual.spec.ts:84:3` › T-VIS-002: Panels and overlays › export modal
- [ ] `visual.spec.ts:99:3` › T-VIS-003: ToolShelf interactions › toolshelf default state
- [ ] `visual.spec.ts:106:3` › T-VIS-003: ToolShelf interactions › toolshelf draw category selected
- [ ] `visual.spec.ts:122:3` › T-VIS-004: Status bar states › status bar online state
