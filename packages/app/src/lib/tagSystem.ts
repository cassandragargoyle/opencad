/**
 * T-VIEW-02: Tag system — template engine that resolves property bindings
 * against element Psets (property sets) for annotation tags.
 *
 * Template syntax: `{PropertyName}` — e.g. `{Mark}: {Width}×{Height}`
 * Special bindings: `{Type}` → element.type, `{Id}` → element.id
 */
import type { ElementSchema } from '@opencad/document';

export interface TagTemplate {
  /** Element type this template applies to. */
  elementType: string;
  /** Lines of text to render in the tag bubble. */
  lines: string[];
}

/** Resolve `{PropertyName}` bindings in a template string against an element. */
export function resolveTag(el: ElementSchema, template: string): string {
  return template.replace(/\{([^}]+)\}/g, (_match, key: string) => {
    if (key === 'Type') return el.type;
    if (key === 'Id')   return el.id;
    const val = el.properties?.[key];
    if (val === undefined || val === null) return '';
    return String(val);
  });
}

/** Build an array of resolved label lines for a tag template. */
export function buildTagLabel(el: ElementSchema, tmpl: TagTemplate): string[] {
  return tmpl.lines.map((line) => resolveTag(el, line));
}

// ── Built-in tag templates ────────────────────────────────────────────────────

export const BUILTIN_TAG_TEMPLATES: TagTemplate[] = [
  { elementType: 'door',   lines: ['{Mark}', '{Width}×{Height}'] },
  { elementType: 'window', lines: ['{Mark}', '{Width}×{Height}'] },
  { elementType: 'wall',   lines: ['{Mark}', 'T={Thickness}'] },
  { elementType: 'room',   lines: ['{Name}', '{Area} m²'] },
  { elementType: 'column', lines: ['{Mark}', '{Width}×{Depth}'] },
  { elementType: 'beam',   lines: ['{Mark}', '{Width}×{Height}'] },
  { elementType: 'slab',   lines: ['{Mark}', 'T={Thickness}'] },
  { elementType: 'space',  lines: ['{Name}', '{Area} m²'] },
];

export function getTemplateForType(type: string): TagTemplate {
  return (
    BUILTIN_TAG_TEMPLATES.find((t) => t.elementType === type) ?? {
      elementType: type,
      lines: ['{Type}', '{Id}'],
    }
  );
}
