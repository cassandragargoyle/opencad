/**
 * T-PRES-V2-01: Render farm tests
 */
import { describe, it, expect } from 'vitest';
import {
  createRenderFarm,
  submitJob,
  assignJobToNode,
  estimateRenderTime,
  computeRenderProgress,
  type RenderNode,
} from './renderFarm';

const sampleNodes: RenderNode[] = [
  { id: 'node-1', gpuModel: 'RTX 4090', availableVRAM_GB: 24, status: 'idle' },
  { id: 'node-2', gpuModel: 'RTX 3080', availableVRAM_GB: 10, status: 'idle' },
];

const sampleJobSpec = {
  sceneId: 'scene-001',
  frameRange: { start: 1, end: 10 },
  width: 1920,
  height: 1080,
  samples: 128,
};

describe('createRenderFarm', () => {
  it('creates farm with provided nodes', () => {
    const farm = createRenderFarm(sampleNodes);
    expect(farm.nodes).toHaveLength(2);
    expect(farm.jobs).toHaveLength(0);
  });

  it('does not mutate original nodes array', () => {
    const originalNodes = [...sampleNodes];
    createRenderFarm(sampleNodes);
    expect(sampleNodes).toHaveLength(originalNodes.length);
  });

  it('creates farm with no nodes', () => {
    const farm = createRenderFarm([]);
    expect(farm.nodes).toHaveLength(0);
  });
});

describe('submitJob', () => {
  it('adds a new job with queued status', () => {
    const farm = createRenderFarm(sampleNodes);
    const updated = submitJob(farm, sampleJobSpec);
    expect(updated.jobs).toHaveLength(1);
    expect(updated.jobs[0].status).toBe('queued');
    expect(updated.jobs[0].progress).toBe(0);
    expect(updated.jobs[0].outputUrls).toEqual([]);
  });

  it('assigns an id to the job', () => {
    const farm = createRenderFarm(sampleNodes);
    const updated = submitJob(farm, sampleJobSpec);
    expect(typeof updated.jobs[0].id).toBe('string');
    expect(updated.jobs[0].id.length).toBeGreaterThan(0);
  });

  it('assigns unique ids to multiple jobs', () => {
    let farm = createRenderFarm(sampleNodes);
    farm = submitJob(farm, sampleJobSpec);
    farm = submitJob(farm, sampleJobSpec);
    expect(farm.jobs[0].id).not.toBe(farm.jobs[1].id);
  });

  it('does not mutate original farm', () => {
    const farm = createRenderFarm(sampleNodes);
    submitJob(farm, sampleJobSpec);
    expect(farm.jobs).toHaveLength(0);
  });

  it('preserves existing jobs', () => {
    let farm = createRenderFarm(sampleNodes);
    farm = submitJob(farm, sampleJobSpec);
    farm = submitJob(farm, { ...sampleJobSpec, sceneId: 'scene-002' });
    expect(farm.jobs).toHaveLength(2);
  });
});

describe('assignJobToNode', () => {
  it('assigns first queued job to first idle node', () => {
    let farm = createRenderFarm(sampleNodes);
    farm = submitJob(farm, sampleJobSpec);
    const jobId = farm.jobs[0].id;
    const updated = assignJobToNode(farm, jobId);
    expect(updated.jobs[0].status).toBe('running');
    expect(updated.nodes[0].status).toBe('busy');
  });

  it('does not assign when no idle nodes', () => {
    const busyNodes: RenderNode[] = sampleNodes.map((n) => ({ ...n, status: 'busy' as const }));
    let farm = createRenderFarm(busyNodes);
    farm = submitJob(farm, sampleJobSpec);
    const jobId = farm.jobs[0].id;
    const updated = assignJobToNode(farm, jobId);
    expect(updated.jobs[0].status).toBe('queued');
  });

  it('returns unchanged farm for unknown job id', () => {
    const farm = createRenderFarm(sampleNodes);
    const updated = assignJobToNode(farm, 'nonexistent');
    expect(updated).toEqual(farm);
  });

  it('does not assign a non-queued job', () => {
    let farm = createRenderFarm(sampleNodes);
    farm = submitJob(farm, sampleJobSpec);
    const jobId = farm.jobs[0].id;
    farm = assignJobToNode(farm, jobId); // now running
    const again = assignJobToNode(farm, jobId);
    // Node status should not change again
    expect(again.nodes.filter((n) => n.status === 'busy')).toHaveLength(1);
  });
});

describe('estimateRenderTime', () => {
  it('returns positive estimate', () => {
    let farm = createRenderFarm(sampleNodes);
    farm = submitJob(farm, sampleJobSpec);
    const job = farm.jobs[0];
    const time = estimateRenderTime(job, sampleNodes[0]);
    expect(time).toBeGreaterThan(0);
  });

  it('high VRAM node renders faster than low VRAM node', () => {
    let farm = createRenderFarm(sampleNodes);
    farm = submitJob(farm, sampleJobSpec);
    const job = farm.jobs[0];
    const timeHigh = estimateRenderTime(job, sampleNodes[0]); // 24 GB
    const timeLow = estimateRenderTime(job, sampleNodes[1]);  // 10 GB
    expect(timeHigh).toBeLessThan(timeLow);
  });

  it('longer frame range takes more time', () => {
    let farm = createRenderFarm(sampleNodes);
    farm = submitJob(farm, { ...sampleJobSpec, frameRange: { start: 1, end: 10 } });
    farm = submitJob(farm, { ...sampleJobSpec, frameRange: { start: 1, end: 100 } });
    const shortTime = estimateRenderTime(farm.jobs[0], sampleNodes[0]);
    const longTime = estimateRenderTime(farm.jobs[1], sampleNodes[0]);
    expect(longTime).toBeGreaterThan(shortTime);
  });
});

describe('computeRenderProgress', () => {
  it('returns zeros for empty farm', () => {
    const farm = createRenderFarm(sampleNodes);
    const progress = computeRenderProgress(farm);
    expect(progress).toEqual({ total: 0, running: 0, done: 0, queued: 0 });
  });

  it('counts queued jobs', () => {
    let farm = createRenderFarm(sampleNodes);
    farm = submitJob(farm, sampleJobSpec);
    farm = submitJob(farm, sampleJobSpec);
    const progress = computeRenderProgress(farm);
    expect(progress.total).toBe(2);
    expect(progress.queued).toBe(2);
    expect(progress.running).toBe(0);
  });

  it('counts running jobs after assignment', () => {
    let farm = createRenderFarm(sampleNodes);
    farm = submitJob(farm, sampleJobSpec);
    farm = assignJobToNode(farm, farm.jobs[0].id);
    const progress = computeRenderProgress(farm);
    expect(progress.running).toBe(1);
    expect(progress.queued).toBe(0);
  });

  it('counts done jobs', () => {
    let farm = createRenderFarm(sampleNodes);
    farm = submitJob(farm, sampleJobSpec);
    farm = submitJob(farm, sampleJobSpec);
    // Manually set one to done
    farm = {
      ...farm,
      jobs: farm.jobs.map((j, i) => i === 0 ? { ...j, status: 'done' as const } : j),
    };
    const progress = computeRenderProgress(farm);
    expect(progress.done).toBe(1);
    expect(progress.queued).toBe(1);
    expect(progress.total).toBe(2);
  });
});
