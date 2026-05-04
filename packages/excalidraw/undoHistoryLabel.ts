import type { HistoryDelta } from "./history";

const countKeys = (obj: Record<string, unknown>) => Object.keys(obj).length;

export const describeHistoryDelta = (delta: HistoryDelta): string => {
  const { elements } = delta;
  const added = countKeys(elements.added as Record<string, unknown>);
  const removed = countKeys(elements.removed as Record<string, unknown>);
  const updated = countKeys(elements.updated as Record<string, unknown>);

  if (added && !removed && !updated) {
    return added === 1 ? "Added element" : `Added ${added} elements`;
  }
  if (removed && !added && !updated) {
    return removed === 1 ? "Removed element" : `Removed ${removed} elements`;
  }
  if (updated && !added && !removed) {
    return updated === 1 ? "Changed element" : `Changed ${updated} elements`;
  }
  if (added || removed || updated) {
    const parts: string[] = [];
    if (added) {
      parts.push(`${added} added`);
    }
    if (removed) {
      parts.push(`${removed} removed`);
    }
    if (updated) {
      parts.push(`${updated} updated`);
    }
    return `Elements: ${parts.join(", ")}`;
  }

  const { appState } = delta;
  if (!appState.isEmpty()) {
    const keys = new Set([
      ...Object.keys(appState.delta.deleted),
      ...Object.keys(appState.delta.inserted),
    ]);
    if (
      keys.size &&
      [...keys].every((k) =>
        [
          "selectedElementIds",
          "selectedGroupIds",
          "lockedMultiSelections",
          "selectedLinearElement",
          "editingGroupId",
          "croppingElementId",
          "activeLockedId",
        ].includes(k),
      )
    ) {
      return "Selection";
    }
    if (keys.has("name")) {
      return "Renamed canvas";
    }
    if (keys.has("viewBackgroundColor")) {
      return "Changed canvas background";
    }
    return keys.size === 1
      ? `App: ${[...keys][0]}`
      : `App state (${keys.size} changes)`;
  }

  return "Change";
};
