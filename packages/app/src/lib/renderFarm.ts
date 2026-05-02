/**
 * T-PRES-V2-01: Distributed render farm management utilities.
 */

export interface RenderJob {
  id: string;
  sceneId: string;
  frameRange: { start: number; end: number };
  width: number;
  height: number;
  samples: number;
  status: 'queued' | 'running' | 'done' | 'failed';
  progress: number;
  outputUrls: string[];
}

export interface RenderNode {
  id: string;
  gpuModel: string;
  availableVRAM_GB: number;
  status: 'idle' | 'busy';
}

export interface RenderFarm {
  nodes: RenderNode[];
  jobs: RenderJob[];
}

let _jobCounter = 0;

function generateJobId(): string {
  _jobCounter += 1;
  return `rjob-${Date.now()}-${_jobCounter}`;
}

export function createRenderFarm(nodes: RenderNode[]): RenderFarm {
  return { nodes: [...nodes], jobs: [] };
}

export function submitJob(
  farm: RenderFarm,
  job: Omit<RenderJob, 'id' | 'status' | 'progress' | 'outputUrls'>,
): RenderFarm {
  const newJob: RenderJob = {
    ...job,
    id: generateJobId(),
    status: 'queued',
    progress: 0,
    outputUrls: [],
  };
  return { ...farm, jobs: [...farm.jobs, newJob] };
}

export function assignJobToNode(farm: RenderFarm, jobId: string): RenderFarm {
  const jobIndex = farm.jobs.findIndex((j) => j.id === jobId);
  if (jobIndex === -1) return farm;

  const job = farm.jobs[jobIndex];
  if (job.status !== 'queued') return farm;

  const nodeIndex = farm.nodes.findIndex((n) => n.status === 'idle');
  if (nodeIndex === -1) return farm; // no idle nodes

  const updatedNodes = farm.nodes.map((node, i) =>
    i === nodeIndex ? { ...node, status: 'busy' as const } : node,
  );

  const updatedJobs = farm.jobs.map((j, i) =>
    i === jobIndex ? { ...j, status: 'running' as const } : j,
  );

  return { ...farm, nodes: updatedNodes, jobs: updatedJobs };
}

/**
 * Estimates render time in seconds.
 * Formula: frames * samples * (1 / vram_factor) where vram_factor = availableVRAM_GB / 8
 * More VRAM = faster render.
 */
export function estimateRenderTime(job: RenderJob, node: RenderNode): number {
  const frames = job.frameRange.end - job.frameRange.start + 1;
  const vramFactor = node.availableVRAM_GB / 8;
  return frames * job.samples * (1 / Math.max(vramFactor, 0.001));
}

export interface FarmProgress {
  total: number;
  running: number;
  done: number;
  queued: number;
}

export function computeRenderProgress(farm: RenderFarm): FarmProgress {
  const total = farm.jobs.length;
  const running = farm.jobs.filter((j) => j.status === 'running').length;
  const done = farm.jobs.filter((j) => j.status === 'done').length;
  const queued = farm.jobs.filter((j) => j.status === 'queued').length;
  return { total, running, done, queued };
}
