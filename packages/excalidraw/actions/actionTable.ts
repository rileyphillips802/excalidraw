import { CaptureUpdateAction } from "@excalidraw/element";
import {
  insertTableColumn,
  insertTableRow,
  removeTableColumn,
  removeTableRow,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawTableElement,
} from "@excalidraw/element/types";

import { register } from "./register";

import type { AppState } from "../types";

const getSingleSelectedTable = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): ExcalidrawTableElement | null => {
  const selected = elements.filter(
    (el) => !el.isDeleted && appState.selectedElementIds[el.id],
  );
  if (selected.length !== 1 || selected[0].type !== "table") {
    return null;
  }
  return selected[0] as ExcalidrawTableElement;
};

export const actionTableAddRowBelow = register({
  name: "tableAddRowBelow",
  label: "labels.tableAddRowBelow",
  trackEvent: { category: "element" },
  predicate: (elements, appState) =>
    !!getSingleSelectedTable(elements, appState),
  perform: (elements, appState, _data, app) => {
    const table = getSingleSelectedTable(elements, appState);
    if (!table) {
      return false;
    }
    const { rows, cells, height } = insertTableRow(table, table.rows - 1);
    app.scene.mutateElement(table, { rows, cells, height });
    return { captureUpdate: CaptureUpdateAction.IMMEDIATELY };
  },
});

export const actionTableAddColumnRight = register({
  name: "tableAddColumnRight",
  label: "labels.tableAddColumnRight",
  trackEvent: { category: "element" },
  predicate: (elements, appState) =>
    !!getSingleSelectedTable(elements, appState),
  perform: (elements, appState, _data, app) => {
    const table = getSingleSelectedTable(elements, appState);
    if (!table) {
      return false;
    }
    const { cols, cells, width } = insertTableColumn(table, table.cols - 1);
    app.scene.mutateElement(table, { cols, cells, width });
    return { captureUpdate: CaptureUpdateAction.IMMEDIATELY };
  },
});

export const actionTableRemoveRow = register({
  name: "tableRemoveRow",
  label: "labels.tableRemoveRow",
  trackEvent: { category: "element" },
  predicate: (elements, appState) => {
    const t = getSingleSelectedTable(elements, appState);
    return !!t && t.rows > 1;
  },
  perform: (elements, appState, _data, app) => {
    const table = getSingleSelectedTable(elements, appState);
    if (!table) {
      return false;
    }
    const next = removeTableRow(table, table.rows - 1);
    if (!next) {
      return false;
    }
    app.scene.mutateElement(table, next);
    return { captureUpdate: CaptureUpdateAction.IMMEDIATELY };
  },
});

export const actionTableRemoveColumn = register({
  name: "tableRemoveColumn",
  label: "labels.tableRemoveColumn",
  trackEvent: { category: "element" },
  predicate: (elements, appState) => {
    const t = getSingleSelectedTable(elements, appState);
    return !!t && t.cols > 1;
  },
  perform: (elements, appState, _data, app) => {
    const table = getSingleSelectedTable(elements, appState);
    if (!table) {
      return false;
    }
    const next = removeTableColumn(table, table.cols - 1);
    if (!next) {
      return false;
    }
    app.scene.mutateElement(table, next);
    return { captureUpdate: CaptureUpdateAction.IMMEDIATELY };
  },
});
