import { randomId } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  isTableElement,
  newTextElement,
  newElementWith,
  redrawTextBoundingBox,
  syncTableBoundTextPositions,
} from "@excalidraw/element";

import {
  MAX_TABLE_DIM,
  MIN_TABLE_DIM,
  normalizeFractions,
  resizeTableDimensions,
  tableDimensionsFromElement,
} from "@excalidraw/element";

import type {
  ExcalidrawTableElement,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import { register } from "./register";

import type { AppClassProperties } from "../types";

const insertCellTexts = (
  app: AppClassProperties,
  table: ExcalidrawTableElement,
  textIds: string[],
  style: {
    strokeColor: string;
    backgroundColor: string;
    fontFamily: ExcalidrawTextElement["fontFamily"];
    fontSize: number;
  },
) => {
  const tbl = app.scene.getElement(table.id) as ExcalidrawTableElement;
  for (const textId of textIds) {
    const textEl = newTextElement({
      id: textId,
      x: tbl.x,
      y: tbl.y,
      text: "",
      originalText: "",
      strokeColor: style.strokeColor,
      backgroundColor: style.backgroundColor,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      containerId: tbl.id,
      autoResize: true,
    });
    app.scene.insertElement(textEl);
    redrawTextBoundingBox(textEl, tbl, app.scene);
  }
  syncTableBoundTextPositions(
    app.scene.getNonDeletedElementsMap().get(tbl.id) as ExcalidrawTableElement,
    app.scene,
  );
};

export const actionTableAddRow = register({
  name: "tableAddRow",
  label: "labels.tableAddRow",
  trackEvent: { category: "element", action: "tableAddRow" },
  predicate: (elements, appState, _props, app) => {
    const sel = app.scene.getSelectedElements(appState);
    return sel.length === 1 && isTableElement(sel[0]);
  },
  perform: (elements, appState, _data, app) => {
    const sel = app.scene.getSelectedElements(appState);
    const table = sel[0];
    if (!isTableElement(table)) {
      return false;
    }
    const { rows, cols } = tableDimensionsFromElement(table);
    if (rows >= MAX_TABLE_DIM) {
      return false;
    }
    const cell = app.getLastTableContextMenuCell?.();
    const insertAfter = cell?.tableId === table.id ? cell.row : rows - 1;
    const insertIndex = Math.min(insertAfter + 1, rows);

    const newRowIds = Array.from({ length: cols }, () => randomId());
    const newCellIds = table.cellIds.map((row) => [...row]);
    newCellIds.splice(insertIndex, 0, newRowIds);

    const next = resizeTableDimensions(
      { ...table, cellIds: newCellIds } as ExcalidrawTableElement,
      rows + 1,
      cols,
    );

    app.scene.mutateElement(table, {
      ...next,
      boundElements: next.cellIds.flatMap((row) =>
        row.map((id) => ({ id, type: "text" as const })),
      ),
    });

    insertCellTexts(app, table, newRowIds, {
      strokeColor: appState.currentItemStrokeColor,
      backgroundColor: "transparent",
      fontFamily: appState.currentItemFontFamily,
      fontSize: appState.currentItemFontSize,
    });

    return {
      elements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionTableRemoveRow = register({
  name: "tableRemoveRow",
  label: "labels.tableRemoveRow",
  trackEvent: { category: "element", action: "tableRemoveRow" },
  predicate: (elements, appState, _props, app) => {
    const sel = app.scene.getSelectedElements(appState);
    return sel.length === 1 && isTableElement(sel[0]);
  },
  perform: (elements, appState, _data, app) => {
    const sel = app.scene.getSelectedElements(appState);
    const table = sel[0];
    if (!isTableElement(table)) {
      return false;
    }
    const { rows, cols } = tableDimensionsFromElement(table);
    if (rows <= MIN_TABLE_DIM) {
      return false;
    }
    const cell = app.getLastTableContextMenuCell?.();
    const removeIndex = cell?.tableId === table.id ? cell.row : rows - 1;

    const idsToRemove = new Set<string>(table.cellIds[removeIndex] ?? []);
    const filteredCellIds = table.cellIds.filter((_, i) => i !== removeIndex);
    const next = resizeTableDimensions(
      { ...table, cellIds: filteredCellIds } as ExcalidrawTableElement,
      rows - 1,
      cols,
    );

    app.scene.mutateElement(table, {
      ...next,
      boundElements: next.cellIds.flatMap((row) =>
        row.map((id) => ({ id, type: "text" as const })),
      ),
    });

    const nextElements = elements.map((el) =>
      idsToRemove.has(el.id) ? newElementWith(el, { isDeleted: true }) : el,
    );

    syncTableBoundTextPositions(
      app.scene.getNonDeletedElementsMap().get(table.id) as ExcalidrawTableElement,
      app.scene,
    );

    return {
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionTableAddColumn = register({
  name: "tableAddColumn",
  label: "labels.tableAddColumn",
  trackEvent: { category: "element", action: "tableAddColumn" },
  predicate: (elements, appState, _props, app) => {
    const sel = app.scene.getSelectedElements(appState);
    return sel.length === 1 && isTableElement(sel[0]);
  },
  perform: (elements, appState, _data, app) => {
    const sel = app.scene.getSelectedElements(appState);
    const table = sel[0];
    if (!isTableElement(table)) {
      return false;
    }
    const { rows, cols } = tableDimensionsFromElement(table);
    if (cols >= MAX_TABLE_DIM) {
      return false;
    }
    const cell = app.getLastTableContextMenuCell?.();
    const insertAfter = cell?.tableId === table.id ? cell.col : cols - 1;
    const insertIndex = Math.min(insertAfter + 1, cols);

    const newTextIds: string[] = [];
    const newCellIds = table.cellIds.map((row) => [...row]);
    for (let r = 0; r < rows; r++) {
      const nid = randomId();
      newTextIds.push(nid);
      newCellIds[r]!.splice(insertIndex, 0, nid);
    }

    const next = resizeTableDimensions(
      { ...table, cellIds: newCellIds } as ExcalidrawTableElement,
      rows,
      cols + 1,
    );

    app.scene.mutateElement(table, {
      ...next,
      boundElements: next.cellIds.flatMap((row) =>
        row.map((id) => ({ id, type: "text" as const })),
      ),
    });

    insertCellTexts(app, table, newTextIds, {
      strokeColor: appState.currentItemStrokeColor,
      backgroundColor: "transparent",
      fontFamily: appState.currentItemFontFamily,
      fontSize: appState.currentItemFontSize,
    });

    return {
      elements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionTableRemoveColumn = register({
  name: "tableRemoveColumn",
  label: "labels.tableRemoveColumn",
  trackEvent: { category: "element", action: "tableRemoveColumn" },
  predicate: (elements, appState, _props, app) => {
    const sel = app.scene.getSelectedElements(appState);
    return sel.length === 1 && isTableElement(sel[0]);
  },
  perform: (elements, appState, _data, app) => {
    const sel = app.scene.getSelectedElements(appState);
    const table = sel[0];
    if (!isTableElement(table)) {
      return false;
    }
    const { rows, cols } = tableDimensionsFromElement(table);
    if (cols <= MIN_TABLE_DIM) {
      return false;
    }
    const cell = app.getLastTableContextMenuCell?.();
    const removeIndex = cell?.tableId === table.id ? cell.col : cols - 1;

    const idsToRemove = new Set(
      table.cellIds.map((row) => row[removeIndex]!).filter(Boolean),
    );
    const filteredCellIds = table.cellIds.map((row) =>
      row.filter((_, i) => i !== removeIndex),
    );
    const next = resizeTableDimensions(
      { ...table, cellIds: filteredCellIds } as ExcalidrawTableElement,
      rows,
      cols - 1,
    );

    app.scene.mutateElement(table, {
      ...next,
      boundElements: next.cellIds.flatMap((row) =>
        row.map((id) => ({ id, type: "text" as const })),
      ),
    });

    const nextElements = elements.map((el) =>
      idsToRemove.has(el.id) ? newElementWith(el, { isDeleted: true }) : el,
    );

    syncTableBoundTextPositions(
      app.scene.getNonDeletedElementsMap().get(table.id) as ExcalidrawTableElement,
      app.scene,
    );

    return {
      elements: nextElements,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
