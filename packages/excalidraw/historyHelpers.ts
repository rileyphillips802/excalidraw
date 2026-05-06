import type { HistoryDelta } from "./history";

/** Keys that only affect selection / element-linked UI (collapsed in history panel by default). */
const APP_STATE_SELECTION_KEYS = new Set([
  "selectedElementIds",
  "selectedGroupIds",
  "lockedMultiSelections",
  "selectedLinearElement",
  "editingGroupId",
  "croppingElementId",
]);

export const isAppStateOnlyHistoryEntry = (entry: HistoryDelta): boolean => {
  if (!entry.elements.isEmpty()) {
    return false;
  }
  if (entry.appState.isEmpty()) {
    return false;
  }
  const { deleted, inserted } = entry.appState.delta;
  const keys = new Set([
    ...Object.keys(deleted),
    ...Object.keys(inserted),
  ] as string[]);
  for (const key of keys) {
    if (!APP_STATE_SELECTION_KEYS.has(key)) {
      return false;
    }
  }
  return true;
};

export const describeHistoryEntry = (entry: HistoryDelta): string => {
  if (!entry.elements.isEmpty()) {
    const added = Object.keys(entry.elements.added).length;
    const removed = Object.keys(entry.elements.removed).length;
    const updated = Object.keys(entry.elements.updated).length;
    const parts: string[] = [];
    if (added) {
      parts.push(added === 1 ? "Added 1 element" : `Added ${added} elements`);
    }
    if (removed) {
      parts.push(
        removed === 1 ? "Removed 1 element" : `Removed ${removed} elements`,
      );
    }
    if (updated) {
      parts.push(
        updated === 1 ? "Updated 1 element" : `Updated ${updated} elements`,
      );
    }
    return parts.join(", ") || "Canvas change";
  }
  if (!entry.appState.isEmpty()) {
    if (isAppStateOnlyHistoryEntry(entry)) {
      return "Selection change";
    }
    return "Document settings";
  }
  return "Change";
};
