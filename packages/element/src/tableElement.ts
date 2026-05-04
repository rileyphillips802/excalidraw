import type { ExcalidrawTableElement } from "./types";

export const TABLE_DEFAULT_COLS = 3;
export const TABLE_DEFAULT_ROWS = 3;

export const getTableCellCount = (element: ExcalidrawTableElement) =>
  element.cols * element.rows;

export const createEmptyTableCellData = (cols: number, rows: number) =>
  Array.from({ length: cols * rows }, () => "") as string[];

export const getTableCellIndex = (
  element: ExcalidrawTableElement,
  col: number,
  row: number,
) => row * element.cols + col;

export const getTableCellText = (
  element: ExcalidrawTableElement,
  col: number,
  row: number,
): string => {
  const i = getTableCellIndex(element, col, row);
  return element.cellData[i] ?? "";
};

export const normalizeTableCellData = (
  element: ExcalidrawTableElement,
): string[] => {
  const count = getTableCellCount(element);
  const next = [...element.cellData];
  while (next.length < count) {
    next.push("");
  }
  if (next.length > count) {
    next.length = count;
  }
  return next;
};

export const insertTableRow = (
  element: ExcalidrawTableElement,
  atRow: number,
): string[] => {
  const data = normalizeTableCellData(element);
  const { cols } = element;
  const insertAt = Math.max(0, Math.min(atRow, element.rows)) * cols;
  const empty = Array.from({ length: cols }, () => "");
  data.splice(insertAt, 0, ...empty);
  return data;
};

export const removeTableRow = (
  element: ExcalidrawTableElement,
  atRow: number,
): string[] | null => {
  if (element.rows <= 1) {
    return null;
  }
  const data = normalizeTableCellData(element);
  const { cols } = element;
  const r = Math.max(0, Math.min(atRow, element.rows - 1));
  data.splice(r * cols, cols);
  return data;
};

export const insertTableColumn = (
  element: ExcalidrawTableElement,
  atCol: number,
): string[] => {
  const data = normalizeTableCellData(element);
  const { cols, rows } = element;
  const c = Math.max(0, Math.min(atCol, cols));
  const next: string[] = [];
  for (let row = 0; row < rows; row++) {
    const rowStart = row * cols;
    for (let col = 0; col < cols; col++) {
      if (col === c) {
        next.push("");
      }
      next.push(data[rowStart + col] ?? "");
    }
    if (c === cols) {
      next.push("");
    }
  }
  return next;
};

export const removeTableColumn = (
  element: ExcalidrawTableElement,
  atCol: number,
): string[] | null => {
  if (element.cols <= 1) {
    return null;
  }
  const data = normalizeTableCellData(element);
  const { cols, rows } = element;
  const c = Math.max(0, Math.min(atCol, cols - 1));
  const next: string[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (col === c) {
        continue;
      }
      const idx = row * cols + col;
      next.push(data[idx] ?? "");
    }
  }
  return next;
};

export const setTableCellText = (
  element: ExcalidrawTableElement,
  col: number,
  row: number,
  text: string,
): string[] => {
  const data = normalizeTableCellData(element);
  const i = getTableCellIndex(element, col, row);
  data[i] = text;
  return data;
};

export const getTableCellAtScenePoint = (
  element: ExcalidrawTableElement,
  sceneX: number,
  sceneY: number,
): { col: number; row: number } | null => {
  const cos = Math.cos(element.angle);
  const sin = Math.sin(element.angle);
  const dx = sceneX - element.x;
  const dy = sceneY - element.y;
  const lx = dx * cos + dy * sin;
  const ly = -dx * sin + dy * cos;
  if (
    lx < 0 ||
    ly < 0 ||
    lx > element.width ||
    ly > element.height ||
    element.cols < 1 ||
    element.rows < 1
  ) {
    return null;
  }
  const col = Math.min(
    element.cols - 1,
    Math.floor((lx / element.width) * element.cols),
  );
  const row = Math.min(
    element.rows - 1,
    Math.floor((ly / element.height) * element.rows),
  );
  return { col, row };
};
