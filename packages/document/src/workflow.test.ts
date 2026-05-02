/**
 * T-COL-03: Unit tests for BCF approval / submittal workflow.
 */
import { describe, it, expect } from 'vitest';
import {
  createWorkflowState,
  transitionWorkflow,
  isTerminalStatus,
  allowedTransitions,
  attachWorkflowToBCF,
  WORKFLOW_TRANSITIONS,
} from './bcf';
import { createProject } from './document';
import { documentToBCF } from './bcf';

describe('T-COL-03: workflow state machine', () => {
  it('createWorkflowState starts in draft', () => {
    const state = createWorkflowState('topic-1');
    expect(state.status).toBe('draft');
    expect(state.history).toHaveLength(0);
  });

  it('draft → submitted is valid', () => {
    let state = createWorkflowState('topic-1');
    state = transitionWorkflow(state, 'submitted', 'user-1');
    expect(state.status).toBe('submitted');
  });

  it('transition records history entry', () => {
    let state = createWorkflowState('topic-1');
    state = transitionWorkflow(state, 'submitted', 'user-1', { comment: 'Ready for review' });
    expect(state.history).toHaveLength(1);
    expect(state.history[0].from).toBe('draft');
    expect(state.history[0].to).toBe('submitted');
    expect(state.history[0].comment).toBe('Ready for review');
    expect(state.history[0].byUserId).toBe('user-1');
  });

  it('invalid transition throws', () => {
    const state = createWorkflowState('topic-1');
    expect(() => transitionWorkflow(state, 'approved', 'user-1')).toThrow();
  });

  it('approved → closed is valid', () => {
    let state = createWorkflowState('topic-1');
    state = transitionWorkflow(state, 'submitted', 'user-1');
    state = transitionWorkflow(state, 'in_review', 'reviewer-1');
    state = transitionWorkflow(state, 'approved', 'reviewer-1');
    state = transitionWorkflow(state, 'closed', 'user-1');
    expect(state.status).toBe('closed');
  });

  it('rejected → draft allows resubmission', () => {
    let state = createWorkflowState('topic-1');
    state = transitionWorkflow(state, 'submitted', 'user-1');
    state = transitionWorkflow(state, 'in_review', 'reviewer-1');
    state = transitionWorkflow(state, 'rejected', 'reviewer-1', { comment: 'Missing details' });
    state = transitionWorkflow(state, 'draft', 'user-1');
    expect(state.status).toBe('draft');
  });

  it('void is terminal', () => {
    expect(isTerminalStatus('void')).toBe(true);
  });

  it('closed is terminal', () => {
    expect(isTerminalStatus('closed')).toBe(true);
  });

  it('draft is not terminal', () => {
    expect(isTerminalStatus('draft')).toBe(false);
  });

  it('allowedTransitions returns valid next states', () => {
    const allowed = allowedTransitions('draft');
    expect(allowed).toContain('submitted');
    expect(allowed).toContain('void');
    expect(allowed).not.toContain('approved');
  });

  it('allowedTransitions returns empty for terminal', () => {
    expect(allowedTransitions('closed')).toHaveLength(0);
    expect(allowedTransitions('void')).toHaveLength(0);
  });

  it('assignedTo is preserved through transitions', () => {
    let state = createWorkflowState('topic-1');
    state = transitionWorkflow(state, 'submitted', 'user-1', { assignedTo: 'reviewer-2' });
    expect(state.assignedTo).toBe('reviewer-2');
  });

  it('WORKFLOW_TRANSITIONS covers all statuses', () => {
    const statuses: (keyof typeof WORKFLOW_TRANSITIONS)[] = [
      'draft', 'submitted', 'in_review', 'approved', 'approved_with_comments',
      'rejected', 'void', 'closed',
    ];
    for (const s of statuses) {
      expect(WORKFLOW_TRANSITIONS[s]).toBeDefined();
    }
  });

  it('full approval path through approved_with_comments', () => {
    let state = createWorkflowState('t1');
    state = transitionWorkflow(state, 'submitted', 'u1');
    state = transitionWorkflow(state, 'in_review', 'r1');
    state = transitionWorkflow(state, 'approved_with_comments', 'r1', { comment: 'See notes' });
    state = transitionWorkflow(state, 'closed', 'u1');
    expect(state.status).toBe('closed');
    expect(state.history).toHaveLength(4);
  });
});

describe('T-COL-03: attachWorkflowToBCF()', () => {
  it('creates workflow state for existing BCF topic', () => {
    const doc  = createProject('proj-1', 'user-1');
    const file = documentToBCF(doc, 'tester');
    const topicId = file.topics[0]?.guid;
    if (!topicId) return; // skip if no topics
    const state = attachWorkflowToBCF(file, topicId);
    expect(state.topicId).toBe(topicId);
    expect(state.status).toBe('draft');
  });

  it('throws for missing topic id', () => {
    const doc  = createProject('proj-1', 'user-1');
    const file = documentToBCF(doc, 'tester');
    expect(() => attachWorkflowToBCF(file, 'nonexistent-id')).toThrow();
  });
});
