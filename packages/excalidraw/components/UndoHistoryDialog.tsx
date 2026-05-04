import clsx from "clsx";
import React, { useCallback, useMemo, useState } from "react";

import { toBrandedType } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  isElementInViewport,
  orderByFractionalIndex,
} from "@excalidraw/element";

import type {
  NonDeletedExcalidrawElement,
  NonDeletedSceneElementsMap,
  OrderedExcalidrawElement,
} from "@excalidraw/element/types";

import { getShortcutFromShortcutName } from "../actions/shortcuts";
import {
  HistoryChangedEvent,
  HistoryDelta,
  isAppStateOnlyHistoryEntry,
} from "../history";
import { useEmitter } from "../hooks/useEmitter";
import { t } from "../i18n";
import { describeHistoryDelta } from "../undoHistoryLabel";

import { useApp } from "./App";
import { Dialog } from "./Dialog";
import { Island } from "./Island";
import { RedoIcon, UndoIcon } from "./icons";
import { StaticCanvas } from "./canvases";

import "./UndoHistoryDialog.scss";

import type { RenderableElementsMap } from "../scene/types";

import type { AppState } from "../types";

const labelForUndoStep = (
  history: {
    undoStack: readonly HistoryDelta[];
    redoStack: readonly HistoryDelta[];
  },
  u: number,
  presentUndoLen: number,
  totalLen: number,
): string => {
  if (u === 0) {
    return t("undoHistory.initial");
  }
  if (u <= presentUndoLen) {
    return describeHistoryDelta(HistoryDelta.inverse(history.undoStack[u - 1]));
  }
  const redoIdx = totalLen - u;
  return describeHistoryDelta(history.redoStack[redoIdx]);
};

const forwardDeltaForStep = (
  history: {
    undoStack: readonly HistoryDelta[];
    redoStack: readonly HistoryDelta[];
  },
  u: number,
  presentUndoLen: number,
  totalLen: number,
): HistoryDelta | null => {
  if (u === 0) {
    return null;
  }
  if (u <= presentUndoLen) {
    return HistoryDelta.inverse(history.undoStack[u - 1]);
  }
  const redoIdx = totalLen - u;
  return history.redoStack[redoIdx];
};

export const UndoHistoryDialog = ({
  onCloseRequest,
}: {
  onCloseRequest: () => void;
}) => {
  const app = useApp();
  const history = app.history;

  useEmitter(
    history.onHistoryChangedEmitter,
    new HistoryChangedEvent(history.isUndoStackEmpty, history.isRedoStackEmpty),
  );

  const [hoverUndoLen, setHoverUndoLen] = useState<number | null>(null);
  const [showCollapsed, setShowCollapsed] = useState(false);

  const elementsMap = app.getSceneElementsMapIncludingDeleted();
  const appState = app.state;

  const undoLen = history.undoStack.length;
  const redoLen = history.redoStack.length;
  const total = undoLen + redoLen;
  const presentUndoLen = undoLen;

  const previewUndoLen = hoverUndoLen !== null ? hoverUndoLen : presentUndoLen;

  const [previewElementsMap, previewAppStateBase] = useMemo(() => {
    const [elMap, nextAppState] = history.getStateAtUndoLength(
      elementsMap,
      appState,
      previewUndoLen,
    );
    return [elMap, nextAppState];
  }, [history, elementsMap, appState, previewUndoLen]);

  const previewAppState = useMemo(
    () =>
      ({
        ...previewAppStateBase,
        openDialog: null,
      } as AppState),
    [previewAppStateBase],
  );

  const previewAllElementsMap = useMemo(() => {
    const ordered = orderByFractionalIndex(
      Array.from(previewElementsMap.values()).filter(
        (el) => !el.isDeleted,
      ) as OrderedExcalidrawElement[],
    );
    return toBrandedType<NonDeletedSceneElementsMap>(
      new Map(ordered.map((el) => [el.id, el])),
    );
  }, [previewElementsMap]);

  const previewRenderable = useMemo(() => {
    const ordered = orderByFractionalIndex(
      Array.from(previewElementsMap.values()).filter(
        (el) => !el.isDeleted,
      ) as OrderedExcalidrawElement[],
    );
    const map = toBrandedType<RenderableElementsMap>(new Map());
    for (const el of ordered) {
      map.set(el.id, el);
    }
    const visibleElements: NonDeletedExcalidrawElement[] = [];
    for (const element of map.values()) {
      if (
        isElementInViewport(
          element,
          appState.height,
          appState.width,
          {
            zoom: appState.zoom,
            offsetLeft: appState.offsetLeft,
            offsetTop: appState.offsetTop,
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
          },
          map,
        )
      ) {
        visibleElements.push(element);
      }
    }
    return { elementsMap: map, visibleElements };
  }, [previewElementsMap, appState]);

  const rows = useMemo(() => {
    const out: {
      undoLen: number;
      label: string;
      collapsed: boolean;
      kind: "past" | "current" | "future";
    }[] = [];

    for (let u = 0; u <= total; u++) {
      const fd = forwardDeltaForStep(history, u, presentUndoLen, total);
      const collapsed = fd ? isAppStateOnlyHistoryEntry(fd) : false;
      const baseLabel = labelForUndoStep(history, u, presentUndoLen, total);
      const label =
        collapsed && u > 0
          ? `${baseLabel} (${t("undoHistory.selectionOnly")})`
          : baseLabel;
      const kind =
        u < presentUndoLen
          ? "past"
          : u === presentUndoLen
          ? "current"
          : "future";
      out.push({ undoLen: u, label, collapsed, kind });
    }

    return out;
  }, [history, total, presentUndoLen]);

  const visibleRows = showCollapsed
    ? rows
    : rows.filter((r) => !r.collapsed || r.kind === "current");

  const jumpTo = useCallback(
    (targetLen: number) => {
      const result = history.navigateToUndoLength(
        app.getSceneElementsMapIncludingDeleted(),
        app.state,
        targetLen,
      );
      if (!result) {
        return;
      }
      const [nextMap, nextAppState] = result;
      const nextElements = orderByFractionalIndex(Array.from(nextMap.values()));
      app.syncActionResult({
        elements: nextElements,
        appState: {
          ...(nextAppState as Partial<AppState>),
          openDialog: app.state.openDialog,
        },
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    },
    [app, history],
  );

  return (
    <Dialog
      onCloseRequest={onCloseRequest}
      title={t("undoHistory.title")}
      size="wide"
      className="UndoHistoryDialog"
    >
      <div className="UndoHistoryDialog__layout">
        <Island padding={2} className="UndoHistoryDialog__preview">
          <div className="UndoHistoryDialog__preview-inner">
            <StaticCanvas
              canvas={app.canvas}
              rc={app.rc}
              elementsMap={previewRenderable.elementsMap}
              allElementsMap={previewAllElementsMap}
              visibleElements={previewRenderable.visibleElements}
              sceneNonce={previewUndoLen}
              selectionNonce={
                previewAppState.editingTextElement?.versionNonce ?? undefined
              }
              scale={window.devicePixelRatio}
              appState={previewAppState}
              renderConfig={{
                imageCache: app.imageCache,
                isExporting: false,
                renderGrid: false,
                canvasBackgroundColor: previewAppState.viewBackgroundColor,
                embedsValidationStatus: app.getEmbedsValidationStatus(),
                elementsPendingErasure: app.getElementsPendingErasure(),
                pendingFlowchartNodes: app.flowChartCreator.pendingNodes,
                theme: previewAppState.theme,
              }}
            />
          </div>
          {hoverUndoLen !== null && (
            <div className="UndoHistoryDialog__preview-badge">
              {t("undoHistory.previewHint")}
            </div>
          )}
        </Island>
        <div className="UndoHistoryDialog__list-wrap">
          <label className="UndoHistoryDialog__toggle">
            <input
              type="checkbox"
              checked={showCollapsed}
              onChange={(e) => setShowCollapsed(e.target.checked)}
            />
            {t("undoHistory.showSelectionChanges")}
          </label>
          <ul
            className="UndoHistoryDialog__list"
            role="listbox"
            aria-label={t("undoHistory.title")}
          >
            {visibleRows.map((row) => (
              <li key={row.undoLen}>
                <button
                  type="button"
                  role="option"
                  aria-selected={row.undoLen === presentUndoLen}
                  className={clsx("UndoHistoryDialog__row", {
                    "UndoHistoryDialog__row--past": row.kind === "past",
                    "UndoHistoryDialog__row--current": row.kind === "current",
                    "UndoHistoryDialog__row--future": row.kind === "future",
                    "UndoHistoryDialog__row--hover-preview":
                      hoverUndoLen === row.undoLen,
                  })}
                  data-testid={`undo-history-step-${row.undoLen}`}
                  onMouseEnter={() => setHoverUndoLen(row.undoLen)}
                  onMouseLeave={() => setHoverUndoLen(null)}
                  onFocus={() => setHoverUndoLen(row.undoLen)}
                  onBlur={() => setHoverUndoLen(null)}
                  onClick={() => jumpTo(row.undoLen)}
                >
                  <span className="UndoHistoryDialog__row-icon" aria-hidden>
                    {row.kind === "future" ? RedoIcon : UndoIcon}
                  </span>
                  <span className="UndoHistoryDialog__row-label">
                    {row.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="UndoHistoryDialog__hint">
            {t("undoHistory.shortcutHint", {
              shortcut: getShortcutFromShortcutName("undoHistoryPanel"),
            })}
          </p>
        </div>
      </div>
    </Dialog>
  );
};
