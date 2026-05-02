/**
 * T-VIS-V2-01 (#418): View-scoped visibility state saved on ViewSchema.
 * T-VIS-V2-02 (#419): Ghost / half-tone render mode.
 *
 * Provides:
 *   - ViewVisibilityState: per-category and per-element overrides
 *   - GhostMode: half-tone / ghost render configuration
 *   - Helpers to compute effective visibility for any element
 */

// ── Element category ──────────────────────────────────────────────────────────

export type ElementCategory =
  | 'walls'
  | 'floors'
  | 'roofs'
  | 'columns'
  | 'beams'
  | 'doors'
  | 'windows'
  | 'stairs'
  | 'ramps'
  | 'spaces'
  | 'mep-duct'
  | 'mep-pipe'
  | 'mep-cable'
  | 'site'
  | 'annotation'
  | 'grids'
  | 'levels'
  | 'links'
  | 'furniture'
  | 'generic';

// ── Visibility state ──────────────────────────────────────────────────────────

export interface CategoryOverride {
  visible: boolean;
  /** If set, overrides the element's natural opacity (0–1). */
  opacity?: number;
  /** If set, overrides the element's rendered colour. */
  colour?: string;
  /** Apply ghost mode to this category. */
  ghost?: boolean;
}

export interface ElementOverride {
  visible: boolean;
  opacity?: number;
  colour?: string;
  ghost?: boolean;
}

export interface ViewVisibilityState {
  viewId: string;
  /** Per-category defaults for this view. */
  categoryOverrides: Partial<Record<ElementCategory, CategoryOverride>>;
  /** Per-element id overrides (strongest precedence). */
  elementOverrides: Record<string, ElementOverride>;
  /** Global opacity multiplier for all elements (used for section cut fade). */
  globalOpacity: number;
}

export function createViewVisibility(viewId: string): ViewVisibilityState {
  return {
    viewId,
    categoryOverrides: {},
    elementOverrides: {},
    globalOpacity: 1,
  };
}

// ── Ghost / half-tone render mode ─────────────────────────────────────────────

export interface GhostModeConfig {
  /** Elements/categories in ghost mode render at this opacity. */
  ghostOpacity: number;
  /** Ghost elements use this colour (grayscale for half-tone effect). */
  ghostColour: string;
  /** True to apply half-tone dot pattern (CSS filter or shader). */
  halfTone: boolean;
  /** Categories that are ghosted in this view (rest are full opacity). */
  ghostedCategories: ElementCategory[];
  /** Element ids that are pinned as full-opacity (never ghosted). */
  pinnedElementIds: string[];
}

export const DEFAULT_GHOST_CONFIG: GhostModeConfig = {
  ghostOpacity:      0.15,
  ghostColour:       '#888888',
  halfTone:          false,
  ghostedCategories: [],
  pinnedElementIds:  [],
};

// ── Visibility resolution ─────────────────────────────────────────────────────

export interface ResolvedVisibility {
  visible: boolean;
  opacity: number;
  colour?: string;
  ghost: boolean;
}

/**
 * Compute effective visibility for an element in a view.
 * Precedence (highest → lowest):
 *   1. Per-element override
 *   2. Per-category override
 *   3. Global opacity
 *   4. Defaults (visible, opacity=1, no ghost)
 */
export function resolveElementVisibility(
  elementId: string,
  category: ElementCategory,
  viewVis: ViewVisibilityState,
  ghostConfig?: GhostModeConfig,
): ResolvedVisibility {
  // 1. Per-element override (strongest)
  const elOvr = viewVis.elementOverrides[elementId];
  if (elOvr) {
    const baseOpacity = (elOvr.opacity ?? 1) * viewVis.globalOpacity;
    return {
      visible: elOvr.visible,
      opacity: baseOpacity,
      colour:  elOvr.colour,
      ghost:   elOvr.ghost ?? false,
    };
  }

  // 2. Per-category override
  const catOvr = viewVis.categoryOverrides[category];
  const catVisible = catOvr?.visible ?? true;
  const catOpacity = (catOvr?.opacity ?? 1) * viewVis.globalOpacity;
  const catGhost   = catOvr?.ghost ?? false;

  // 3. Ghost mode
  let ghost = catGhost;
  let opacity = catOpacity;
  let colour  = catOvr?.colour;

  if (ghostConfig) {
    const isPinned  = ghostConfig.pinnedElementIds.includes(elementId);
    const isGhosted = !isPinned && ghostConfig.ghostedCategories.includes(category);
    if (isGhosted) {
      ghost   = true;
      opacity = ghostConfig.ghostOpacity * viewVis.globalOpacity;
      colour  = ghostConfig.ghostColour;
    }
  }

  return { visible: catVisible, opacity, colour, ghost };
}

// ── Mutation helpers (immutable updates) ─────────────────────────────────────

/** Set category visibility. Returns new state. */
export function setCategoryVisible(
  state: ViewVisibilityState,
  category: ElementCategory,
  visible: boolean,
): ViewVisibilityState {
  return {
    ...state,
    categoryOverrides: {
      ...state.categoryOverrides,
      [category]: { ...state.categoryOverrides[category], visible },
    },
  };
}

/** Set element visibility. Returns new state. */
export function setElementVisible(
  state: ViewVisibilityState,
  elementId: string,
  visible: boolean,
): ViewVisibilityState {
  return {
    ...state,
    elementOverrides: {
      ...state.elementOverrides,
      [elementId]: { ...state.elementOverrides[elementId], visible },
    },
  };
}

/** Set ghost mode on a category. Returns new state. */
export function setCategoryGhost(
  state: ViewVisibilityState,
  category: ElementCategory,
  ghost: boolean,
): ViewVisibilityState {
  return {
    ...state,
    categoryOverrides: {
      ...state.categoryOverrides,
      [category]: { ...state.categoryOverrides[category], visible: true, ghost },
    },
  };
}

/** Reset all overrides for this view. */
export function resetViewVisibility(viewId: string): ViewVisibilityState {
  return createViewVisibility(viewId);
}

/** Get all element ids that are overridden in this view. */
export function overriddenElementIds(state: ViewVisibilityState): string[] {
  return Object.keys(state.elementOverrides);
}

/** Get all hidden categories in this view. */
export function hiddenCategories(state: ViewVisibilityState): ElementCategory[] {
  return (Object.entries(state.categoryOverrides) as [ElementCategory, CategoryOverride][])
    .filter(([, ovr]) => !ovr.visible)
    .map(([cat]) => cat);
}
