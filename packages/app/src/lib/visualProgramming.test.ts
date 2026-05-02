/**
 * T-EXT-V2-02: Visual programming tests
 */
import { describe, it, expect } from 'vitest';
import {
  validateGraph,
  topologicalSort,
  executeGraph,
  detectCycle,
  type VPGraph,
} from './visualProgramming';

// Simple linear graph: const -> math -> output
const simpleGraph: VPGraph = {
  nodes: [
    { id: 'n-const', type: 'constant', inputs: [], outputs: ['value'], params: { value: 10 } },
    { id: 'n-const2', type: 'constant', inputs: [], outputs: ['value'], params: { value: 5 } },
    { id: 'n-add', type: 'math', inputs: ['a', 'b'], outputs: ['result'], params: { operation: 'add' } },
    { id: 'n-out', type: 'output', inputs: ['value'], outputs: ['value'], params: { name: 'sum' } },
  ],
  edges: [
    { id: 'e1', fromNodeId: 'n-const', fromPort: 'value', toNodeId: 'n-add', toPort: 'a' },
    { id: 'e2', fromNodeId: 'n-const2', fromPort: 'value', toNodeId: 'n-add', toPort: 'b' },
    { id: 'e3', fromNodeId: 'n-add', fromPort: 'result', toNodeId: 'n-out', toPort: 'value' },
  ],
};

describe('validateGraph', () => {
  it('validates a correct graph', () => {
    const result = validateGraph(simpleGraph);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects edge referencing missing source node', () => {
    const bad: VPGraph = {
      nodes: [{ id: 'n1', type: 'output', inputs: ['v'], outputs: ['v'], params: {} }],
      edges: [{ id: 'e1', fromNodeId: 'missing', fromPort: 'v', toNodeId: 'n1', toPort: 'v' }],
    };
    const result = validateGraph(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('missing'))).toBe(true);
  });

  it('detects edge referencing missing target node', () => {
    const bad: VPGraph = {
      nodes: [{ id: 'n1', type: 'constant', inputs: [], outputs: ['v'], params: { value: 1 } }],
      edges: [{ id: 'e1', fromNodeId: 'n1', fromPort: 'v', toNodeId: 'missing', toPort: 'v' }],
    };
    const result = validateGraph(bad);
    expect(result.valid).toBe(false);
  });

  it('detects duplicate node IDs', () => {
    const bad: VPGraph = {
      nodes: [
        { id: 'n1', type: 'constant', inputs: [], outputs: ['v'], params: { value: 1 } },
        { id: 'n1', type: 'constant', inputs: [], outputs: ['v'], params: { value: 2 } },
      ],
      edges: [],
    };
    const result = validateGraph(bad);
    expect(result.valid).toBe(false);
  });

  it('validates an empty graph', () => {
    const result = validateGraph({ nodes: [], edges: [] });
    expect(result.valid).toBe(true);
  });
});

describe('detectCycle', () => {
  it('returns false for acyclic graph', () => {
    expect(detectCycle(simpleGraph)).toBe(false);
  });

  it('returns true for graph with cycle', () => {
    const cyclic: VPGraph = {
      nodes: [
        { id: 'a', type: 'math', inputs: ['x'], outputs: ['y'], params: {} },
        { id: 'b', type: 'math', inputs: ['x'], outputs: ['y'], params: {} },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'a', fromPort: 'y', toNodeId: 'b', toPort: 'x' },
        { id: 'e2', fromNodeId: 'b', fromPort: 'y', toNodeId: 'a', toPort: 'x' },
      ],
    };
    expect(detectCycle(cyclic)).toBe(true);
  });

  it('returns false for empty graph', () => {
    expect(detectCycle({ nodes: [], edges: [] })).toBe(false);
  });

  it('returns false for single node', () => {
    const g: VPGraph = {
      nodes: [{ id: 'n1', type: 'constant', inputs: [], outputs: ['v'], params: { value: 1 } }],
      edges: [],
    };
    expect(detectCycle(g)).toBe(false);
  });
});

describe('topologicalSort', () => {
  it('returns null for cyclic graph', () => {
    const cyclic: VPGraph = {
      nodes: [
        { id: 'a', type: 'math', inputs: ['x'], outputs: ['y'], params: {} },
        { id: 'b', type: 'math', inputs: ['x'], outputs: ['y'], params: {} },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'a', fromPort: 'y', toNodeId: 'b', toPort: 'x' },
        { id: 'e2', fromNodeId: 'b', fromPort: 'y', toNodeId: 'a', toPort: 'x' },
      ],
    };
    expect(topologicalSort(cyclic)).toBeNull();
  });

  it('returns sorted order for acyclic graph', () => {
    const order = topologicalSort(simpleGraph);
    expect(order).not.toBeNull();
    expect(order!).toHaveLength(4);
    // n-const and n-const2 should come before n-add
    expect(order!.indexOf('n-const')).toBeLessThan(order!.indexOf('n-add'));
    expect(order!.indexOf('n-const2')).toBeLessThan(order!.indexOf('n-add'));
    // n-add should come before n-out
    expect(order!.indexOf('n-add')).toBeLessThan(order!.indexOf('n-out'));
  });

  it('returns single node for trivial graph', () => {
    const g: VPGraph = {
      nodes: [{ id: 'n1', type: 'constant', inputs: [], outputs: ['v'], params: { value: 1 } }],
      edges: [],
    };
    expect(topologicalSort(g)).toEqual(['n1']);
  });
});

describe('executeGraph', () => {
  it('executes constant + math + output', () => {
    const result = executeGraph(simpleGraph, {});
    expect(result['sum']).toBe(15); // 10 + 5
  });

  it('executes subtraction', () => {
    const g: VPGraph = {
      nodes: [
        { id: 'c1', type: 'constant', inputs: [], outputs: ['value'], params: { value: 20 } },
        { id: 'c2', type: 'constant', inputs: [], outputs: ['value'], params: { value: 8 } },
        { id: 'sub', type: 'math', inputs: ['a', 'b'], outputs: ['result'], params: { operation: 'sub' } },
        { id: 'out', type: 'output', inputs: ['value'], outputs: ['value'], params: { name: 'result' } },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'c1', fromPort: 'value', toNodeId: 'sub', toPort: 'a' },
        { id: 'e2', fromNodeId: 'c2', fromPort: 'value', toNodeId: 'sub', toPort: 'b' },
        { id: 'e3', fromNodeId: 'sub', fromPort: 'result', toNodeId: 'out', toPort: 'value' },
      ],
    };
    const result = executeGraph(g, {});
    expect(result['result']).toBe(12);
  });

  it('executes multiplication', () => {
    const g: VPGraph = {
      nodes: [
        { id: 'c1', type: 'constant', inputs: [], outputs: ['value'], params: { value: 6 } },
        { id: 'c2', type: 'constant', inputs: [], outputs: ['value'], params: { value: 7 } },
        { id: 'mul', type: 'math', inputs: ['a', 'b'], outputs: ['result'], params: { operation: 'mul' } },
        { id: 'out', type: 'output', inputs: ['value'], outputs: ['value'], params: { name: 'product' } },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'c1', fromPort: 'value', toNodeId: 'mul', toPort: 'a' },
        { id: 'e2', fromNodeId: 'c2', fromPort: 'value', toNodeId: 'mul', toPort: 'b' },
        { id: 'e3', fromNodeId: 'mul', fromPort: 'result', toNodeId: 'out', toPort: 'value' },
      ],
    };
    expect(executeGraph(g, {})['product']).toBe(42);
  });

  it('executes logic AND', () => {
    const g: VPGraph = {
      nodes: [
        { id: 'c1', type: 'constant', inputs: [], outputs: ['value'], params: { value: true } },
        { id: 'c2', type: 'constant', inputs: [], outputs: ['value'], params: { value: false } },
        { id: 'and', type: 'logic', inputs: ['a', 'b'], outputs: ['result'], params: { operation: 'and' } },
        { id: 'out', type: 'output', inputs: ['value'], outputs: ['value'], params: { name: 'bool' } },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'c1', fromPort: 'value', toNodeId: 'and', toPort: 'a' },
        { id: 'e2', fromNodeId: 'c2', fromPort: 'value', toNodeId: 'and', toPort: 'b' },
        { id: 'e3', fromNodeId: 'and', fromPort: 'result', toNodeId: 'out', toPort: 'value' },
      ],
    };
    expect(executeGraph(g, {})['bool']).toBe(false);
  });

  it('executes logic NOT', () => {
    const g: VPGraph = {
      nodes: [
        { id: 'c1', type: 'constant', inputs: [], outputs: ['value'], params: { value: false } },
        { id: 'not', type: 'logic', inputs: ['a'], outputs: ['result'], params: { operation: 'not' } },
        { id: 'out', type: 'output', inputs: ['value'], outputs: ['value'], params: { name: 'bool' } },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'c1', fromPort: 'value', toNodeId: 'not', toPort: 'a' },
        { id: 'e2', fromNodeId: 'not', fromPort: 'result', toNodeId: 'out', toPort: 'value' },
      ],
    };
    expect(executeGraph(g, {})['bool']).toBe(true);
  });

  it('throws for cyclic graph', () => {
    const cyclic: VPGraph = {
      nodes: [
        { id: 'a', type: 'math', inputs: ['x'], outputs: ['y'], params: {} },
        { id: 'b', type: 'math', inputs: ['x'], outputs: ['y'], params: {} },
      ],
      edges: [
        { id: 'e1', fromNodeId: 'a', fromPort: 'y', toNodeId: 'b', toPort: 'x' },
        { id: 'e2', fromNodeId: 'b', fromPort: 'y', toNodeId: 'a', toPort: 'x' },
      ],
    };
    expect(() => executeGraph(cyclic, {})).toThrow(/cycle/i);
  });
});
