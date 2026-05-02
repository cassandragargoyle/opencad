/**
 * T-EXT-V2-02: Visual programming graph utilities.
 * Validates and executes a node-graph representation of visual programs.
 */

export type NodeType = 'input' | 'output' | 'math' | 'logic' | 'geometry' | 'transform' | 'constant';

export interface VPNode {
  id: string;
  type: NodeType;
  inputs: string[];
  outputs: string[];
  params: Record<string, unknown>;
}

export interface VPEdge {
  id: string;
  fromNodeId: string;
  fromPort: string;
  toNodeId: string;
  toPort: string;
}

export interface VPGraph {
  nodes: VPNode[];
  edges: VPEdge[];
}

export function validateGraph(graph: VPGraph): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  // Check for duplicate node ids
  if (nodeIds.size !== graph.nodes.length) {
    errors.push('Duplicate node IDs detected');
  }

  // Check edges reference valid nodes
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.fromNodeId)) {
      errors.push(`Edge '${edge.id}' references unknown source node '${edge.fromNodeId}'`);
    }
    if (!nodeIds.has(edge.toNodeId)) {
      errors.push(`Edge '${edge.id}' references unknown target node '${edge.toNodeId}'`);
    }
  }

  // Check for duplicate edge ids
  const edgeIds = new Set(graph.edges.map((e) => e.id));
  if (edgeIds.size !== graph.edges.length) {
    errors.push('Duplicate edge IDs detected');
  }

  return { valid: errors.length === 0, errors };
}

export function detectCycle(graph: VPGraph): boolean {
  // Build adjacency list
  const adj = new Map<string, string[]>();
  for (const node of graph.nodes) {
    adj.set(node.id, []);
  }
  for (const edge of graph.edges) {
    const list = adj.get(edge.fromNodeId);
    if (list) list.push(edge.toNodeId);
  }

  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (stack.has(nodeId)) return true; // cycle detected
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    stack.add(nodeId);

    const neighbors = adj.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      if (dfs(neighbor)) return true;
    }

    stack.delete(nodeId);
    return false;
  }

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      if (dfs(node.id)) return true;
    }
  }

  return false;
}

/**
 * Returns node IDs in topological order (sources first) or null if cycle exists.
 */
export function topologicalSort(graph: VPGraph): string[] | null {
  if (detectCycle(graph)) return null;

  // Kahn's algorithm
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const node of graph.nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  for (const edge of graph.edges) {
    adj.get(edge.fromNodeId)?.push(edge.toNodeId);
    inDegree.set(edge.toNodeId, (inDegree.get(edge.toNodeId) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    result.push(nodeId);
    for (const neighbor of adj.get(nodeId) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  return result;
}

/**
 * Executes the graph with the given inputs.
 * Supported node types:
 *   - constant: returns params.value
 *   - input: returns the matching value from inputs
 *   - math: supports add/sub/mul/div via params.operation
 *   - logic: supports and/or/not via params.operation
 *   - output: passes through its first input
 */
export function executeGraph(
  graph: VPGraph,
  inputs: Record<string, unknown>,
): Record<string, unknown> {
  const order = topologicalSort(graph);
  if (order === null) {
    throw new Error('Cannot execute graph with cycles');
  }

  const nodeMap = new Map<string, VPNode>(graph.nodes.map((n) => [n.id, n]));
  const nodeOutputs = new Map<string, Record<string, unknown>>();

  // Build edge map: toNodeId + toPort -> { fromNodeId, fromPort }
  type EdgeInfo = { fromNodeId: string; fromPort: string };
  const edgeMap = new Map<string, EdgeInfo>();
  for (const edge of graph.edges) {
    edgeMap.set(`${edge.toNodeId}:${edge.toPort}`, {
      fromNodeId: edge.fromNodeId,
      fromPort: edge.fromPort,
    });
  }

  function getInput(nodeId: string, port: string): unknown {
    const key = `${nodeId}:${port}`;
    const edgeInfo = edgeMap.get(key);
    if (!edgeInfo) return undefined;
    const sourceOutputs = nodeOutputs.get(edgeInfo.fromNodeId);
    return sourceOutputs?.[edgeInfo.fromPort];
  }

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId)!;
    const outputs: Record<string, unknown> = {};

    switch (node.type) {
      case 'constant': {
        const outPort = node.outputs[0] ?? 'value';
        outputs[outPort] = node.params['value'];
        break;
      }
      case 'input': {
        const portName = (node.params['name'] as string) ?? node.id;
        const outPort = node.outputs[0] ?? 'value';
        outputs[outPort] = inputs[portName] ?? inputs[node.id];
        break;
      }
      case 'output': {
        const inVal = getInput(nodeId, node.inputs[0] ?? 'value');
        const outPort = node.outputs[0] ?? 'value';
        outputs[outPort] = inVal;
        break;
      }
      case 'math': {
        const a = getInput(nodeId, 'a') as number ?? 0;
        const b = getInput(nodeId, 'b') as number ?? 0;
        const op = (node.params['operation'] as string) ?? 'add';
        let result: number;
        switch (op) {
          case 'add': result = a + b; break;
          case 'sub': result = a - b; break;
          case 'mul': result = a * b; break;
          case 'div': result = b !== 0 ? a / b : 0; break;
          default: result = a + b;
        }
        outputs['result'] = result;
        break;
      }
      case 'logic': {
        const op = (node.params['operation'] as string) ?? 'and';
        if (op === 'not') {
          const a = getInput(nodeId, 'a');
          outputs['result'] = !a;
        } else {
          const a = getInput(nodeId, 'a');
          const b = getInput(nodeId, 'b');
          outputs['result'] = op === 'and' ? Boolean(a) && Boolean(b) : Boolean(a) || Boolean(b);
        }
        break;
      }
      default: {
        // geometry, transform — pass through
        for (const port of node.outputs) {
          outputs[port] = getInput(nodeId, node.inputs[0] ?? 'value');
        }
      }
    }

    nodeOutputs.set(nodeId, outputs);
  }

  // Collect output node results
  const result: Record<string, unknown> = {};
  for (const node of graph.nodes) {
    if (node.type === 'output') {
      const name = (node.params['name'] as string) ?? node.id;
      const outPort = node.outputs[0] ?? 'value';
      result[name] = nodeOutputs.get(node.id)?.[outPort];
    }
  }

  return result;
}
