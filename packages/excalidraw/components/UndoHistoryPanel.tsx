import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  orderByFractionalIndex,
  CaptureUpdateAction,
} from "@excalidraw/element";

import type { SceneElementsMap } from "@excalidraw/element/types";

import {
  describeHistoryEntry,
  isAppStateOnlyHistoryEntry,
} from "../historyHelpers";

import { useI18n } from "../i18n";

import { useApp } from "./App";

import "./UndoHistoryPanel.scss";

import type { HistoryChangedEvent, HistoryDelta } from "../history";

type StepRow = {
  id: string;
  kind: "undo" | "redo" | "current";
  /** Index in undoStack (0 = oldest) or redoStack (0 = next redo) */
  stackIndex: number;
  /** Target stack lengths after this step is the current document */
  undoLen: number;
  redoLen: number;
  label: string;
  isAppStateOnly: boolean;
};

const buildSteps = (
  undoStack: HistoryDelta[],
  redoStack: HistoryDelta[],
  currentLabel: string,
): StepRow[] => {
  const rows: StepRow[] = [];
  for (let i = 0; i < undoStack.length; i++) {
    const delta = undoStack[i]!;
    rows.push({
      id: `u-${i}`,
      kind: "undo",
      stackIndex: i,
      undoLen: i,
      redoLen: 0,
      label: describeHistoryEntry(delta),
      isAppStateOnly: isAppStateOnlyHistoryEntry(delta),
    });
  }
  rows.push({
    id: "current",
    kind: "current",
    stackIndex: undoStack.length,
    undoLen: undoStack.length,
    redoLen: 0,
    label: currentLabel,
    isAppStateOnly: false,
  });
  for (let j = 0; j < redoStack.length; j++) {
    const delta = redoStack[j]!;
    rows.push({
      id: `r-${j}`,
      kind: "redo",
      stackIndex: j,
      undoLen: undoStack.length,
      redoLen: j + 1,
      label: describeHistoryEntry(delta),
      isAppStateOnly: isAppStateOnlyHistoryEntry(delta),
    });
  }
  return rows;
};

export const UndoHistoryPanel = () => {
  const { t } = useI18n();
  const app = useApp();
  const history = app.history;

  const [historyRev, setHistoryRev] = useState(0);
  useEffect(() => {
    const unsub = history.onHistoryChangedEmitter.on(
      (ev: HistoryChangedEvent) => {
        setHistoryRev(ev.revision);
      },
    );
    return unsub;
  }, [history]);

  useEffect(() => {
    setPreviewTarget(null);
    beforePreviewRef.current = null;
  }, [historyRev]);

  const undoStack = history.undoStack;
  const redoStack = history.redoStack;

  const steps = buildSteps(undoStack, redoStack, t("historyPanel.current"));

  const [showAppStateEntries, setShowAppStateEntries] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<{
    undoLen: number;
    redoLen: number;
  } | null>(null);

  const beforePreviewRef = useRef<{ undoLen: number; redoLen: number } | null>(
    null,
  );

  const getElementsMap = useCallback(
    () =>
      new Map(app.scene.getElementsMapIncludingDeleted()) as SceneElementsMap,
    [app],
  );

  const applyJump = useCallback(
    (
      undoLen: number,
      redoLen: number,
      options: { captureUpdate: typeof CaptureUpdateAction.NEVER },
    ) => {
      const elementsMap = getElementsMap();
      const result = history.jumpToStepIndices(
        elementsMap,
        app.state,
        undoLen,
        redoLen,
      );
      if (!result) {
        return;
      }
      const [nextMap, nextAppState] = result;
      const nextElements = orderByFractionalIndex(Array.from(nextMap.values()));
      app.syncActionResult({
        elements: nextElements,
        appState: nextAppState,
        captureUpdate: options.captureUpdate,
      });
    },
    [app, getElementsMap, history],
  );

  const applyPreview = useCallback(
    (undoLen: number, redoLen: number) => {
      const elementsMap = getElementsMap();
      const result = history.simulateToStepIndices(
        elementsMap,
        app.state,
        undoLen,
        redoLen,
      );
      if (!result) {
        return;
      }
      const [nextMap, nextAppState] = result;
      const nextElements = orderByFractionalIndex(Array.from(nextMap.values()));
      app.syncActionResult({
        elements: nextElements,
        appState: nextAppState,
        captureUpdate: CaptureUpdateAction.NEVER,
      });
    },
    [app, getElementsMap, history],
  );

  useLayoutEffect(() => {
    if (previewTarget) {
      if (!beforePreviewRef.current) {
        beforePreviewRef.current = {
          undoLen: undoStack.length,
          redoLen: redoStack.length,
        };
      }
      applyPreview(previewTarget.undoLen, previewTarget.redoLen);
    } else if (beforePreviewRef.current) {
      const { undoLen, redoLen } = beforePreviewRef.current;
      beforePreviewRef.current = null;
      applyJump(undoLen, redoLen, { captureUpdate: CaptureUpdateAction.NEVER });
    }
  }, [
    previewTarget,
    applyPreview,
    applyJump,
    undoStack.length,
    redoStack.length,
  ]);

  const visibleSteps = useMemo(() => {
    if (showAppStateEntries) {
      return steps;
    }
    return steps.filter((s) => s.kind === "current" || !s.isAppStateOnly);
  }, [steps, showAppStateEntries]);

  const hiddenAppStateCount = steps.filter(
    (s) => s.kind !== "current" && s.isAppStateOnly,
  ).length;

  const handleRowClick = (row: StepRow) => {
    if (row.kind === "current") {
      return;
    }
    setPreviewTarget(null);
    beforePreviewRef.current = null;
    applyJump(row.undoLen, row.redoLen, {
      captureUpdate: CaptureUpdateAction.NEVER,
    });
  };

  const handleListLeave = () => {
    setPreviewTarget(null);
  };

  return (
    <div
      className="undo-history-panel"
      onPointerLeave={handleListLeave}
      data-testid="undo-history-panel"
    >
      <div className="undo-history-panel__header">
        {t("historyPanel.title")}
      </div>
      {hiddenAppStateCount > 0 && (
        <button
          type="button"
          className="undo-history-panel__toggle-appstate"
          onClick={() => setShowAppStateEntries((v) => !v)}
        >
          {showAppStateEntries
            ? t("historyPanel.hideAppStateOnly")
            : t("historyPanel.showAppStateOnly", {
                count: hiddenAppStateCount,
              })}
        </button>
      )}
      <ul className="undo-history-panel__list" role="listbox">
        {visibleSteps.map((row) => {
          const isCurrent = row.kind === "current";
          const highlighted = previewTarget
            ? previewTarget.undoLen === row.undoLen &&
              previewTarget.redoLen === row.redoLen
            : undoStack.length === row.undoLen &&
              redoStack.length === row.redoLen;

          return (
            <li key={row.id}>
              <button
                type="button"
                role="option"
                aria-selected={highlighted}
                className="undo-history-panel__row"
                data-active={highlighted ? true : undefined}
                data-current={isCurrent ? true : undefined}
                disabled={isCurrent}
                onClick={() => handleRowClick(row)}
                onPointerEnter={() => {
                  if (!isCurrent) {
                    setPreviewTarget({
                      undoLen: row.undoLen,
                      redoLen: row.redoLen,
                    });
                  }
                }}
              >
                <span className="undo-history-panel__icon" aria-hidden>
                  {row.kind === "redo" ? (
                    "↻"
                  ) : row.kind === "current" ? (
                    <span className="undo-history-panel__current-dot" />
                  ) : (
                    "↺"
                  )}
                </span>
                <span className="undo-history-panel__label">{row.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

UndoHistoryPanel.displayName = "UndoHistoryPanel";
