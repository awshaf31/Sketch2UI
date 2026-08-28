import { useCallback, useRef, useState } from "react";
import type { BBox, Detection } from "@sketch2ui/shared-types";

// Canvas undo/redo — new capability, not present before this redesign pass. Session-only
// (the caller resets it on page/asset switch, see ProjectWorkspace.tsx) and replays
// through the app's EXISTING mutation functions (handleUpdate/handleChangeClass/
// performCreate/performDelete in ProjectWorkspace.tsx), so the server is never out of
// sync with what undo/redo shows on screen — this hook holds no server state of its own.
//
// The one real correctness subtlety: `POST /detections` assigns the id server-side (see
// detections.routes.ts), so recreating a deleted-then-undone detection (or redoing a
// create that was undone) comes back with a DIFFERENT id than the one every other history
// entry still references. Every `add` that returns a different id triggers a REMAP pass
// over the whole stack (both directions — past and future entries) so a later step that
// still names the old id keeps working. This is what keeps a sequence like
// create → move → undo → undo → redo → redo correct end to end.

export type HistoryAction =
  | { kind: "setBBox"; id: string; bbox: BBox }
  | { kind: "setClassName"; id: string; className: string }
  | { kind: "remove"; id: string }
  | { kind: "add"; detection: Detection };

interface HistoryEntry {
  undo: HistoryAction;
  redo: HistoryAction;
}

export interface DetectionHistoryCallbacks {
  setBBox: (id: string, bbox: BBox) => Promise<boolean>;
  setClassName: (id: string, className: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  /** Recreates a detection from a full snapshot (used for undo-of-delete and
   * redo-of-create). Returns the server's record — its `id` may differ from
   * `detection.id`, which is exactly the case the remap pass above exists for. */
  add: (detection: Detection) => Promise<Detection | null>;
}

function remapAction(action: HistoryAction, oldId: string, newId: string): HistoryAction {
  if (action.kind === "add") {
    return action.detection.id === oldId
      ? { kind: "add", detection: { ...action.detection, id: newId } }
      : action;
  }
  return action.id === oldId ? { ...action, id: newId } : action;
}

export function useDetectionHistory(callbacks: DetectionHistoryCallbacks) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [pointer, setPointer] = useState(0);
  const [busy, setBusy] = useState(false);

  // Callbacks are plain function declarations re-created every render in
  // ProjectWorkspace.tsx (same convention as the rest of that file, not memoized) — a
  // ref keeps undo/redo reading the LATEST ones without treating the callbacks object's
  // identity as something worth reacting to.
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const reset = useCallback(() => {
    setEntries([]);
    setPointer(0);
  }, []);

  /** Runs one action through the matching callback. Returns a remap pair when `add`
   * came back with a server-assigned id different from the snapshot's own. */
  const execute = useCallback(async (action: HistoryAction): Promise<{ oldId: string; newId: string } | null> => {
    const cb = callbacksRef.current;
    switch (action.kind) {
      case "setBBox": {
        const ok = await cb.setBBox(action.id, action.bbox);
        if (!ok) throw new Error("The change could not be saved.");
        return null;
      }
      case "setClassName": {
        const ok = await cb.setClassName(action.id, action.className);
        if (!ok) throw new Error("The change could not be saved.");
        return null;
      }
      case "remove": {
        const ok = await cb.remove(action.id);
        if (!ok) throw new Error("The box could not be removed.");
        return null;
      }
      case "add": {
        const created = await cb.add(action.detection);
        if (!created) throw new Error("The box could not be recreated.");
        return created.id !== action.detection.id ? { oldId: action.detection.id, newId: created.id } : null;
      }
    }
  }, []);

  // A new user action always truncates any redo tail and appends after the current
  // pointer. `pointer` is React state (so canUndo/canRedo re-render correctly), but the
  // updater below needs its CURRENT value without adding it as a `pushEntry` dependency
  // (every recordX call would otherwise need to re-derive on every pointer change) — a
  // ref mirrors it for that one read.
  const pointerRef = useRef(pointer);
  pointerRef.current = pointer;

  const pushEntry = useCallback((entry: HistoryEntry) => {
    setEntries((prev) => [...prev.slice(0, pointerRef.current), entry]);
    setPointer((p) => p + 1);
  }, []);

  const recordBBoxChange = useCallback(
    (id: string, before: BBox, after: BBox) => {
      if (JSON.stringify(before) === JSON.stringify(after)) return; // a click without a real drag
      pushEntry({ undo: { kind: "setBBox", id, bbox: before }, redo: { kind: "setBBox", id, bbox: after } });
    },
    [pushEntry]
  );

  const recordClassChange = useCallback(
    (id: string, before: string, after: string) => {
      if (before === after) return;
      pushEntry({
        undo: { kind: "setClassName", id, className: before },
        redo: { kind: "setClassName", id, className: after },
      });
    },
    [pushEntry]
  );

  const recordCreate = useCallback(
    (detection: Detection) => {
      pushEntry({ undo: { kind: "remove", id: detection.id }, redo: { kind: "add", detection } });
    },
    [pushEntry]
  );

  const recordDelete = useCallback(
    (detection: Detection) => {
      pushEntry({ undo: { kind: "add", detection }, redo: { kind: "remove", id: detection.id } });
    },
    [pushEntry]
  );

  function remapEverything(list: HistoryEntry[], oldId: string, newId: string): HistoryEntry[] {
    return list.map((e) => ({
      undo: remapAction(e.undo, oldId, newId),
      redo: remapAction(e.redo, oldId, newId),
    }));
  }

  const undo = useCallback(async () => {
    if (busy || pointerRef.current === 0) return;
    setBusy(true);
    try {
      const index = pointerRef.current - 1;
      const entry = entries[index];
      const remap = await execute(entry.undo);
      setEntries((prev) => (remap ? remapEverything(prev, remap.oldId, remap.newId) : prev));
      setPointer(index);
    } catch (e) {
      window.alert(`Could not undo: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [busy, entries, execute]);

  const redo = useCallback(async () => {
    if (busy || pointerRef.current >= entries.length) return;
    setBusy(true);
    try {
      const index = pointerRef.current;
      const entry = entries[index];
      const remap = await execute(entry.redo);
      setEntries((prev) => (remap ? remapEverything(prev, remap.oldId, remap.newId) : prev));
      setPointer(index + 1);
    } catch (e) {
      window.alert(`Could not redo: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [busy, entries, execute]);

  return {
    canUndo: !busy && pointer > 0,
    canRedo: !busy && pointer < entries.length,
    undo,
    redo,
    reset,
    recordBBoxChange,
    recordClassChange,
    recordCreate,
    recordDelete,
  };
}
