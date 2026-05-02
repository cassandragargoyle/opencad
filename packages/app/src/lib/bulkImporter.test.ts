/**
 * T-LIB-V2-03: Bulk importer tests
 */
import { describe, it, expect } from 'vitest';
import {
  createBulkImportJob,
  updateJobProgress,
  detectFormat,
  validateFileSize,
  summarizeJob,
  MAX_FILE_SIZES,
  type ImportFormat,
} from './bulkImporter';

describe('detectFormat', () => {
  it('detects skp', () => expect(detectFormat('model.skp')).toBe('skp'));
  it('detects ifc', () => expect(detectFormat('building.ifc')).toBe('ifc'));
  it('detects rfa', () => expect(detectFormat('door.rfa')).toBe('rfa'));
  it('detects obj', () => expect(detectFormat('mesh.obj')).toBe('obj'));
  it('detects fbx', () => expect(detectFormat('scene.fbx')).toBe('fbx'));
  it('detects gltf', () => expect(detectFormat('model.gltf')).toBe('gltf'));
  it('detects glb as gltf', () => expect(detectFormat('model.glb')).toBe('gltf'));
  it('is case-insensitive', () => expect(detectFormat('MODEL.IFC')).toBe('ifc'));
  it('returns null for unknown extension', () => expect(detectFormat('document.pdf')).toBeNull());
  it('returns null for no extension', () => expect(detectFormat('noextension')).toBeNull());
});

describe('validateFileSize', () => {
  it('accepts file within limit', () => {
    expect(validateFileSize(10 * 1024 * 1024, 'ifc')).toBe(true);
  });

  it('accepts file exactly at limit', () => {
    expect(validateFileSize(MAX_FILE_SIZES['ifc'], 'ifc')).toBe(true);
  });

  it('rejects file above limit', () => {
    expect(validateFileSize(MAX_FILE_SIZES['ifc'] + 1, 'ifc')).toBe(false);
  });

  it('validates different formats', () => {
    expect(validateFileSize(400 * 1024 * 1024, 'skp')).toBe(true);
    expect(validateFileSize(600 * 1024 * 1024, 'skp')).toBe(false);
  });
});

describe('MAX_FILE_SIZES', () => {
  it('has entries for all formats', () => {
    const formats: ImportFormat[] = ['skp', 'ifc', 'rfa', 'obj', 'fbx', 'gltf'];
    for (const f of formats) {
      expect(MAX_FILE_SIZES[f]).toBeGreaterThan(0);
    }
  });
});

describe('createBulkImportJob', () => {
  it('creates a job with queued status and zero progress', () => {
    const job = createBulkImportJob([{ name: 'a.ifc', format: 'ifc', sizeBytes: 1000 }]);
    expect(job.status).toBe('queued');
    expect(job.progress).toBe(0);
    expect(job.errors).toEqual([]);
  });

  it('assigns a unique id', () => {
    const j1 = createBulkImportJob([]);
    const j2 = createBulkImportJob([]);
    expect(j1.id).not.toBe(j2.id);
  });

  it('stores provided files', () => {
    const files = [
      { name: 'a.ifc', format: 'ifc' as ImportFormat, sizeBytes: 500 },
      { name: 'b.skp', format: 'skp' as ImportFormat, sizeBytes: 1000 },
    ];
    const job = createBulkImportJob(files);
    expect(job.files).toHaveLength(2);
    expect(job.files[0].name).toBe('a.ifc');
  });

  it('creates empty job with no files', () => {
    const job = createBulkImportJob([]);
    expect(job.files).toHaveLength(0);
  });
});

describe('updateJobProgress', () => {
  const baseJob = createBulkImportJob([{ name: 'a.ifc', format: 'ifc', sizeBytes: 100 }]);

  it('updates progress', () => {
    const updated = updateJobProgress(baseJob, 50);
    expect(updated.progress).toBe(50);
  });

  it('sets status to processing when progress > 0 and < 100', () => {
    const updated = updateJobProgress(baseJob, 30);
    expect(updated.status).toBe('processing');
  });

  it('sets status to done when progress reaches 100', () => {
    const updated = updateJobProgress(baseJob, 100);
    expect(updated.status).toBe('done');
  });

  it('clamps progress to 0-100', () => {
    expect(updateJobProgress(baseJob, -10).progress).toBe(0);
    expect(updateJobProgress(baseJob, 150).progress).toBe(100);
  });

  it('does not mutate original job', () => {
    updateJobProgress(baseJob, 75);
    expect(baseJob.progress).toBe(0);
  });
});

describe('summarizeJob', () => {
  it('reports all pending for queued job', () => {
    const job = createBulkImportJob([
      { name: 'a.ifc', format: 'ifc', sizeBytes: 100 },
      { name: 'b.ifc', format: 'ifc', sizeBytes: 100 },
    ]);
    const summary = summarizeJob(job);
    expect(summary.total).toBe(2);
    expect(summary.pending).toBe(2);
    expect(summary.done).toBe(0);
    expect(summary.failed).toBe(0);
  });

  it('reports all done for completed job', () => {
    let job = createBulkImportJob([
      { name: 'a.ifc', format: 'ifc', sizeBytes: 100 },
      { name: 'b.ifc', format: 'ifc', sizeBytes: 100 },
    ]);
    job = updateJobProgress(job, 100);
    const summary = summarizeJob(job);
    expect(summary.done).toBe(2);
    expect(summary.pending).toBe(0);
  });

  it('reports all failed for failed job', () => {
    const job = { ...createBulkImportJob([{ name: 'x.rfa', format: 'rfa' as ImportFormat, sizeBytes: 1 }]), status: 'failed' as const };
    const summary = summarizeJob(job);
    expect(summary.failed).toBe(1);
    expect(summary.done).toBe(0);
  });
});
