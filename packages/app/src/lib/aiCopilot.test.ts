/**
 * T-AI-01 (#428): AI copilot natural-language command parser tests.
 */
import { describe, it, expect } from 'vitest';
import {
  parseCommand,
  parseCommands,
  suggestCompletions,
  isDestructiveIntent,
} from './aiCopilot';

describe('T-AI-01: parseCommand() — add-room', () => {
  it('recognizes "add a meeting room"', () => {
    const intent = parseCommand('add a meeting room');
    expect(intent.kind).toBe('add-room');
    expect(intent.confidence).toBeGreaterThan(0.5);
  });

  it('extracts room name', () => {
    const intent = parseCommand('add a conference room');
    expect(intent.params['name']).toContain('conference');
  });

  it('extracts area when provided', () => {
    const intent = parseCommand('add a 30m² meeting room');
    expect(intent.params['area']).toBe(30);
  });
});

describe('T-AI-01: parseCommand() — change-material', () => {
  it('recognizes "change the floor material to oak"', () => {
    const intent = parseCommand('change the floor material to oak');
    expect(intent.kind).toBe('change-material');
  });

  it('extracts category and material', () => {
    const intent = parseCommand('set wall material to concrete');
    expect(intent.params['category']).toBe('wall');
    expect(intent.params['material']).toContain('concrete');
  });
});

describe('T-AI-01: parseCommand() — hide/show category', () => {
  it('recognizes "hide walls"', () => {
    const intent = parseCommand('hide walls');
    expect(intent.kind).toBe('hide-category');
    expect(intent.params['category']).toContain('wall');
  });

  it('recognizes "show all windows"', () => {
    const intent = parseCommand('show all windows');
    expect(intent.kind).toBe('show-category');
  });
});

describe('T-AI-01: parseCommand() — delete-element', () => {
  it('recognizes "delete element W42"', () => {
    const intent = parseCommand('delete element W42');
    expect(intent.kind).toBe('delete-element');
    expect(intent.params['elementId']).toBe('W42');
  });

  it('recognizes "remove wall W1"', () => {
    const intent = parseCommand('remove wall W1');
    expect(intent.kind).toBe('delete-element');
  });
});

describe('T-AI-01: parseCommand() — set-property', () => {
  it('recognizes "set floor slab thickness to 3000mm"', () => {
    const intent = parseCommand('set floor slab thickness to 3000mm');
    expect(intent.kind).toBe('set-property');
    expect(intent.params['valueMm']).toBe(3000);
  });

  it('converts meters to mm', () => {
    const intent = parseCommand('set floor-to-floor height to 3.5m');
    expect(intent.kind).toBe('set-property');
    expect(intent.params['valueMm']).toBeCloseTo(3500, 0);
  });
});

describe('T-AI-01: parseCommand() — unknown', () => {
  it('returns unknown for unrecognized input', () => {
    const intent = parseCommand('what is the meaning of life');
    expect(intent.kind).toBe('unknown');
    expect(intent.confidence).toBe(0);
  });

  it('preserves utterance in result', () => {
    const intent = parseCommand('nonsense input here');
    expect(intent.utterance).toBe('nonsense input here');
  });
});

describe('T-AI-01: parseCommands()', () => {
  it('parses multiple newline-separated commands', () => {
    const results = parseCommands('hide walls\nshow floors');
    expect(results).toHaveLength(2);
    expect(results[0]!.kind).toBe('hide-category');
    expect(results[1]!.kind).toBe('show-category');
  });

  it('parses semicolon-delimited commands', () => {
    const results = parseCommands('hide walls; show floors');
    expect(results).toHaveLength(2);
  });

  it('ignores blank lines', () => {
    const results = parseCommands('hide walls\n\n\nshow floors');
    expect(results).toHaveLength(2);
  });
});

describe('T-AI-01: suggestCompletions()', () => {
  it('returns an array of strings', () => {
    const suggestions = suggestCompletions('add');
    expect(Array.isArray(suggestions)).toBe(true);
    suggestions.forEach((s) => expect(typeof s).toBe('string'));
  });

  it('respects limit parameter', () => {
    const suggestions = suggestCompletions('a', 3);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });
});

describe('T-AI-01: isDestructiveIntent()', () => {
  it('returns true for delete-element', () => {
    const intent = parseCommand('delete element W1');
    expect(isDestructiveIntent(intent)).toBe(true);
  });

  it('returns true for hide-category', () => {
    const intent = parseCommand('hide walls');
    expect(isDestructiveIntent(intent)).toBe(true);
  });

  it('returns false for add-room', () => {
    const intent = parseCommand('add a meeting room');
    expect(isDestructiveIntent(intent)).toBe(false);
  });
});
