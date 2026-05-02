/**
 * T-COL-02: Element ownership / worksharing locks atop CRDT.
 *
 * Provides an optimistic lock layer on top of the CRDT document.
 * Any peer can *claim* ownership of an element; while claimed, other peers
 * receive a read-only view and cannot mutate that element.  Releases are
 * immediate; orphaned claims expire after `ttlMs` (default 30 minutes).
 *
 * Design decisions:
 *   - State is kept in `DocumentSchema.content.elements[id].metadata` via
 *     a `_lock` pseudo-property — no schema changes needed.
 *   - Lock acquisition is optimistic: the peer records its claim immediately
 *     and detects conflicts on the next sync.
 *   - The CRDT merge policy for `_lock` is "last-writer-wins on timestamp",
 *     so the newer claim wins over an older one during conflict resolution.
 */
import type { DocumentSchema } from './types';

// ── Lock record ───────────────────────────────────────────────────────────────

export interface OwnershipLock {
  /** Peer ID that holds the lock */
  peerId: string;
  /** Display name (for UI tooltip) */
  peerName?: string;
  /** Unix timestamp (ms) when the lock was acquired */
  acquiredAt: number;
  /** TTL in ms (default 30 minutes) */
  ttlMs: number;
}


// ── In-memory lock store ──────────────────────────────────────────────────────

export class OwnershipStore {
  private locks = new Map<string, OwnershipLock>();
  private readonly defaultTtlMs: number;

  constructor(defaultTtlMs = 30 * 60 * 1000) {
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Attempt to acquire a lock on elementId for peerId.
   * Returns true if the lock was acquired (or refreshed for the same peer).
   * Returns false if another peer holds a non-expired lock.
   */
  acquire(elementId: string, peerId: string, peerName?: string): boolean {
    const existing = this.locks.get(elementId);
    if (existing) {
      if (!this.isExpired(existing) && existing.peerId !== peerId) {
        return false; // another peer owns it
      }
    }
    this.locks.set(elementId, {
      peerId,
      peerName,
      acquiredAt: Date.now(),
      ttlMs: this.defaultTtlMs,
    });
    return true;
  }

  /**
   * Release the lock on elementId.
   * Only the owning peer (or the server) should call this.
   * Returns true if the lock was released; false if peerId doesn't own it.
   */
  release(elementId: string, peerId: string): boolean {
    const lock = this.locks.get(elementId);
    if (!lock) return true; // already released
    if (lock.peerId !== peerId && !this.isExpired(lock)) return false;
    this.locks.delete(elementId);
    return true;
  }

  /** Force-release (admin / server override). */
  forceRelease(elementId: string): void {
    this.locks.delete(elementId);
  }

  /** Get the current lock for an element, or null if unlocked / expired. */
  getLock(elementId: string): OwnershipLock | null {
    const lock = this.locks.get(elementId);
    if (!lock || this.isExpired(lock)) {
      if (lock) this.locks.delete(elementId); // prune expired
      return null;
    }
    return lock;
  }

  /** True if the peer can edit elementId (owns the lock or it's unlocked). */
  canEdit(elementId: string, peerId: string): boolean {
    const lock = this.getLock(elementId);
    return !lock || lock.peerId === peerId;
  }

  /** True if another peer holds a non-expired lock. */
  isLocked(elementId: string, viewingPeerId: string): boolean {
    const lock = this.getLock(elementId);
    return !!lock && lock.peerId !== viewingPeerId;
  }

  /** Release all locks held by a peer (called on disconnect). */
  releaseAllForPeer(peerId: string): number {
    let count = 0;
    for (const [id, lock] of this.locks) {
      if (lock.peerId === peerId) {
        this.locks.delete(id);
        count++;
      }
    }
    return count;
  }

  /** Prune expired locks and return the count removed. */
  pruneExpired(): number {
    let count = 0;
    for (const [id, lock] of this.locks) {
      if (this.isExpired(lock)) {
        this.locks.delete(id);
        count++;
      }
    }
    return count;
  }

  /** All currently active (non-expired) locks. */
  activeLocks(): Map<string, OwnershipLock> {
    const result = new Map<string, OwnershipLock>();
    for (const [id, lock] of this.locks) {
      if (!this.isExpired(lock)) result.set(id, lock);
    }
    return result;
  }

  private isExpired(lock: OwnershipLock): boolean {
    return Date.now() - lock.acquiredAt > lock.ttlMs;
  }

  /** Serialise to a plain object for CRDT sync. */
  serialise(): Record<string, OwnershipLock> {
    const out: Record<string, OwnershipLock> = {};
    for (const [id, lock] of this.locks) {
      if (!this.isExpired(lock)) out[id] = lock;
    }
    return out;
  }

  /** Merge remote lock state (last-writer-wins on acquiredAt). */
  mergeRemote(remote: Record<string, OwnershipLock>): void {
    for (const [id, remoteLock] of Object.entries(remote)) {
      if (this.isExpired(remoteLock)) continue;
      const local = this.locks.get(id);
      if (!local || remoteLock.acquiredAt > local.acquiredAt) {
        this.locks.set(id, remoteLock);
      }
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Return all locked element ids for a document and peer. */
export function getLockedElementIds(
  store: OwnershipStore,
  doc: DocumentSchema,
  viewingPeerId: string,
): string[] {
  return Object.keys(doc.content.elements).filter((id) =>
    store.isLocked(id, viewingPeerId),
  );
}
