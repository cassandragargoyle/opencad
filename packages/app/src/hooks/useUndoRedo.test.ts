/**
 * T-DOC-007: Undo/redo keyboard shortcut hook tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUndoRedo } from './useUndoRedo';

describe('T-DOC-007: useUndoRedo', () => {
  const mockUndo = vi.fn();
  const mockRedo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls undo on Ctrl+Z when canUndo is true', () => {
    renderHook(() =>
      useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: true, canRedo: false })
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(mockUndo).toHaveBeenCalledTimes(1);
  });

  it('calls undo on Meta+Z (Mac) when canUndo is true', () => {
    renderHook(() =>
      useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: true, canRedo: false })
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true }));
    expect(mockUndo).toHaveBeenCalledTimes(1);
  });

  it('does not call undo when canUndo is false', () => {
    renderHook(() =>
      useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: false, canRedo: false })
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    expect(mockUndo).not.toHaveBeenCalled();
  });

  it('calls redo on Ctrl+Y when canRedo is true', () => {
    renderHook(() =>
      useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: false, canRedo: true })
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }));
    expect(mockRedo).toHaveBeenCalledTimes(1);
  });

  it('calls redo on Ctrl+Shift+Z when canRedo is true', () => {
    renderHook(() =>
      useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: false, canRedo: true })
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true })
    );
    expect(mockRedo).toHaveBeenCalledTimes(1);
  });

  it('calls redo on Meta+Shift+Z (Mac) when canRedo is true', () => {
    renderHook(() =>
      useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: false, canRedo: true })
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', metaKey: true, shiftKey: true, bubbles: true })
    );
    expect(mockRedo).toHaveBeenCalledTimes(1);
  });

  it('does not call redo when canRedo is false', () => {
    renderHook(() =>
      useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: false, canRedo: false })
    );
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true, bubbles: true }));
    expect(mockRedo).not.toHaveBeenCalled();
  });

  it('does not fire on plain z key', () => {
    renderHook(() => useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: true, canRedo: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    expect(mockUndo).not.toHaveBeenCalled();
  });

  it('cleans up event listener on unmount', () => {
    const spy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() =>
      useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: true, canRedo: true })
    );
    unmount();
    expect(spy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  // Browsers report e.key as 'Z' when Shift is held (or CapsLock is on).
  it('calls redo on Ctrl+Shift+Z as reported by browsers (key "Z")', () => {
    renderHook(() => useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: true, canRedo: true }));
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true, shiftKey: true, bubbles: true })
    );
    expect(mockRedo).toHaveBeenCalledOnce();
    expect(mockUndo).not.toHaveBeenCalled();
  });

  it('calls undo on Ctrl+Z with CapsLock on (key "Z", no Shift)', () => {
    renderHook(() => useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: true, canRedo: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true, bubbles: true }));
    expect(mockUndo).toHaveBeenCalledOnce();
  });

  describe('INT-001: editable elements keep native undo/redo', () => {
    let el: HTMLElement | null = null;

    afterEach(() => {
      el?.remove();
      el = null;
    });

    const dispatchOn = (target: HTMLElement, init: KeyboardEventInit) => {
      const event = new KeyboardEvent('keydown', { ...init, bubbles: true, cancelable: true });
      target.dispatchEvent(event);
      return event;
    };

    const mount = (tag: string): HTMLElement => {
      el = document.createElement(tag);
      document.body.appendChild(el);
      return el;
    };

    it.each(['input', 'textarea', 'select'])('ignores Ctrl+Z in %s', (tag) => {
      renderHook(() =>
        useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: true, canRedo: true })
      );
      const event = dispatchOn(mount(tag), { key: 'z', ctrlKey: true });
      expect(mockUndo).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('ignores Ctrl+Y and Ctrl+Shift+Z in input', () => {
      renderHook(() =>
        useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: true, canRedo: true })
      );
      const input = mount('input');
      const y = dispatchOn(input, { key: 'y', ctrlKey: true });
      const shiftZ = dispatchOn(input, { key: 'Z', ctrlKey: true, shiftKey: true });
      expect(mockRedo).not.toHaveBeenCalled();
      expect(y.defaultPrevented).toBe(false);
      expect(shiftZ.defaultPrevented).toBe(false);
    });

    it('ignores Ctrl+Z in a contentEditable element', () => {
      renderHook(() =>
        useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: true, canRedo: true })
      );
      const div = mount('div');
      div.contentEditable = 'true';
      // jsdom does not implement isContentEditable
      Object.defineProperty(div, 'isContentEditable', { value: true });
      const event = dispatchOn(div, { key: 'z', ctrlKey: true });
      expect(mockUndo).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
    });

    it('still undoes when the target is a non-editable element', () => {
      renderHook(() =>
        useUndoRedo({ undo: mockUndo, redo: mockRedo, canUndo: true, canRedo: true })
      );
      const event = dispatchOn(mount('div'), { key: 'z', ctrlKey: true });
      expect(mockUndo).toHaveBeenCalledOnce();
      expect(event.defaultPrevented).toBe(true);
    });
  });
});
