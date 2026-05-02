import clsx from "clsx";
import React, { useCallback } from "react";

import { arrayToMap } from "@excalidraw/common";

import { orderByFractionalIndex } from "@excalidraw/element";

import type { SceneElementsMap } from "@excalidraw/element/types";

import { summarizeHistoryDelta } from "../../historySummary";
import { useEmitter } from "../../hooks/useEmitter";
import { useI18n } from "../../i18n";
import { HistoryChangedEvent } from "../../history";
import { useApp, useExcalidrawSetAppState } from "../App";
import { Sidebar } from "../Sidebar/Sidebar";
import {
  PlusIcon,
  TrashIcon,
  ArrowIcon,
  RectangleIcon,
  palette,
  eyeIcon,
  paintIcon,
} from "../icons";

import { HISTORY_SIDEBAR_NAME } from "./constants";

import "./HistorySidebar.scss";

import type { HistoryDeltaSummary } from "../../historySummary";

const MAX_VISIBLE_ENTRIES = 200;

type TimelineRow =
  | {
      kind: "undo";
      /** Apply this many undos from the current canvas state */
      steps: number;
      summary: HistoryDeltaSummary;
      recordedAt: number;
    }
  | {
      kind: "redo";
      /** Apply this many redos from the current canvas state */
      steps: number;
      summary: HistoryDeltaSummary;
      recordedAt: number;
    }
  | { kind: "current" };

function buildTimeline(app: ReturnType<typeof useApp>): TimelineRow[] {
  const { history } = app;
  const rows: TimelineRow[] = [];

  for (let i = history.undoStack.length - 1; i >= 0; i--) {
    rows.push({
      kind: "undo",
      steps: history.undoStack.length - i,
      summary: summarizeHistoryDelta(history.undoStack[i]),
      recordedAt: history.undoRecordedAt[i] ?? Date.now(),
    });
    if (rows.length >= MAX_VISIBLE_ENTRIES) {
      return rows;
    }
  }

  rows.push({ kind: "current" });

  for (let i = history.redoStack.length - 1; i >= 0; i--) {
    rows.push({
      kind: "redo",
      steps: history.redoStack.length - i,
      summary: summarizeHistoryDelta(history.redoStack[i]),
      recordedAt: history.redoRecordedAt[i] ?? Date.now(),
    });
    if (rows.length >= MAX_VISIBLE_ENTRIES) {
      return rows;
    }
  }

  return rows;
}

function formatRelativeTime(ts: number, t: ReturnType<typeof useI18n>["t"]) {
  const sec = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (sec < 60) {
    return t("history.timeAgoSeconds", { count: sec });
  }
  const min = Math.floor(sec / 60);
  return t("history.timeAgoMinutes", { count: min });
}

function SummaryIcon({ summary }: { summary: HistoryDeltaSummary }) {
  switch (summary.icon) {
    case "add":
      return PlusIcon;
    case "remove":
      return TrashIcon;
    case "move":
      return ArrowIcon;
    case "resize":
      return RectangleIcon;
    case "style":
      return palette;
    case "view":
      return eyeIcon;
    default:
      return paintIcon;
  }
}

export const HistorySidebar: React.FC = () => {
  const { t } = useI18n();
  const app = useApp();
  const setAppState = useExcalidrawSetAppState();

  const historyEvent = useEmitter<HistoryChangedEvent>(
    app.history.onHistoryChangedEmitter,
    new HistoryChangedEvent(
      app.history.isUndoStackEmpty,
      app.history.isRedoStackEmpty,
    ),
  );

  const rows = buildTimeline(app);
  void historyEvent;

  const clearPreview = useCallback(() => {
    setAppState({ historyPreview: null });
  }, [setAppState]);

  const applyPreviewForRow = useCallback(
    (row: TimelineRow) => {
      if (row.kind === "current") {
        clearPreview();
        return;
      }
      const elementsMap = arrayToMap(
        app.scene.getElementsIncludingDeleted(),
      ) as SceneElementsMap;
      const sim =
        row.kind === "undo"
          ? app.history.previewAfterUndos(
              elementsMap,
              app.state,
              row.steps,
            )
          : app.history.previewAfterRedos(
              elementsMap,
              app.state,
              row.steps,
            );
      if (!sim) {
        clearPreview();
        return;
      }
      const [nextMap, nextAppState] = sim;
      const elements = orderByFractionalIndex(Array.from(nextMap.values()));
      setAppState({
        historyPreview: {
          elements,
          appState: nextAppState,
        },
      });
    },
    [app, clearPreview, setAppState],
  );

  const onRowClick = useCallback(
    (row: TimelineRow) => {
      clearPreview();
      if (row.kind === "undo") {
        app.jumpHistoryByDelta(row.steps);
      } else if (row.kind === "redo") {
        app.jumpHistoryByDelta(-row.steps);
      }
    },
    [app, clearPreview],
  );

  return (
    <Sidebar name={HISTORY_SIDEBAR_NAME} docked={false}>
      <Sidebar.Header>
        <div className="history-sidebar__title">{t("history.panelTitle")}</div>
      </Sidebar.Header>
      <div
        className="history-sidebar__body"
        onMouseLeave={(event) => {
          const next = event.relatedTarget as Node | null;
          if (next && event.currentTarget.contains(next)) {
            return;
          }
          clearPreview();
        }}
      >
        {rows.length <= 1 ? (
          <div className="history-sidebar__empty">{t("history.empty")}</div>
        ) : (
          <ul className="history-sidebar__list" aria-label={t("history.panelTitle")}>
            {rows.map((row, idx) => {
              if (row.kind === "current") {
                return (
                  <li
                    key={`current-${idx}`}
                    className="history-sidebar__current"
                    aria-current="step"
                  >
                    <span className="history-sidebar__current-dot" />
                    {t("history.current")}
                  </li>
                );
              }

              const Icon = SummaryIcon(row);
              const label = t(
                `history.summary.${row.summary.labelKey}` as any,
                row.summary.labelParams as
                  | { [key: string]: string | number }
                  | undefined,
              );

              return (
                <li key={`${row.kind}-${idx}-${row.steps}`}>
                  <button
                    type="button"
                    className={clsx("history-sidebar__row", {
                      "history-sidebar__row--collapsed":
                        row.summary.collapsedDefault,
                    })}
                    onMouseEnter={() => applyPreviewForRow(row)}
                    onFocus={() => applyPreviewForRow(row)}
                    onMouseLeave={(e) => {
                      const next = e.relatedTarget as Node | null;
                      if (
                        next &&
                        e.currentTarget.parentElement?.contains(next)
                      ) {
                        return;
                      }
                      clearPreview();
                    }}
                    onBlur={clearPreview}
                    onClick={() => onRowClick(row)}
                  >
                    <span className="history-sidebar__icon" aria-hidden>
                      {Icon}
                    </span>
                    <span className="history-sidebar__label">{label}</span>
                    <span className="history-sidebar__time">
                      {formatRelativeTime(row.recordedAt, t)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sidebar>
  );
};

HistorySidebar.displayName = "HistorySidebar";
