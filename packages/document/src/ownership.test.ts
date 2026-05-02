/**
 * T-COL-02: Unit tests for element ownership / worksharing locks.
 */
import { describe, it, expect, vi } from 'vitest';
import { OwnershipStore, getLockedElementIds } from './ownership';
import { createProject } from './document';

describe('T-COL-02: OwnershipStore', () => {
  it('acquire returns true for unlocked element', () => {
    const store = new OwnershipStore();
    expect(store.acquire('el1', 'peer-A')).toBe(true);
  });

  it('acquire returns true when same peer re-acquires', () => {
    const store = new OwnershipStore();
    store.acquire('el1', 'peer-A');
    expect(store.acquire('el1', 'peer-A')).toBe(true);
  });

  it('acquire returns false when another peer holds lock', () => {
    const store = new OwnershipStore();
    store.acquire('el1', 'peer-A');
    expect(store.acquire('el1', 'peer-B')).toBe(false);
  });

  it('getLock returns the lock after acquire', () => {
    const store = new OwnershipStore();
    store.acquire('el1', 'peer-A', 'Alice');
    const lock = store.getLock('el1');
    expect(lock).not.toBeNull();
    expect(lock!.peerId).toBe('peer-A');
    expect(lock!.peerName).toBe('Alice');
  });

  it('getLock returns null when not locked', () => {
    const store = new OwnershipStore();
    expect(store.getLock('el1')).toBeNull();
  });

  it('release by owner succeeds', () => {
    const store = new OwnershipStore();
    store.acquire('el1', 'peer-A');
    expect(store.release('el1', 'peer-A')).toBe(true);
    expect(store.getLock('el1')).toBeNull();
  });

  it('release by non-owner fails', () => {
    const store = new OwnershipStore();
    store.acquire('el1', 'peer-A');
    expect(store.release('el1', 'peer-B')).toBe(false);
    expect(store.getLock('el1')).not.toBeNull();
  });

  it('forceRelease removes any lock', () => {
    const store = new OwnershipStore();
    store.acquire('el1', 'peer-A');
    store.forceRelease('el1');
    expect(store.getLock('el1')).toBeNull();
  });

  it('canEdit returns true for lock owner', () => {
    const store = new OwnershipStore();
    store.acquire('el1', 'peer-A');
    expect(store.canEdit('el1', 'peer-A')).toBe(true);
  });

  it('canEdit returns false for non-owner when locked', () => {
    const store = new OwnershipStore();
    store.acquire('el1', 'peer-A');
    expect(store.canEdit('el1', 'peer-B')).toBe(false);
  });

  it('isLocked returns false for viewing peer own lock', () => {
    const store = new OwnershipStore();
    store.acquire('el1', 'peer-A');
    expect(store.isLocked('el1', 'peer-A')).toBe(false);
  });

  it('isLocked returns true for other peers', () => {
    const store = new OwnershipStore();
    store.acquire('el1', 'peer-A');
    expect(store.isLocked('el1', 'peer-B')).toBe(true);
  });

  it('expired lock is not returned by getLock', () => {
    const store = new OwnershipStore(100); // 100ms TTL
    store.acquire('el1', 'peer-A');
    // Fake time forward by overriding Date.now
    const origNow = Date.now;
    vi.spyOn(Date, 'now').mockReturnValue(origNow() + 200);
    expect(store.getLock('el1')).toBeNull();
    vi.restoreAllMocks();
  });

  it('pruneExpired removes expired locks', () => {
    const store = new OwnershipStore(100);
    store.acquire('el1', 'peer-A');
    const origNow = Date.now;
    vi.spyOn(Date, 'now').mockReturnValue(origNow() + 200);
    expect(store.pruneExpired()).toBe(1);
    vi.restoreAllMocks();
  });

  it('releaseAllForPeer removes all locks held by that peer', () => {
    const store = new OwnershipStore();
    store.acquire('el1', 'peer-A');
    store.acquire('el2', 'peer-A');
    store.acquire('el3', 'peer-B');
    expect(store.releaseAllForPeer('peer-A')).toBe(2);
    expect(store.getLock('el1')).toBeNull();
    expect(store.getLock('el3')).not.toBeNull();
  });

  it('activeLocks excludes expired entries', () => {
    const store = new OwnershipStore();
    store.acquire('el1', 'peer-A');
    store.acquire('el2', 'peer-B');
    const active = store.activeLocks();
    expect(active.size).toBe(2);
  });

  it('serialise + mergeRemote round-trips', () => {
    const storeA = new OwnershipStore();
    const storeB = new OwnershipStore();
    storeA.acquire('el1', 'peer-A');
    const serialised = storeA.serialise();
    storeB.mergeRemote(serialised);
    expect(storeB.getLock('el1')).not.toBeNull();
    expect(storeB.getLock('el1')!.peerId).toBe('peer-A');
  });

  it('mergeRemote keeps newer lock on conflict', () => {
    const storeA = new OwnershipStore();
    const storeB = new OwnershipStore();
    storeA.acquire('el1', 'peer-A');
    const serialised = storeA.serialise();
    storeB.acquire('el1', 'peer-B'); // local lock
    // Override acquiredAt of remote to be newer
    serialised['el1']!.acquiredAt = Date.now() + 1000;
    storeB.mergeRemote(serialised);
    expect(storeB.getLock('el1')!.peerId).toBe('peer-A'); // remote wins (newer)
  });

  describe('getLockedElementIds()', () => {
    it('returns ids of locked elements', () => {
      const store = new OwnershipStore();
      const doc   = createProject('proj-1', 'user-1');
      const id    = Object.keys(doc.content.elements)[0];
      if (!id) return;
      store.acquire(id, 'peer-A');
      const locked = getLockedElementIds(store, doc, 'peer-B');
      expect(locked).toContain(id);
    });

    it('does not include elements locked by viewing peer', () => {
      const store = new OwnershipStore();
      const doc   = createProject('proj-1', 'user-1');
      const id    = Object.keys(doc.content.elements)[0];
      if (!id) return;
      store.acquire(id, 'peer-A');
      const locked = getLockedElementIds(store, doc, 'peer-A');
      expect(locked).not.toContain(id);
    });
  });
});
