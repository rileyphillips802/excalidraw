import { isTableElement, newElementWith } from "@excalidraw/element";
import { CaptureUpdateAction } from "@excalidraw/element";

import type { ExcalidrawTableElement } from "@excalidraw/element/types";

import { register } from "./register";

import type { AppClassProperties, UIAppState } from "../types";

const getSingleSelectedTable = (
  appState: UIAppState,
  app: AppClassProperties,
): ExcalidrawTableElement | null => {
  const selectedElements = app.scene.getSelectedElements(appState);
  if (selectedElements.length === 1 && isTableElement(selectedElements[0])) {
    return selectedElements[0] as ExcalidrawTableElement;
  }
  return null;
};

export const actionTableAddRow = register({
  name: "tableAddRow",
  label: "labels.tableAddRow",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    const table = getSingleSelectedTable(appState, app);
    if (!table) {
      return false;
    }

    const newRow = Array.from({ length: table.cols }, () => ({ text: "" }));
    const newCells = [...table.cells, newRow];
    const cellH = table.height / table.rows;

    const updatedElement = newElementWith(table, {
      rows: table.rows + 1,
      cells: newCells,
      height: table.height + cellH,
    } as any);

    return {
      elements: elements.map((el) => (el.id === table.id ? updatedElement : el)),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (_, appState, __, app) =>
    getSingleSelectedTable(appState, app) !== null,
});

export const actionTableRemoveRow = register({
  name: "tableRemoveRow",
  label: "labels.tableRemoveRow",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    const table = getSingleSelectedTable(appState, app);
    if (!table || table.rows <= 1) {
      return false;
    }

    const newCells = table.cells.slice(0, -1);
    const cellH = table.height / table.rows;

    const updatedElement = newElementWith(table, {
      rows: table.rows - 1,
      cells: newCells,
      height: table.height - cellH,
    } as any);

    return {
      elements: elements.map((el) => (el.id === table.id ? updatedElement : el)),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (_, appState, __, app) => {
    const table = getSingleSelectedTable(appState, app);
    return table !== null && table.rows > 1;
  },
});

export const actionTableAddColumn = register({
  name: "tableAddColumn",
  label: "labels.tableAddColumn",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    const table = getSingleSelectedTable(appState, app);
    if (!table) {
      return false;
    }

    const newCells = table.cells.map((row) => [...row, { text: "" }]);
    const cellW = table.width / table.cols;

    const updatedElement = newElementWith(table, {
      cols: table.cols + 1,
      cells: newCells,
      width: table.width + cellW,
    } as any);

    return {
      elements: elements.map((el) => (el.id === table.id ? updatedElement : el)),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (_, appState, __, app) =>
    getSingleSelectedTable(appState, app) !== null,
});

export const actionTableRemoveColumn = register({
  name: "tableRemoveColumn",
  label: "labels.tableRemoveColumn",
  trackEvent: { category: "element" },
  perform: (elements, appState, _, app) => {
    const table = getSingleSelectedTable(appState, app);
    if (!table || table.cols <= 1) {
      return false;
    }

    const newCells = table.cells.map((row) => row.slice(0, -1));
    const cellW = table.width / table.cols;

    const updatedElement = newElementWith(table, {
      cols: table.cols - 1,
      cells: newCells,
      width: table.width - cellW,
    } as any);

    return {
      elements: elements.map((el) => (el.id === table.id ? updatedElement : el)),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
  predicate: (_, appState, __, app) => {
    const table = getSingleSelectedTable(appState, app);
    return table !== null && table.cols > 1;
  },
});
