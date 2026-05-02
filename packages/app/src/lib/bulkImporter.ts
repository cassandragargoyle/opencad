/**
 * T-LIB-V2-03: Bulk file importer utilities.
 * Manages queuing, progress tracking, and format detection for bulk imports.
 */

export type ImportFormat = 'skp' | 'ifc' | 'rfa' | 'obj' | 'fbx' | 'gltf';

export interface BulkImportFile {
  name: string;
  format: ImportFormat;
  sizeBytes: number;
}

export interface BulkImportJob {
  id: string;
  files: BulkImportFile[];
  status: 'queued' | 'processing' | 'done' | 'failed';
  progress: number;
  errors: string[];
}

export const MAX_FILE_SIZES: Record<ImportFormat, number> = {
  skp: 500 * 1024 * 1024,   // 500 MB
  ifc: 200 * 1024 * 1024,   // 200 MB
  rfa: 100 * 1024 * 1024,   // 100 MB
  obj: 150 * 1024 * 1024,   // 150 MB
  fbx: 300 * 1024 * 1024,   // 300 MB
  gltf: 250 * 1024 * 1024,  // 250 MB
};

const FORMAT_EXTENSIONS: Record<string, ImportFormat> = {
  skp: 'skp',
  ifc: 'ifc',
  rfa: 'rfa',
  obj: 'obj',
  fbx: 'fbx',
  gltf: 'gltf',
  glb: 'gltf',
};

let _jobCounter = 0;

function generateJobId(): string {
  _jobCounter += 1;
  return `job-${Date.now()}-${_jobCounter}`;
}

export function detectFormat(filename: string): ImportFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return FORMAT_EXTENSIONS[ext] ?? null;
}

export function validateFileSize(sizeBytes: number, format: ImportFormat): boolean {
  return sizeBytes <= MAX_FILE_SIZES[format];
}

export function createBulkImportJob(
  files: Array<{ name: string; format: ImportFormat; sizeBytes: number }>,
): BulkImportJob {
  return {
    id: generateJobId(),
    files: files.map((f) => ({ name: f.name, format: f.format, sizeBytes: f.sizeBytes })),
    status: 'queued',
    progress: 0,
    errors: [],
  };
}

export function updateJobProgress(job: BulkImportJob, progress: number): BulkImportJob {
  const clamped = Math.max(0, Math.min(100, progress));
  const newStatus: BulkImportJob['status'] =
    clamped >= 100 ? 'done' : clamped > 0 ? 'processing' : job.status;
  return { ...job, progress: clamped, status: newStatus };
}

export interface JobSummary {
  total: number;
  done: number;
  failed: number;
  pending: number;
}

export function summarizeJob(job: BulkImportJob): JobSummary {
  const total = job.files.length;
  const done = job.status === 'done' ? total : 0;
  const failed = job.status === 'failed' ? total : 0;
  const pending = total - done - failed;
  return { total, done, failed, pending };
}
