import type { History, HistoryDelta } from "./history";

/**
 * Read-only model for the Undo history panel (demo).
 *
 * **Display order (top → bottom):** redo entries first (newest redo at top: the next
 * action if you press Redo), then a `current` marker, then undo entries (next Undo
 * at top of the undo block, older toward the bottom).
 */
export type HistoryPanelRow =
  | {
      type: "redo";
      /** Index into `history.redoStack` */
      stackIndex: number;
      /** How many `redo()` calls to reach the state *after* that stack entry */
      redosFromCurrent: number;
    }
  | { type: "current" }
  | {
      type: "undo";
      /** Index into `history.undoStack` */
      stackIndex: number;
      /** How many `undo()` calls to reach the state *before* applying that entry */
      undosFromCurrent: number;
    };

/** For labels: count distinct element map operations in this history delta. */
export function getHistoryElementChangeCount(delta: HistoryDelta): number {
  return (
    Object.keys(delta.elements.added).length +
    Object.keys(delta.elements.removed).length +
    Object.keys(delta.elements.updated).length
  );
}

export function isHistoryDeltaAppStateOnly(delta: HistoryDelta): boolean {
  return delta.elements.isEmpty() && !delta.appState.isEmpty();
}

/**
 * @returns rows to render; does not mutate `History`.
 */
export function getHistoryPanelRows(history: History): HistoryPanelRow[] {
  const { undoStack, redoStack } = history;
  const R = redoStack.length;
  const U = undoStack.length;

  if (R === 0 && U === 0) {
    return [];
  }

  const rows: HistoryPanelRow[] = [];

  // Redo: next redo = redoStack[R-1] at top, down to oldest redo at redoStack[0]
  for (let i = R - 1; i >= 0; i--) {
    rows.push({
      type: "redo",
      stackIndex: i,
      redosFromCurrent: R - i,
    });
  }

  rows.push({ type: "current" });

  // Undo: next undo = undoStack[U-1] at top, down to oldest at undoStack[0]
  for (let i = U - 1; i >= 0; i--) {
    rows.push({
      type: "undo",
      stackIndex: i,
      undosFromCurrent: U - i,
    });
  }

  return rows;
}

export function getHistoryDeltaForRow(
  history: History,
  row: HistoryPanelRow,
): HistoryDelta | null {
  if (row.type === "redo") {
    return history.redoStack[row.stackIndex] ?? null;
  }
  if (row.type === "undo") {
    return history.undoStack[row.stackIndex] ?? null;
  }
  return null;
}
