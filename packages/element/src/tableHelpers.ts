import {
  DEFAULT_TEXT_ALIGN,
  DEFAULT_VERTICAL_ALIGN,
  randomId,
} from "@excalidraw/common";

import { pointFrom } from "@excalidraw/math";

import type { Scene } from "./Scene";

import { newTextElement } from "./newElement";
import { redrawTextBoundingBox } from "./textElement";

import type {
  ExcalidrawTableElement,
  ExcalidrawTextElement,
  NonDeleted,
} from "./types";

import {
  DEFAULT_TABLE_COLS,
  DEFAULT_TABLE_ROWS,
  createEmptyTableCells,
  getTableCellLocalRect,
  normalizeFractions,
  tableDimensionsFromElement,
} from "./tableElement";

/**
 * After dragging out a table rectangle, create empty cell text elements and bind them.
 */
export const finalizeNewTableElement = (
  table: NonDeleted<ExcalidrawTableElement>,
  scene: Scene,
  style: {
    strokeColor: string;
    backgroundColor: string;
    fontFamily: ExcalidrawTextElement["fontFamily"];
    fontSize: number;
  },
): void => {
  const rows = DEFAULT_TABLE_ROWS;
  const cols = DEFAULT_TABLE_COLS;

  const cellIds = createEmptyTableCells(rows, cols).map((row) =>
    row.map(() => randomId()),
  );
  const rh = normalizeFractions([], rows);
  const cw = normalizeFractions([], cols);

  scene.mutateElement(table, {
    cellIds,
    rowHeights: rh,
    colWidths: cw,
    boundElements: cellIds.flatMap((row) =>
      row.map((id) => ({ id, type: "text" as const })),
    ),
  });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const textEl = newTextElement({
        id: cellIds[r]![c]!,
        x: table.x,
        y: table.y,
        text: "",
        originalText: "",
        strokeColor: style.strokeColor,
        backgroundColor: "transparent",
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        textAlign: DEFAULT_TEXT_ALIGN,
        verticalAlign: DEFAULT_VERTICAL_ALIGN,
        containerId: table.id,
        autoResize: true,
      });

      scene.insertElement(textEl);
      redrawTextBoundingBox(textEl, table, scene);
    }
  }
};

/** Hit-test which cell (row,col) a scene point lies in; table angle must match element.angle */
export const getTableCellAtScenePoint = (
  table: ExcalidrawTableElement,
  sceneX: number,
  sceneY: number,
): { row: number; col: number } | null => {
  const cx = table.x + table.width / 2;
  const cy = table.y + table.height / 2;
  const dx = sceneX - cx;
  const dy = sceneY - cy;
  const cos = Math.cos(-table.angle);
  const sin = Math.sin(-table.angle);
  const lx = dx * cos - dy * sin + table.width / 2;
  const ly = dx * sin + dy * cos + table.height / 2;
  if (lx < 0 || ly < 0 || lx > table.width || ly > table.height) {
    return null;
  }

  const { rows, cols } = tableDimensionsFromElement(table);
  let xAcc = 0;
  let col = -1;
  for (let c = 0; c < cols; c++) {
    const w = table.width * table.colWidths[c]!;
    if (lx >= xAcc && lx < xAcc + w) {
      col = c;
      break;
    }
    xAcc += w;
  }
  let yAcc = 0;
  let row = -1;
  for (let r = 0; r < rows; r++) {
    const h = table.height * table.rowHeights[r]!;
    if (ly >= yAcc && ly < yAcc + h) {
      row = r;
      break;
    }
    yAcc += h;
  }
  if (row < 0 || col < 0) {
    return null;
  }
  return { row, col };
};
