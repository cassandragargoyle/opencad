# E2E tests marked `test.fixme`

These E2E tests never actually ran in CI: `@opencad/e2e` ran Playwright from `e2e/` while the config lived at the repo root (where `@playwright/test` is not installed), so there was no webServer/baseURL — 60/62 failed and `continue-on-error: true` hid it. On Node 26 the job hangs until the 35 min timeout.

After fixing the config (moved to `e2e/playwright.config.ts`), a real run on Chromium gives **29 passed, 1 skipped, 31 failed** (+ `house-build.spec.ts`, which is an experiment harness and is now excluded unless `ITER` is set).

The failing tests are marked `test.fixme` pointing here so the passing ones can gate CI. Fix them and remove the `fixme`:

### Causes

- **`visual.spec.ts`** — no snapshot baselines are committed (and baselines are OS-specific); needs baselines generated in CI's environment (e.g. Playwright Docker image).
- **`smoke.spec.ts`** — targets the old pre-app UI (`h1 OpenCAD`, `.project-section`).
- **`document.spec.ts`** — selectors / globals from older UI; undo/redo and layer panel tests may be real regressions — verify.
- **`accessibility.spec.ts:126`** (W shortcut → wall tool), **`core-flows.spec.ts:133`** (viewport context menu) — verify whether behavior changed or regressed.

### Failing tests

- [ ] `accessibility.spec.ts:126:3` › T-A11Y-002: App shell accessibility › keyboard shortcut W activates wall tool
- [ ] `core-flows.spec.ts:133:3` › T-E2E-001: Core flows › T-E2E-001-006: context menu appears on right-click in viewport
- [ ] `document.spec.ts:14:5` › Document Model E2E Tests › T-DOC-001: Create project → verify document model initialized with correct schema › should create a document with corre
- [ ] `document.spec.ts:26:5` › Document Model E2E Tests › T-DOC-001: Create project → verify document model initialized with correct schema › should create a default layer named
- [ ] `document.spec.ts:36:5` › Document Model E2E Tests › T-DOC-001: Create project → verify document model initialized with correct schema › should create a default level with
- [ ] `document.spec.ts:49:5` › Document Model E2E Tests › T-DOC-002: Auto-save functionality › should save data when layer is added
- [ ] `document.spec.ts:60:5` › Document Model E2E Tests › T-DOC-002: Auto-save functionality › should save data when element is added
- [ ] `document.spec.ts:73:5` › Document Model E2E Tests › T-DOC-004: Import IFC › should parse IFC entities into elements
- [ ] `document.spec.ts:91:5` › Document Model E2E Tests › T-DOC-004: Import IFC › should map IFC types to OpenCAD element types
- [ ] `document.spec.ts:118:5` › Document Model E2E Tests › T-DOC-005: Export IFC › should export to valid IFC format
- [ ] `document.spec.ts:188:5` › Document Model E2E Tests › T-DOC-006: Version history › should restore version correctly
- [ ] `document.spec.ts:340:3` › T-E2E-001: Layer management › layer panel is accessible from the right panel
- [ ] `document.spec.ts:345:3` › T-E2E-001: Layer management › default layer "Default" exists
- [ ] `document.spec.ts:397:3` › T-E2E-001: Undo / Redo keyboard shortcuts › Ctrl+Z undoes the last action
- [ ] `document.spec.ts:419:3` › T-E2E-001: Undo / Redo keyboard shortcuts › Ctrl+Shift+Z redoes the last undone action
- [ ] `smoke.spec.ts:10:3` › Smoke Tests › should load the application
- [ ] `smoke.spec.ts:16:3` › Smoke Tests › should display project section
- [ ] `smoke.spec.ts:23:3` › Smoke Tests › should have functional layer creation
- [ ] `smoke.spec.ts:33:3` › Smoke Tests › should have functional element creation
- [ ] `smoke.spec.ts:43:3` › Smoke Tests › should update project name
- [ ] `smoke.spec.ts:72:3` › T-E2E-001: App shell › toolbar is visible
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
