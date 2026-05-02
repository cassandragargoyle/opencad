/**
 * T-AI-01 (#428): AI copilot natural-language command parser.
 *
 * Parses plain-English design commands into structured ActionIntent objects
 * that the document store can execute without an LLM round-trip.
 *
 * This module contains the intent taxonomy and a deterministic rule-based
 * parser for common commands.  The AI layer (packages/ai) wraps this with
 * an LLM fallback for commands that don't match a rule.
 */

// ── Intent types ──────────────────────────────────────────────────────────────

export type ActionKind =
  | 'add-room'
  | 'change-material'
  | 'resize-element'
  | 'move-element'
  | 'delete-element'
  | 'set-property'
  | 'show-category'
  | 'hide-category'
  | 'unknown';

export interface ActionIntent {
  kind: ActionKind;
  /** Confidence score [0, 1] */
  confidence: number;
  /** Parsed parameters, specific to each ActionKind */
  params: Record<string, string | number | boolean>;
  /** Original user utterance */
  utterance: string;
}

// ── Rule definitions ──────────────────────────────────────────────────────────

interface Rule {
  kind: ActionKind;
  pattern: RegExp;
  extract: (m: RegExpMatchArray) => Record<string, string | number | boolean>;
  confidence: number;
}

const RULES: Rule[] = [
  // "add a 20m² meeting room" / "add meeting room 30 square meters"
  {
    kind:    'add-room',
    pattern: /add\s+(?:a\s+)?(?:(\d+(?:\.\d+)?)\s*(?:m²|sqm|sq\.?m|square\s+meters?)?\s+)?(.+?)\s+(?:room|space|office)/i,
    extract: (m) => ({
      area:  m[1] ? parseFloat(m[1]) : 0,
      name:  (m[2] ?? '').trim(),
    }),
    confidence: 0.85,
  },
  // "change the floor material to oak" / "set wall material to concrete"
  {
    kind:    'change-material',
    pattern: /(?:change|set|make)\s+(?:the\s+)?(\w+)\s+material\s+to\s+(.+)/i,
    extract: (m) => ({
      category: (m[1] ?? '').toLowerCase(),
      material: (m[2] ?? '').trim(),
    }),
    confidence: 0.9,
  },
  // "resize wall W1 to 5m" / "make the window 1.2 wide"
  {
    kind:    'resize-element',
    pattern: /(?:resize|make|set)\s+(?:the\s+)?(\w+)\s+(?:(\w+)\s+)?to\s+(\d+(?:\.\d+)?)\s*m?/i,
    extract: (m) => ({
      elementType: (m[1] ?? '').toLowerCase(),
      elementId:   (m[2] ?? '').trim(),
      valueMm:     parseFloat(m[3] ?? '0') * 1000,
    }),
    confidence: 0.8,
  },
  // "hide walls" / "hide mep-duct category"
  {
    kind:    'hide-category',
    pattern: /hide\s+(?:all\s+)?(?:the\s+)?(\w[\w-]*)\s*(?:category|elements?)?/i,
    extract: (m) => ({ category: (m[1] ?? '').toLowerCase() }),
    confidence: 0.9,
  },
  // "show floors" / "show all windows"
  {
    kind:    'show-category',
    pattern: /show\s+(?:all\s+)?(?:the\s+)?(\w[\w-]*)\s*(?:category|elements?)?/i,
    extract: (m) => ({ category: (m[1] ?? '').toLowerCase() }),
    confidence: 0.9,
  },
  // "delete element E42" / "remove wall W1"
  {
    kind:    'delete-element',
    pattern: /(?:delete|remove)\s+(?:the\s+)?(?:\w+\s+)?(\w+[-_]?\w*\d+)/i,
    extract: (m) => ({ elementId: (m[1] ?? '').trim() }),
    confidence: 0.85,
  },
  // "set wall height to 3000mm" / "set ceiling height to 2.7m"
  {
    kind:    'set-property',
    pattern: /set\s+(\w[\w\s-]*?)\s+to\s+(\d+(?:\.\d+)?)\s*(mm|m|cm)?/i,
    extract: (m) => {
      const raw = parseFloat(m[2] ?? '0');
      const unit = (m[3] ?? 'm').toLowerCase();
      const valueMm = unit === 'mm' ? raw : unit === 'cm' ? raw * 10 : raw * 1000;
      return { property: (m[1] ?? '').trim().toLowerCase(), valueMm };
    },
    confidence: 0.75,
  },
];

// ── Parser ────────────────────────────────────────────────────────────────────

/**
 * Parse a natural-language command string into a structured ActionIntent.
 *
 * Applies rules in order; returns the first match.  If no rule matches,
 * returns an intent with kind='unknown' and confidence=0.
 *
 * @param utterance  User's natural-language command
 */
export function parseCommand(utterance: string): ActionIntent {
  const cleaned = utterance.trim().replace(/\s+/g, ' ');

  for (const rule of RULES) {
    const m = cleaned.match(rule.pattern);
    if (m) {
      return {
        kind:       rule.kind,
        confidence: rule.confidence,
        params:     rule.extract(m),
        utterance:  cleaned,
      };
    }
  }

  return { kind: 'unknown', confidence: 0, params: {}, utterance: cleaned };
}

/**
 * Parse multiple commands from a newline- or semicolon-delimited string.
 */
export function parseCommands(input: string): ActionIntent[] {
  return input
    .split(/[\n;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map(parseCommand);
}

// ── Suggestion helpers ────────────────────────────────────────────────────────

/**
 * Generate autocomplete suggestions for a partial utterance.
 * Returns up to `limit` suggestion strings.
 */
export function suggestCompletions(partial: string, limit = 5): string[] {
  const templates = [
    'Add a {area}m² {name} room',
    'Change the {category} material to {material}',
    'Resize {element} to {value}m',
    'Hide {category}',
    'Show {category}',
    'Delete element {id}',
    'Set wall height to {value}mm',
    'Set floor material to {material}',
  ];

  const lower = partial.toLowerCase();
  return templates
    .filter((t) => t.toLowerCase().startsWith(lower) || lower.split(' ').some((w) => t.toLowerCase().includes(w)))
    .slice(0, limit);
}

/**
 * True if the intent represents a destructive operation (delete, hide).
 */
export function isDestructiveIntent(intent: ActionIntent): boolean {
  return intent.kind === 'delete-element' || intent.kind === 'hide-category';
}
