/**
 * T-DOC-007: Keyboard shortcuts for undo/redo (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z)
 */
import { useEffect } from 'react';

export interface UseUndoRedoOptions {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useUndoRedo({ undo, redo, canUndo, canRedo }: UseUndoRedoOptions): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      // Shift (or CapsLock) makes browsers report 'Z' rather than 'z'.
      const key = e.key.toLowerCase();
      if (key === 'z' && !e.shiftKey) {
        if (canUndo) {
          e.preventDefault();
          undo();
        }
      } else if (key === 'z' && e.shiftKey) {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
      } else if (key === 'y') {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, canUndo, canRedo]);
}
