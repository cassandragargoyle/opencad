/**
 * T-VIEW-02: Unit tests for tagSystem — annotation tag template engine.
 */
import { describe, it, expect } from 'vitest';
import {
  resolveTag,
  buildTagLabel,
  type TagTemplate,
} from './tagSystem';
import type { ElementSchema } from '@opencad/document';

function makeElement(type: string, props: Record<string, unknown> = {}): ElementSchema {
  return {
    id: 'el-1',
    type: type as ElementSchema['type'],
    layerId: 'l0',
    levelId: 'lv0',
    locked: false,
    visible: true,
    properties: Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, v])
    ),
    geometry: { type: 'point', x: 0, y: 0 },
  };
}

describe('T-VIEW-02: tagSystem', () => {
  it('resolves a simple property binding', () => {
    const el = makeElement('door', { Width: 900, Height: 2100 });
    const result = resolveTag(el, '{Width}');
    expect(result).toBe('900');
  });

  it('resolves multiple bindings in one template', () => {
    const el = makeElement('door', { Width: 900, Height: 2100 });
    const result = resolveTag(el, '{Width} × {Height}');
    expect(result).toBe('900 × 2100');
  });

  it('returns empty string for unknown property', () => {
    const el = makeElement('wall', { Thickness: 200 });
    const result = resolveTag(el, '{Mark}');
    expect(result).toBe('');
  });

  it('resolves element type as {Type}', () => {
    const el = makeElement('window', {});
    const result = resolveTag(el, '{Type}');
    expect(result).toBe('window');
  });

  it('resolves element id as {Id}', () => {
    const el = makeElement('wall', {});
    el.id = 'wall-abc123';
    const result = resolveTag(el, '{Id}');
    expect(result).toBe('wall-abc123');
  });

  it('handles template with no bindings', () => {
    const el = makeElement('door', {});
    const result = resolveTag(el, 'Door Tag');
    expect(result).toBe('Door Tag');
  });

  it('resolves nested property with dot notation (Level.Name)', () => {
    const el = makeElement('wall', { 'Level.Name': 'Ground Floor' });
    const result = resolveTag(el, '{Level.Name}');
    expect(result).toBe('Ground Floor');
  });

  // ── buildTagLabel ────────────────────────────────────────────────────────

  it('buildTagLabel formats with type prefix', () => {
    const el = makeElement('door', { Mark: 'D01', Width: 900 });
    const tmpl: TagTemplate = {
      elementType: 'door',
      lines: ['{Mark}', '{Width}'],
    };
    const label = buildTagLabel(el, tmpl);
    expect(label).toHaveLength(2);
    expect(label[0]).toBe('D01');
    expect(label[1]).toBe('900');
  });

  it('buildTagLabel falls back to element type if Mark is absent', () => {
    const el = makeElement('wall', { Thickness: 200 });
    const tmpl: TagTemplate = {
      elementType: 'wall',
      lines: ['{Mark}', '{Thickness}'],
    };
    const label = buildTagLabel(el, tmpl);
    expect(label[0]).toBe('');
    expect(label[1]).toBe('200');
  });

  it('returns empty lines array for empty template', () => {
    const el = makeElement('slab', {});
    const tmpl: TagTemplate = { elementType: 'slab', lines: [] };
    const label = buildTagLabel(el, tmpl);
    expect(label).toHaveLength(0);
  });

  // ── built-in tag templates ────────────────────────────────────────────────

  it('DOOR_TAG template resolves Width × Height', () => {
    const el = makeElement('door', { Mark: 'D01', Width: 900, Height: 2100 });
    const result = resolveTag(el, '{Mark}: {Width}×{Height}');
    expect(result).toBe('D01: 900×2100');
  });
});
