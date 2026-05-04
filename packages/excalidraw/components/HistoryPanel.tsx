import clsx from "clsx";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  DEFAULT_SIDEBAR,
  HISTORY_SIDEBAR_TAB,
  arrayToMap,
} from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { orderByFractionalIndex } from "@excalidraw/element";

import type { SceneElementsMap } from "@excalidraw/element/types";

import { HistoryChangedEvent } from "../history";
import { useEmitter } from "../hooks/useEmitter";
import { t } from "../i18n";

import {
  useApp,
  useExcalidrawActionManager,
  useExcalidrawElements,
  useExcalidrawSetAppState,
} from "./App";
import { UndoIcon, RedoIcon } from "./icons";

import "./HistoryPanel.scss";

import type { HistoryDelta } from "../history";

const isElementsEmpty = (delta: HistoryDelta) =>
  Object.keys(delta.elements.added).length === 0 &&
  Object.keys(delta.elements.removed).length === 0 &&
  Object.keys(delta.elements.updated).length === 0;

const isAppStateOnlyDelta = (delta: HistoryDelta) =>
  isElementsEmpty(delta) && !delta.appState.isEmpty();

const labelForDelta = (delta: HistoryDelta): string => {
  if (isAppStateOnlyDelta(delta)) {
    return t("historyPanel.canvasChange");
  }

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

type UndoRow =
  | {
      kind: "single";
      delta: HistoryDelta;
      targetUndoStackLength: number;
      isAppStateOnly: boolean;
    }
  | {
      kind: "appGroup";
      deltas: HistoryDelta[];
      targetUndoStackLength: number;
    };

type RedoRow =
  | {
      kind: "single";
      delta: HistoryDelta;
      targetUndoStackLength: number;
      isAppStateOnly: boolean;
    }
  | {
      kind: "appGroup";
      deltas: HistoryDelta[];
      targetUndoStackLength: number;
    };

const buildUndoRows = (
  undoStack: HistoryDelta[],
  currentUndoLen: number,
): UndoRow[] => {
  // Top of list = next undo (newest on stack); bottom = oldest
  const visual = [...undoStack].reverse();
  const rows: UndoRow[] = [];
  let i = 0;
  while (i < visual.length) {
    const delta = visual[i]!;

    if (isAppStateOnlyDelta(delta)) {
      const group: HistoryDelta[] = [delta];
      let j = i + 1;
      while (j < visual.length && isAppStateOnlyDelta(visual[j]!)) {
        group.push(visual[j]!);
        j++;
      }
      const k = j - i;
      rows.push({
        kind: "appGroup",
        deltas: group,
        targetUndoStackLength: currentUndoLen - k,
      });
      i = j;
    } else {
      rows.push({
        kind: "single",
        delta,
        targetUndoStackLength: currentUndoLen - (i + 1),
        isAppStateOnly: false,
      });
      i++;
    }
  }
  return rows;
};

const buildRedoRows = (
  redoStack: HistoryDelta[],
  currentUndoLen: number,
): RedoRow[] => {
  // Top = next redo (newest); bottom = oldest redo
  const visual = [...redoStack];
  const R = visual.length;
  const rows: RedoRow[] = [];
  for (let i = R - 1; i >= 0; ) {
    const delta = visual[i]!;

    if (isAppStateOnlyDelta(delta)) {
      const group: HistoryDelta[] = [delta];
      let j = i - 1;
      while (j >= 0 && isAppStateOnlyDelta(visual[j]!)) {
        group.push(visual[j]!);
        j--;
      }
      const k = i - j;
      rows.push({
        kind: "appGroup",
        deltas: group,
        targetUndoStackLength: currentUndoLen + k,
      });
      i = j;
    } else {
      rows.push({
        kind: "single",
        delta,
        targetUndoStackLength: currentUndoLen + (R - i),
        isAppStateOnly: false,
      });
      i -= 1;
    }
  }
  return rows;
};

export const HistoryPanel = () => {
  const app = useApp();
  const actionManager = useExcalidrawActionManager();
  const setAppState = useExcalidrawSetAppState();
  const elements = useExcalidrawElements();

  const [expandedUndoGroups, setExpandedUndoGroups] = useState<
    Record<string, boolean>
  >({});
  const [expandedRedoGroups, setExpandedRedoGroups] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    return () => {
      setAppState({ historyPreview: null });
    };
  }, [setAppState]);

  const historyChangedEvent = useEmitter<HistoryChangedEvent>(
    app.history.onHistoryChangedEmitter,
    new HistoryChangedEvent(
      app.history.isUndoStackEmpty,
      app.history.isRedoStackEmpty,
      0,
    ),
  );

  const currentUndoLen = app.history.undoStack.length;

  const { undoRows, redoRows } = useMemo(() => {
    return {
      undoRows: buildUndoRows(app.history.undoStack, currentUndoLen),
      redoRows: buildRedoRows(app.history.redoStack, currentUndoLen),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyChangedEvent, app.history, currentUndoLen]);

  const clearPreview = useCallback(() => {
    setAppState({ historyPreview: null });
  }, [setAppState]);

  const applyPreviewForTarget = useCallback(
    (targetUndoStackLength: number) => {
      const elementsMap = arrayToMap(elements) as SceneElementsMap;
      const simulated = app.history.simulateToUndoStackLength(
        elementsMap,
        app.state,
        targetUndoStackLength,
      );
      if (!simulated) {
        return;
      }
      const [nextMap, nextAppState] = simulated;
      const previewElements = orderByFractionalIndex(
        Array.from(nextMap.values()),
      );
      setAppState({
        historyPreview: {
          elements: previewElements,
          appState: nextAppState,
        },
      });
    },
    [app, elements, setAppState],
  );

  const handleJump = useCallback(
    (targetUndoStackLength: number) => {
      const elementsMap = arrayToMap(elements) as SceneElementsMap;
      const jumped = app.history.jumpToUndoStackLength(
        elementsMap,
        app.state,
        targetUndoStackLength,
      );
      if (!jumped) {
        return;
      }
      const [nextMap, nextAppState] = jumped;
      const nextElements = orderByFractionalIndex(Array.from(nextMap.values()));
      app.syncActionResult({
        elements: nextElements,
        appState: nextAppState,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
      clearPreview();
    },
    [app, clearPreview, elements],
  );

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

  const isHistoryTabOpen =
    app.state.openSidebar?.name === DEFAULT_SIDEBAR.name &&
    app.state.openSidebar.tab === HISTORY_SIDEBAR_TAB;

  return (
    <div
      className="history-panel"
      onPointerLeave={() => {
        if (isHistoryTabOpen) {
          clearPreview();
        }
      }}
    >
      <div className="history-panel__controls">
        <button
          type="button"
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
          type="button"
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

      {undoRows.length === 0 && redoRows.length === 0 ? (
        <div className="history-panel__empty">
          {t("historyPanel.emptyState")}
        </div>
      ) : (
        <div className="history-panel__list" role="list">
          {redoRows.length > 0 && (
            <div className="history-panel__section history-panel__section--redo">
              <div className="history-panel__section-header">
                {t("historyPanel.redoSection")}
              </div>
              {redoRows.map((row, idx) => {
                const groupKey = `redo-${idx}`;
                if (row.kind === "appGroup") {
                  const expanded = expandedRedoGroups[groupKey];
                  const summary = t("historyPanel.appStateGroupSummary", {
                    count: row.deltas.length,
                  });
                  return (
                    <div key={groupKey} className="history-panel__group">
                      <button
                        type="button"
                        className={clsx(
                          "history-panel__entry",
                          "history-panel__entry--interactive",
                          "history-panel__entry--collapsed-group",
                        )}
                        onClick={() => handleJump(row.targetUndoStackLength)}
                        onPointerEnter={() =>
                          applyPreviewForTarget(row.targetUndoStackLength)
                        }
                        onPointerLeave={clearPreview}
                        aria-expanded={expanded}
                      >
                        <span className="history-panel__entry-icon">
                          {RedoIcon}
                        </span>
                        <span className="history-panel__entry-label">
                          {summary}
                        </span>
                        <span
                          className="history-panel__entry-expand"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRedoGroups((prev) => ({
                              ...prev,
                              [groupKey]: !prev[groupKey],
                            }));
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              setExpandedRedoGroups((prev) => ({
                                ...prev,
                                [groupKey]: !prev[groupKey],
                              }));
                            }
                          }}
                          aria-label={
                            expanded
                              ? t("historyPanel.collapseAppStateEntries")
                              : t("historyPanel.expandAppStateEntries")
                          }
                        >
                          {expanded ? "−" : "+"}
                        </span>
                      </button>
                      {expanded &&
                        row.deltas.map((delta) => (
                          <div
                            key={delta.id}
                            className={clsx(
                              "history-panel__entry",
                              "history-panel__entry--nested",
                              "history-panel__entry--selection-only",
                            )}
                            role="listitem"
                          >
                            <span className="history-panel__entry-icon">
                              {RedoIcon}
                            </span>
                            <span className="history-panel__entry-label">
                              {labelForDelta(delta)}
                            </span>
                          </div>
                        ))}
                    </div>
                  );
                }
                const label = labelForDelta(row.delta);
                return (
                  <button
                    key={row.delta.id}
                    type="button"
                    className={clsx(
                      "history-panel__entry",
                      "history-panel__entry--interactive",
                      "history-panel__entry--redo",
                    )}
                    role="listitem"
                    title={label}
                    onClick={() => handleJump(row.targetUndoStackLength)}
                    onPointerEnter={() =>
                      applyPreviewForTarget(row.targetUndoStackLength)
                    }
                    onPointerLeave={clearPreview}
                  >
                    <span className="history-panel__entry-icon">
                      {RedoIcon}
                    </span>
                    <span className="history-panel__entry-label">{label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="history-panel__section history-panel__section--current">
            <div className="history-panel__section-header history-panel__section-header--current">
              {t("historyPanel.currentState")}
            </div>
          </div>

          {undoRows.length > 0 && (
            <div className="history-panel__section history-panel__section--undo">
              <div className="history-panel__section-header">
                {t("historyPanel.undoSection")}
              </div>
              {undoRows.map((row, idx) => {
                const groupKey = `undo-${idx}`;
                if (row.kind === "appGroup") {
                  const expanded = expandedUndoGroups[groupKey];
                  const summary = t("historyPanel.appStateGroupSummary", {
                    count: row.deltas.length,
                  });
                  return (
                    <div key={groupKey} className="history-panel__group">
                      <button
                        type="button"
                        className={clsx(
                          "history-panel__entry",
                          "history-panel__entry--interactive",
                          "history-panel__entry--collapsed-group",
                        )}
                        onClick={() => handleJump(row.targetUndoStackLength)}
                        onPointerEnter={() =>
                          applyPreviewForTarget(row.targetUndoStackLength)
                        }
                        onPointerLeave={clearPreview}
                        aria-expanded={expanded}
                      >
                        <span className="history-panel__entry-icon">
                          {UndoIcon}
                        </span>
                        <span className="history-panel__entry-label">
                          {summary}
                        </span>
                        <span
                          className="history-panel__entry-expand"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedUndoGroups((prev) => ({
                              ...prev,
                              [groupKey]: !prev[groupKey],
                            }));
                          }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              setExpandedUndoGroups((prev) => ({
                                ...prev,
                                [groupKey]: !prev[groupKey],
                              }));
                            }
                          }}
                          aria-label={
                            expanded
                              ? t("historyPanel.collapseAppStateEntries")
                              : t("historyPanel.expandAppStateEntries")
                          }
                        >
                          {expanded ? "−" : "+"}
                        </span>
                      </button>
                      {expanded &&
                        row.deltas.map((delta) => (
                          <div
                            key={delta.id}
                            className={clsx(
                              "history-panel__entry",
                              "history-panel__entry--nested",
                              "history-panel__entry--selection-only",
                            )}
                            role="listitem"
                          >
                            <span className="history-panel__entry-icon">
                              {UndoIcon}
                            </span>
                            <span className="history-panel__entry-label">
                              {labelForDelta(delta)}
                            </span>
                          </div>
                        ))}
                    </div>
                  );
                }
                const label = labelForDelta(row.delta);
                return (
                  <button
                    key={row.delta.id}
                    type="button"
                    className={clsx(
                      "history-panel__entry",
                      "history-panel__entry--interactive",
                    )}
                    role="listitem"
                    title={label}
                    onClick={() => handleJump(row.targetUndoStackLength)}
                    onPointerEnter={() =>
                      applyPreviewForTarget(row.targetUndoStackLength)
                    }
                    onPointerLeave={clearPreview}
                  >
                    <span className="history-panel__entry-icon">
                      {UndoIcon}
                    </span>
                    <span className="history-panel__entry-label">{label}</span>
                  </button>
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
