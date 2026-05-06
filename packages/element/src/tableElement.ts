import type { ExcalidrawTableElement } from "./types";

export const DEFAULT_TABLE_ROWS = 3;
export const DEFAULT_TABLE_COLS = 3;

export const createEmptyTableCells = (rows: number, cols: number): string[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => ""));

export const getTableCellSize = (element: ExcalidrawTableElement) => ({
  cellWidth: element.width / element.cols,
  cellHeight: element.height / element.rows,
});

/** Scene-local cell indices from a point inside the element's unrotated bbox (caller rotates). */
export const getTableCellAtLocalPoint = (
  element: ExcalidrawTableElement,
  localX: number,
  localY: number,
): { row: number; col: number } | null => {
  if (
    localX < 0 ||
    localY < 0 ||
    localX > element.width ||
    localY > element.height
  ) {
    return null;
  }
  const { cellWidth, cellHeight } = getTableCellSize(element);
  const col = Math.min(
    element.cols - 1,
    Math.max(0, Math.floor(localX / cellWidth)),
  );
  const row = Math.min(
    element.rows - 1,
    Math.max(0, Math.floor(localY / cellHeight)),
  );
  return { row, col };
};

export const getTableCellText = (
  element: ExcalidrawTableElement,
  row: number,
  col: number,
): string => element.cells[row]?.[col] ?? "";

export const setTableCellText = (
  element: ExcalidrawTableElement,
  row: number,
  col: number,
  text: string,
): string[][] =>
  element.cells.map((r, ri) =>
    r.map((c, ci) => (ri === row && ci === col ? text : c)),
  );

export const insertTableRow = (
  element: ExcalidrawTableElement,
  afterRow: number,
): { rows: number; cells: string[][]; height: number } => {
  const newRow = Array.from({ length: element.cols }, () => "");
  const cells = element.cells.map((r) => [...r]);
  const insertAt = Math.min(afterRow + 1, cells.length);
  cells.splice(insertAt, 0, newRow);
  const { cellHeight } = getTableCellSize(element);
  return {
    rows: element.rows + 1,
    cells,
    height: element.height + cellHeight,
  };
};

export const removeTableRow = (
  element: ExcalidrawTableElement,
  row: number,
): { rows: number; cells: string[][]; height: number } | null => {
  if (element.rows <= 1) {
    return null;
  }
  const cells = element.cells.filter((_, ri) => ri !== row).map((r) => [...r]);
  const { cellHeight } = getTableCellSize(element);
  return {
    rows: element.rows - 1,
    cells,
    height: Math.max(cellHeight, element.height - cellHeight),
  };
};

export const insertTableColumn = (
  element: ExcalidrawTableElement,
  afterCol: number,
): { cols: number; cells: string[][]; width: number } => {
  const insertAt = Math.min(afterCol + 1, element.cols);
  const cells = element.cells.map((row) => {
    const next = row.slice();
    next.splice(insertAt, 0, "");
    return next;
  });
  const { cellWidth } = getTableCellSize(element);
  return {
    cols: element.cols + 1,
    cells,
    width: element.width + cellWidth,
  };
};

export const removeTableColumn = (
  element: ExcalidrawTableElement,
  col: number,
): { cols: number; cells: string[][]; width: number } | null => {
  if (element.cols <= 1) {
    return null;
  }
  const cells = element.cells.map((row) =>
    row.filter((_, ci) => ci !== col).map((c) => c),
  );
  const { cellWidth } = getTableCellSize(element);
  return {
    cols: element.cols - 1,
    cells,
    width: Math.max(cellWidth, element.width - cellWidth),
  };
};
