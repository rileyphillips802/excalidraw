import clsx from "clsx";
import React, { useCallback, useMemo } from "react";

import { HistoryChangedEvent } from "../history";
import { useEmitter } from "../hooks/useEmitter";
import { t } from "../i18n";

import { useApp, useExcalidrawActionManager } from "./App";
import { UndoIcon, RedoIcon } from "./icons";

import "./HistoryPanel.scss";

import type { HistoryDelta } from "../history";

// ---------------------------------------------------------------------------
// Label inference helpers
// ---------------------------------------------------------------------------

const labelForDelta = (delta: HistoryDelta, index: number): string => {
  const addedCount = Object.keys(delta.elements.added).length;
  const removedCount = Object.keys(delta.elements.removed).length;
  const updatedCount = Object.keys(delta.elements.updated).length;

  if (addedCount === 0 && removedCount === 0 && updatedCount === 0) {
    return t("historyPanel.selectionChange");
  }

  const parts: string[] = [];

  if (addedCount > 0) {
    parts.push(
      addedCount === 1
        ? t("historyPanel.addedElement")
        : t("historyPanel.addedElements", { count: addedCount }),
    );
  }
  if (removedCount > 0) {
    parts.push(
      removedCount === 1
        ? t("historyPanel.removedElement")
        : t("historyPanel.removedElements", { count: removedCount }),
    );
  }
  if (updatedCount > 0) {
    parts.push(
      updatedCount === 1
        ? t("historyPanel.updatedElement")
        : t("historyPanel.updatedElements", { count: updatedCount }),
    );
  }

  return parts.join(", ");
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const HistoryPanel = () => {
  const app = useApp();
  const actionManager = useExcalidrawActionManager();

  const historyChangedEvent = useEmitter<HistoryChangedEvent>(
    app.history.onHistoryChangedEmitter,
    new HistoryChangedEvent(
      app.history.isUndoStackEmpty,
      app.history.isRedoStackEmpty,
    ),
  );

  // Build snapshot of stacks for display — reading directly from the stacks.
  // We memoize by event identity so we re-render only when history changes.
  const { undoItems, redoItems } = useMemo(() => {
    // undoStack: index 0 = oldest, last = most-recent action (the next to undo)
    const undoItems = [...app.history.undoStack].reverse();
    // redoStack: last = most-recent undo (the next to redo)
    const redoItems = [...app.history.redoStack];
    return { undoItems, redoItems };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyChangedEvent, app.history]);

  const handleUndo = useCallback(() => {
    const undoAction = actionManager.actions.undo;
    if (undoAction) {
      actionManager.executeAction(undoAction);
    }
  }, [actionManager]);

  const handleRedo = useCallback(() => {
    const redoAction = actionManager.actions.redo;
    if (redoAction) {
      actionManager.executeAction(redoAction);
    }
  }, [actionManager]);

  const totalUndoCount = undoItems.length;
  const totalRedoCount = redoItems.length;

  return (
    <div className="history-panel">
      <div className="history-panel__controls">
        <button
          className="history-panel__btn"
          onClick={handleUndo}
          disabled={historyChangedEvent.isUndoStackEmpty}
          aria-label={t("buttons.undo")}
          title={t("buttons.undo")}
        >
          {UndoIcon}
          <span>{t("buttons.undo")}</span>
        </button>
        <button
          className="history-panel__btn"
          onClick={handleRedo}
          disabled={historyChangedEvent.isRedoStackEmpty}
          aria-label={t("buttons.redo")}
          title={t("buttons.redo")}
        >
          {RedoIcon}
          <span>{t("buttons.redo")}</span>
        </button>
      </div>

      {totalUndoCount === 0 && totalRedoCount === 0 ? (
        <div className="history-panel__empty">
          {t("historyPanel.emptyState")}
        </div>
      ) : (
        <div className="history-panel__list" role="list">
          {totalRedoCount > 0 && (
            <div className="history-panel__section history-panel__section--redo">
              <div className="history-panel__section-header">
                {t("historyPanel.redoSection")}
              </div>
              {redoItems.map((delta, i) => {
                const label = labelForDelta(delta, i);
                const isSelectionOnly =
                  Object.keys(delta.elements.added).length === 0 &&
                  Object.keys(delta.elements.removed).length === 0 &&
                  Object.keys(delta.elements.updated).length === 0;
                return (
                  <div
                    key={delta.id}
                    className={clsx("history-panel__entry", {
                      "history-panel__entry--selection-only": isSelectionOnly,
                      "history-panel__entry--redo": true,
                    })}
                    role="listitem"
                    title={label}
                  >
                    <span className="history-panel__entry-icon">
                      {RedoIcon}
                    </span>
                    <span className="history-panel__entry-label">{label}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="history-panel__section history-panel__section--current">
            <div className="history-panel__section-header history-panel__section-header--current">
              {t("historyPanel.currentState")}
            </div>
          </div>

          {totalUndoCount > 0 && (
            <div className="history-panel__section history-panel__section--undo">
              <div className="history-panel__section-header">
                {t("historyPanel.undoSection")}
              </div>
              {undoItems.map((delta, i) => {
                const label = labelForDelta(delta, i);
                const isSelectionOnly =
                  Object.keys(delta.elements.added).length === 0 &&
                  Object.keys(delta.elements.removed).length === 0 &&
                  Object.keys(delta.elements.updated).length === 0;
                return (
                  <div
                    key={delta.id}
                    className={clsx("history-panel__entry", {
                      "history-panel__entry--selection-only": isSelectionOnly,
                    })}
                    role="listitem"
                    title={label}
                  >
                    <span className="history-panel__entry-icon">
                      {UndoIcon}
                    </span>
                    <span className="history-panel__entry-label">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

HistoryPanel.displayName = "HistoryPanel";

export const HISTORY_PANEL_SIDEBAR_NAME = "history-panel" as const;
