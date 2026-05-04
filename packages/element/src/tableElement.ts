import { randomId } from "@excalidraw/common";

import type { ExcalidrawTableElement } from "./types";

export type TableCellCoord = { row: number; col: number };

/** Default dimensions when inserting from toolbar / shortcut */
export const DEFAULT_TABLE_ROWS = 3;
export const DEFAULT_TABLE_COLS = 3;

/** Minimum row/col counts */
export const MIN_TABLE_DIM = 1;
export const MAX_TABLE_DIM = 20;

export const createEmptyTableCells = (
  rows: number,
  cols: number,
): string[][] =>
  Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ""),
  );

export const tableDimensionsFromElement = (
  element: ExcalidrawTableElement,
): { rows: number; cols: number } => ({
  rows: element.cellIds.length,
  cols:
    element.cellIds[0]?.length ??
    element.colWidths.length ??
    DEFAULT_TABLE_COLS,
});

/** Relative widths/heights that sum to 1 */
export const normalizeFractions = (
  parts: readonly number[],
  count: number,
): number[] => {
  const safe = parts.length === count ? [...parts] : Array(count).fill(1 / count);
  const sum = safe.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    return Array(count).fill(1 / count);
  }
  return safe.map((p) => p / sum);
};

/** Resize table geometry after rows/cols change; preserves overall width/height when possible */
export const resizeTableDimensions = (
  element: ExcalidrawTableElement,
  nextRows: number,
  nextCols: number,
): Pick<
  ExcalidrawTableElement,
  "rowHeights" | "colWidths" | "cellIds"
> => {
  const { rows: prevRows, cols: prevCols } = tableDimensionsFromElement(element);
  const rh = normalizeFractions(element.rowHeights, prevRows);
  const cw = normalizeFractions(element.colWidths, prevCols);

  const nextRh = Array.from({ length: nextRows }, (_, i) =>
    i < rh.length ? rh[i]! : 1 / nextRows,
  );
  const nextCw = Array.from({ length: nextCols }, (_, j) =>
    j < cw.length ? cw[j]! : 1 / nextCols,
  );

  const normRh = normalizeFractions(nextRh, nextRows);
  const normCw = normalizeFractions(nextCw, nextCols);

  const prevCells = element.cellIds;
  const nextCellIds: string[][] = [];

  for (let r = 0; r < nextRows; r++) {
    const row: string[] = [];
    for (let c = 0; c < nextCols; c++) {
      if (r < prevCells.length && c < (prevCells[r]?.length ?? 0)) {
        row.push(prevCells[r]![c]!);
      } else {
        row.push(randomId());
      }
    }
    nextCellIds.push(row);
  }

  return {
    rowHeights: normRh,
    colWidths: normCw,
    cellIds: nextCellIds,
  };
};

/** Local (element-space) rectangle for one cell */
export const getTableCellLocalRect = (
  element: ExcalidrawTableElement,
  row: number,
  col: number,
): { x: number; y: number; width: number; height: number } => {
  let left = 0;
  for (let j = 0; j < col; j++) {
    left += element.width * element.colWidths[j]!;
  }
  const w = element.width * element.colWidths[col]!;

  let top = 0;
  for (let i = 0; i < row; i++) {
    top += element.height * element.rowHeights[i]!;
  }
  const h = element.height * element.rowHeights[row]!;
  return { x: left, y: top, width: w, height: h };
};

export const getTableCellForTextId = (
  table: ExcalidrawTableElement,
  textId: string,
): { row: number; col: number } | null => {
  for (let r = 0; r < table.cellIds.length; r++) {
    const rowIds = table.cellIds[r]!;
    for (let c = 0; c < rowIds.length; c++) {
      if (rowIds[c] === textId) {
        return { row: r, col: c };
      }
    }
  }
  return null;
};

export type TableNavigationDirection = "next" | "prev" | "up" | "down";

/** Next cell when moving with Tab / arrows; wraps at table edges */
export const getAdjacentTableCellCoord = (
  table: ExcalidrawTableElement,
  row: number,
  col: number,
  direction: TableNavigationDirection,
): { row: number; col: number } => {
  const rows = table.cellIds.length;
  const cols = table.cellIds[0]?.length ?? 0;
  if (rows === 0 || cols === 0) {
    return { row: 0, col: 0 };
  }
  const safeRow = Math.max(0, Math.min(row, rows - 1));
  const safeCol = Math.max(0, Math.min(col, cols - 1));

  switch (direction) {
    case "next": {
      if (safeCol < cols - 1) {
        return { row: safeRow, col: safeCol + 1 };
      }
      if (safeRow < rows - 1) {
        return { row: safeRow + 1, col: 0 };
      }
      return { row: 0, col: 0 };
    }
    case "prev": {
      if (safeCol > 0) {
        return { row: safeRow, col: safeCol - 1 };
      }
      if (safeRow > 0) {
        return { row: safeRow - 1, col: cols - 1 };
      }
      return { row: rows - 1, col: cols - 1 };
    }
    case "up": {
      if (safeRow > 0) {
        return { row: safeRow - 1, col: safeCol };
      }
      return { row: rows - 1, col: safeCol };
    }
    case "down": {
      if (safeRow < rows - 1) {
        return { row: safeRow + 1, col: safeCol };
      }
      return { row: 0, col: safeCol };
    }
  }
};
