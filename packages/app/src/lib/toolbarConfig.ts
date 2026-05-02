/**
 * #451: Toolbar configuration — surface architectural tools first, hide
 * free-form drawing tools by default.
 *
 * Provides a typed tool registry with tier classification (primary vs secondary)
 * and a runtime override mechanism for user preferences.
 */

// ── Tool categories ───────────────────────────────────────────────────────────

export type ToolTier = 'primary' | 'secondary' | 'hidden';

export type ToolCategory =
  | 'walls'
  | 'floors'
  | 'roofs'
  | 'doors'
  | 'windows'
  | 'columns'
  | 'beams'
  | 'stairs'
  | 'ramps'
  | 'spaces'
  | 'mep'
  | 'annotation'
  | 'view'
  | 'site'
  | 'freeform'
  | 'modify';

export interface ToolDefinition {
  id: string;
  label: string;
  icon: string;
  category: ToolCategory;
  /** Default tier — can be overridden by user preferences. */
  defaultTier: ToolTier;
  /** Keyboard shortcut (single key, e.g. 'W' for walls) */
  shortcut?: string;
  /** True if tool can be used in 2D drafting view */
  supports2D: boolean;
  /** True if tool can be used in 3D view */
  supports3D: boolean;
}

// ── Tool registry ─────────────────────────────────────────────────────────────

export const TOOL_REGISTRY: ToolDefinition[] = [
  // ── Primary architectural tools ────────────────────────────────────────────
  { id: 'wall',         label: 'Wall',          icon: 'wall',         category: 'walls',      defaultTier: 'primary',   shortcut: 'W', supports2D: true,  supports3D: true  },
  { id: 'floor',        label: 'Floor',         icon: 'floor',        category: 'floors',     defaultTier: 'primary',   shortcut: 'F', supports2D: true,  supports3D: true  },
  { id: 'roof',         label: 'Roof',          icon: 'roof',         category: 'roofs',      defaultTier: 'primary',   shortcut: 'R', supports2D: true,  supports3D: true  },
  { id: 'door',         label: 'Door',          icon: 'door',         category: 'doors',      defaultTier: 'primary',   shortcut: 'D', supports2D: true,  supports3D: true  },
  { id: 'window',       label: 'Window',        icon: 'window',       category: 'windows',    defaultTier: 'primary',   shortcut: 'N', supports2D: true,  supports3D: true  },
  { id: 'column',       label: 'Column',        icon: 'column',       category: 'columns',    defaultTier: 'primary',                  supports2D: true,  supports3D: true  },
  { id: 'beam',         label: 'Beam',          icon: 'beam',         category: 'beams',      defaultTier: 'primary',                  supports2D: true,  supports3D: true  },
  { id: 'stair',        label: 'Stair',         icon: 'stair',        category: 'stairs',     defaultTier: 'primary',                  supports2D: true,  supports3D: true  },
  { id: 'ramp',         label: 'Ramp',          icon: 'ramp',         category: 'ramps',      defaultTier: 'primary',                  supports2D: true,  supports3D: true  },
  { id: 'space',        label: 'Space',         icon: 'space',        category: 'spaces',     defaultTier: 'primary',   shortcut: 'S', supports2D: true,  supports3D: false },

  // ── Modify ─────────────────────────────────────────────────────────────────
  { id: 'select',       label: 'Select',        icon: 'cursor',       category: 'modify',     defaultTier: 'primary',   shortcut: 'V', supports2D: true,  supports3D: true  },
  { id: 'move',         label: 'Move',          icon: 'move',         category: 'modify',     defaultTier: 'primary',   shortcut: 'M', supports2D: true,  supports3D: true  },
  { id: 'rotate',       label: 'Rotate',        icon: 'rotate',       category: 'modify',     defaultTier: 'primary',                  supports2D: true,  supports3D: true  },
  { id: 'mirror',       label: 'Mirror',        icon: 'mirror',       category: 'modify',     defaultTier: 'primary',                  supports2D: true,  supports3D: false },
  { id: 'trim',         label: 'Trim/Extend',   icon: 'trim',         category: 'modify',     defaultTier: 'primary',                  supports2D: true,  supports3D: false },
  { id: 'array',        label: 'Array',         icon: 'array',        category: 'modify',     defaultTier: 'secondary',                supports2D: true,  supports3D: true  },

  // ── Annotation ─────────────────────────────────────────────────────────────
  { id: 'dimension',    label: 'Dimension',     icon: 'dimension',    category: 'annotation', defaultTier: 'primary',                  supports2D: true,  supports3D: false },
  { id: 'tag',          label: 'Tag',           icon: 'tag',          category: 'annotation', defaultTier: 'primary',                  supports2D: true,  supports3D: false },
  { id: 'text',         label: 'Text',          icon: 'text',         category: 'annotation', defaultTier: 'primary',                  supports2D: true,  supports3D: false },

  // ── Site ───────────────────────────────────────────────────────────────────
  { id: 'topo',         label: 'Topography',    icon: 'terrain',      category: 'site',       defaultTier: 'secondary',                supports2D: false, supports3D: true  },
  { id: 'property-line',label: 'Prop. Line',    icon: 'boundary',     category: 'site',       defaultTier: 'secondary',                supports2D: true,  supports3D: false },
  { id: 'grading',      label: 'Grading',       icon: 'grading',      category: 'site',       defaultTier: 'secondary',                supports2D: true,  supports3D: true  },
  { id: 'tree',         label: 'Tree',          icon: 'tree',         category: 'site',       defaultTier: 'secondary',                supports2D: false, supports3D: true  },

  // ── MEP ────────────────────────────────────────────────────────────────────
  { id: 'duct',         label: 'Duct',          icon: 'duct',         category: 'mep',        defaultTier: 'secondary',                supports2D: true,  supports3D: true  },
  { id: 'pipe',         label: 'Pipe',          icon: 'pipe',         category: 'mep',        defaultTier: 'secondary',                supports2D: true,  supports3D: true  },

  // ── Free-form — secondary/hidden by default ────────────────────────────────
  { id: 'line',         label: 'Line',          icon: 'line',         category: 'freeform',   defaultTier: 'secondary',  shortcut: 'L', supports2D: true,  supports3D: false },
  { id: 'arc',          label: 'Arc',           icon: 'arc',          category: 'freeform',   defaultTier: 'secondary',                supports2D: true,  supports3D: false },
  { id: 'spline',       label: 'Spline',        icon: 'spline',       category: 'freeform',   defaultTier: 'hidden',                   supports2D: true,  supports3D: false },
  { id: 'rectangle',    label: 'Rectangle',     icon: 'rect',         category: 'freeform',   defaultTier: 'hidden',                   supports2D: true,  supports3D: false },
  { id: 'circle',       label: 'Circle',        icon: 'circle',       category: 'freeform',   defaultTier: 'hidden',                   supports2D: true,  supports3D: false },
  { id: 'polygon',      label: 'Polygon',       icon: 'polygon',      category: 'freeform',   defaultTier: 'hidden',                   supports2D: true,  supports3D: false },
  { id: 'cloud',        label: 'Rev. Cloud',    icon: 'cloud',        category: 'freeform',   defaultTier: 'hidden',                   supports2D: true,  supports3D: false },
  { id: 'freehand',     label: 'Freehand',      icon: 'pen',          category: 'freeform',   defaultTier: 'hidden',                   supports2D: true,  supports3D: false },
];

// ── Queries ───────────────────────────────────────────────────────────────────

/** Get tools by tier (respecting user overrides). */
export function getToolsByTier(
  tier: ToolTier,
  overrides: Record<string, ToolTier> = {},
): ToolDefinition[] {
  return TOOL_REGISTRY.filter((tool) => {
    const effective = overrides[tool.id] ?? tool.defaultTier;
    return effective === tier;
  });
}

/** Get all primary tools in display order. */
export function getPrimaryTools(overrides: Record<string, ToolTier> = {}): ToolDefinition[] {
  return getToolsByTier('primary', overrides);
}

/** Get all secondary (overflow) tools. */
export function getSecondaryTools(overrides: Record<string, ToolTier> = {}): ToolDefinition[] {
  return getToolsByTier('secondary', overrides);
}

/** Effective tier for a tool (merging user overrides). */
export function effectiveTier(toolId: string, overrides: Record<string, ToolTier> = {}): ToolTier {
  const tool = TOOL_REGISTRY.find((t) => t.id === toolId);
  if (!tool) return 'hidden';
  return overrides[toolId] ?? tool.defaultTier;
}

/** Find a tool by keyboard shortcut. */
export function toolByShortcut(key: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((t) => t.shortcut?.toUpperCase() === key.toUpperCase());
}

/** All freeform tools (hidden by default, accessible from overflow). */
export function getFreeformTools(): ToolDefinition[] {
  return TOOL_REGISTRY.filter((t) => t.category === 'freeform');
}

// ── User preference helpers ───────────────────────────────────────────────────

/**
 * Promote a freeform tool to secondary tier in user overrides.
 */
export function showFreeformTool(
  overrides: Record<string, ToolTier>,
  toolId: string,
): Record<string, ToolTier> {
  return { ...overrides, [toolId]: 'secondary' };
}

/**
 * Hide a tool from both primary and secondary (move to hidden).
 */
export function hideTool(
  overrides: Record<string, ToolTier>,
  toolId: string,
): Record<string, ToolTier> {
  return { ...overrides, [toolId]: 'hidden' };
}
