import type { Delta } from "@excalidraw/element";

import type { HistoryDelta } from "./history";

export type HistoryEntryIconKind =
  | "add"
  | "remove"
  | "move"
  | "resize"
  | "style"
  | "view"
  | "edit";

export type HistoryDeltaSummary = {
  icon: HistoryEntryIconKind;
  /** i18n key under `history.summary.*` */
  labelKey: string;
  labelParams?: Record<string, string | number>;
  /** App-state-only rows collapsed by default in the history panel */
  collapsedDefault?: boolean;
};

const POSITION_KEYS = new Set([
  "x",
  "y",
  "width",
  "height",
  "angle",
  "points",
  "startBinding",
  "endBinding",
]);

const SIZE_KEYS = new Set(["width", "height", "points"]);

const STYLE_KEYS = new Set([
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeWidth",
  "strokeStyle",
  "roughness",
  "opacity",
  "roundness",
  "arrowheadStart",
  "arrowheadEnd",
]);

const SELECTION_APP_KEYS = new Set([
  "selectedElementIds",
  "selectedGroupIds",
  "lockedMultiSelections",
]);

function changedKeysForElementDelta(elDelta: Delta<any>): Set<string> {
  const keys = new Set<string>();
  const del = elDelta.deleted as Record<string, unknown>;
  const ins = elDelta.inserted as Record<string, unknown>;
  for (const k of new Set([...Object.keys(del), ...Object.keys(ins)])) {
    if (del[k] !== ins[k]) {
      keys.add(k);
    }
  }
  return keys;
}

function classifyUpdatedElements(delta: HistoryDelta): HistoryDeltaSummary {
  let sawMove = false;
  let sawResize = false;
  let sawStyle = false;

  for (const elDelta of Object.values(delta.elements.updated)) {
    const keys = changedKeysForElementDelta(elDelta);
    const isStyle = [...keys].some((k) => STYLE_KEYS.has(k));
    const isResize = [...keys].some((k) => SIZE_KEYS.has(k));
    const isMove =
      keys.has("x") ||
      keys.has("y") ||
      keys.has("angle") ||
      keys.has("points");

    if (isStyle) {
      sawStyle = true;
    }
    if (isResize) {
      sawResize = true;
    }
    if (isMove) {
      sawMove = true;
    }
    for (const k of keys) {
      if (!POSITION_KEYS.has(k) && !STYLE_KEYS.has(k)) {
        sawStyle = true;
      }
    }
  }

  const n = Object.keys(delta.elements.updated).length;

  if (sawResize) {
    return {
      icon: "resize",
      labelKey: sawResize && n > 1 ? "resizedElements" : "resizedElement",
      labelParams: n > 1 ? { count: n } : undefined,
    };
  }
  if (sawMove && !sawStyle) {
    return {
      icon: "move",
      labelKey: n > 1 ? "movedElements" : "movedSelection",
      labelParams: n > 1 ? { count: n } : undefined,
    };
  }
  if (sawStyle) {
    return {
      icon: "style",
      labelKey: "changedStyle",
    };
  }

  return {
    icon: "edit",
    labelKey: "edit",
  };
}

function isSelectionOnlyAppDelta(delta: HistoryDelta): boolean {
  const { deleted, inserted } = delta.appState.delta;
  const keys = new Set([
    ...Object.keys(deleted),
    ...Object.keys(inserted),
  ]);
  if (keys.size === 0) {
    return false;
  }
  for (const k of keys) {
    if (!SELECTION_APP_KEYS.has(k)) {
      return false;
    }
  }
  return true;
}

/**
 * Human-readable summary for one history stack entry (inverse delta).
 */
export function summarizeHistoryDelta(delta: HistoryDelta): HistoryDeltaSummary {
  const added = Object.keys(delta.elements.added).length;
  const removed = Object.keys(delta.elements.removed).length;
  const updatedCount = Object.keys(delta.elements.updated).length;

  if (added > 0 && removed === 0 && updatedCount === 0) {
    return {
      icon: "add",
      labelKey: added === 1 ? "addedOneElement" : "addedElements",
      labelParams: added > 1 ? { count: added } : undefined,
    };
  }

  if (removed > 0 && added === 0 && updatedCount === 0) {
    return {
      icon: "remove",
      labelKey: removed === 1 ? "deletedOneElement" : "deletedElements",
      labelParams: removed > 1 ? { count: removed } : undefined,
    };
  }

  if (updatedCount > 0) {
    return classifyUpdatedElements(delta);
  }

  if (!delta.elements.isEmpty()) {
    return {
      icon: "edit",
      labelKey: "edit",
    };
  }

  if (!delta.appState.isEmpty()) {
    if (isSelectionOnlyAppDelta(delta)) {
      return {
        icon: "view",
        labelKey: "selectionChange",
        collapsedDefault: true,
      };
    }
    return {
      icon: "view",
      labelKey: "viewChange",
      collapsedDefault: true,
    };
  }

  return {
    icon: "edit",
    labelKey: "edit",
  };
}
