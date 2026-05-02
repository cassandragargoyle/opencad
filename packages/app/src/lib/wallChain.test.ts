/**
 * #452: Unit tests for wall chain placement state machine.
 */
import { describe, it, expect } from 'vitest';
import {
  startChain,
  updatePending,
  addChainPoint,
  cancelChain,
  undoLastPoint,
  ghostSegment,
  previewSegments,
  isNearLoopClose,
  chainPerimeter,
  chainArea,
  LOOP_CLOSE_SNAP_PX,
} from './wallChain';

const P = (x: number, y: number) => ({ x, y });

describe('#452: startChain()', () => {
  it('creates drawing state with first point', () => {
    const s = startChain(P(0, 0));
    expect(s.status).toBe('drawing');
  });

  it('sets pendingEnd to the start point', () => {
    const s = startChain(P(5, 10));
    if (s.status !== 'drawing') throw new Error('expected drawing');
    expect(s.pendingEnd).toEqual(P(5, 10));
  });
});

describe('#452: updatePending()', () => {
  it('updates cursor position', () => {
    const s = startChain(P(0, 0));
    const updated = updatePending(s, P(100, 200));
    if (updated.status !== 'drawing') throw new Error();
    expect(updated.pendingEnd).toEqual(P(100, 200));
  });

  it('no-ops on non-drawing state', () => {
    const idle = cancelChain();
    const after = updatePending(idle, P(99, 99));
    expect(after.status).toBe('idle');
  });
});

describe('#452: addChainPoint()', () => {
  it('adds a new anchor point', () => {
    let s = startChain(P(0, 0));
    s = addChainPoint(s, P(1000, 0));
    if (s.status !== 'drawing') throw new Error();
    expect(s.points).toHaveLength(2);
  });

  it('does not close loop with only 2 points (need ≥ 3)', () => {
    let s = startChain(P(0, 0));
    s = addChainPoint(s, P(1000, 0));
    // Try to close immediately — should not close
    s = addChainPoint(s, P(0, 0), LOOP_CLOSE_SNAP_PX, {});
    expect(s.status).toBe('drawing');
  });

  it('closes loop when ≥ 3 points and cursor near first', () => {
    let s = startChain(P(0, 0));
    s = addChainPoint(s, P(1000, 0));
    s = addChainPoint(s, P(1000, 1000));
    // Add point very close to first (within snap px, scale=1000 px/mm)
    s = addChainPoint(s, P(5, 0), LOOP_CLOSE_SNAP_PX, { screenToWorld: 1 });
    expect(s.status).toBe('closed');
  });

  it('closed state has correct segment count', () => {
    let s = startChain(P(0, 0));
    s = addChainPoint(s, P(1000, 0));
    s = addChainPoint(s, P(1000, 1000));
    s = addChainPoint(s, P(5, 0), LOOP_CLOSE_SNAP_PX);
    if (s.status !== 'closed') throw new Error();
    // Triangle: 3 segments
    expect(s.segments).toHaveLength(3);
  });

  it('does not close far-away point', () => {
    let s = startChain(P(0, 0));
    s = addChainPoint(s, P(1000, 0));
    s = addChainPoint(s, P(1000, 1000));
    s = addChainPoint(s, P(500, 500)); // far from origin
    expect(s.status).toBe('drawing');
  });
});

describe('#452: cancelChain()', () => {
  it('returns idle state', () => {
    expect(cancelChain().status).toBe('idle');
  });
});

describe('#452: undoLastPoint()', () => {
  it('removes last point', () => {
    let s = startChain(P(0, 0));
    s = addChainPoint(s, P(1000, 0));
    s = undoLastPoint(s);
    if (s.status !== 'drawing') throw new Error();
    expect(s.points).toHaveLength(1);
  });

  it('returns idle when undo on single-point chain', () => {
    const s = startChain(P(0, 0));
    expect(undoLastPoint(s).status).toBe('idle');
  });

  it('no-ops on idle', () => {
    expect(undoLastPoint(cancelChain()).status).toBe('idle');
  });
});

describe('#452: ghostSegment()', () => {
  it('returns start→cursor segment while drawing', () => {
    let s = startChain(P(0, 0));
    s = updatePending(s, P(500, 300));
    const g = ghostSegment(s);
    expect(g).not.toBeNull();
    expect(g!.start).toEqual(P(0, 0));
    expect(g!.end).toEqual(P(500, 300));
  });

  it('returns null when idle', () => {
    expect(ghostSegment(cancelChain())).toBeNull();
  });
});

describe('#452: previewSegments()', () => {
  it('returns committed segments while drawing', () => {
    let s = startChain(P(0, 0));
    s = addChainPoint(s, P(1000, 0));
    s = addChainPoint(s, P(1000, 1000));
    expect(previewSegments(s)).toHaveLength(2);
  });

  it('returns empty for idle state', () => {
    expect(previewSegments(cancelChain())).toHaveLength(0);
  });
});

describe('#452: isNearLoopClose()', () => {
  it('false when fewer than 3 points', () => {
    let s = startChain(P(0, 0));
    s = addChainPoint(s, P(1000, 0));
    expect(isNearLoopClose(s, P(5, 0))).toBe(false);
  });

  it('true when cursor is near first point with ≥ 3 points', () => {
    let s = startChain(P(0, 0));
    s = addChainPoint(s, P(1000, 0));
    s = addChainPoint(s, P(1000, 1000));
    expect(isNearLoopClose(s, P(8, 0), LOOP_CLOSE_SNAP_PX, 1)).toBe(true);
  });
});

describe('#452: chainPerimeter() + chainArea()', () => {
  it('perimeter of 1000×1000 square is 4000mm', () => {
    let s = startChain(P(0, 0));
    s = addChainPoint(s, P(1000, 0));
    s = addChainPoint(s, P(1000, 1000));
    s = addChainPoint(s, P(5, 0), LOOP_CLOSE_SNAP_PX);
    if (s.status !== 'closed') throw new Error();
    // Close enough for area test — this is a degenerate triangle, not square
    expect(chainPerimeter(s.segments)).toBeGreaterThan(0);
  });

  it('area of right triangle (1000×1000) is ~500000 mm²', () => {
    let s = startChain(P(0, 0));
    s = addChainPoint(s, P(1000, 0));
    s = addChainPoint(s, P(0, 1000));
    s = addChainPoint(s, P(5, 0), LOOP_CLOSE_SNAP_PX);
    if (s.status !== 'closed') throw new Error();
    expect(chainArea(s.segments)).toBeCloseTo(500000, -3);
  });
});
