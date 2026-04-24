import { useCallback, useMemo } from "react";

import { HistoryChangedEvent } from "../history";
import { useEmitter } from "../hooks/useEmitter";
import { useI18n, type TranslationKeys } from "../i18n";
import {
  getHistoryDeltaForRow,
  getHistoryElementChangeCount,
  getHistoryPanelRows,
  isHistoryDeltaAppStateOnly,
} from "../historyPanel";

import { useApp, useExcalidrawActionManager } from "./App";

import "./HistoryPanel.scss";

import type { History } from "../history";
import type { HistoryPanelRow } from "../historyPanel";

function getRowLabel(
  t: (
    key: TranslationKeys,
    replacement?: { [key: string]: string | number } | null,
  ) => string,
  history: History,
  row: HistoryPanelRow,
): string {
  if (row.type === "current") {
    return "";
  }
  const delta = getHistoryDeltaForRow(history, row);
  if (!delta) {
    return t("historyPanel.viewChange");
  }
  if (isHistoryDeltaAppStateOnly(delta)) {
    return t("historyPanel.viewChange");
  }
  const n = getHistoryElementChangeCount(delta);
  if (n > 0) {
    return t("historyPanel.elementChange", { count: n });
  }
  return t("historyPanel.viewChange");
}

export const HistoryPanel = () => {
  const app = useApp();
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();

  const historyEvent = useEmitter(
    app.history.onHistoryChangedEmitter,
    new HistoryChangedEvent(
      app.history.isUndoStackEmpty,
      app.history.isRedoStackEmpty,
    ),
  );

  const rows = useMemo(
    () => getHistoryPanelRows(app.history),
    // History stacks are mutated in place; onHistoryChangedEmitter is the re-render signal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [historyEvent],
  );

  const redoRows = useMemo(
    () => rows.filter((r): r is Extract<HistoryPanelRow, { type: "redo" }> => r.type === "redo"),
    [rows],
  );
  const undoRows = useMemo(
    () => rows.filter((r): r is Extract<HistoryPanelRow, { type: "undo" }> => r.type === "undo"),
    [rows],
  );
  const hasCurrent = rows.some((r) => r.type === "current");

  const onRowClick = useCallback(
    (row: HistoryPanelRow) => {
      if (row.type === "current") {
        return;
      }
      const undoAction = actionManager.actions.undo;
      const redoAction = actionManager.actions.redo;
      if (row.type === "undo") {
        for (let i = 0; i < row.undosFromCurrent; i++) {
          actionManager.executeAction(undoAction, "ui");
        }
      } else {
        for (let i = 0; i < row.redosFromCurrent; i++) {
          actionManager.executeAction(redoAction, "ui");
        }
      }
    },
    [actionManager],
  );

  return (
    <div className="layer-ui__history" data-testid="history-panel">
      <h2 className="layer-ui__history-title">{t("historyPanel.title")}</h2>
      {rows.length === 0 ? (
        <p className="layer-ui__history-empty">{t("historyPanel.empty")}</p>
      ) : (
        <ul className="layer-ui__history-list" aria-label={t("historyPanel.title")}>
          {redoRows.length > 0 && (
            <li className="layer-ui__history-section" aria-hidden>
              <div className="layer-ui__history-section-label">
                {t("historyPanel.sectionRedo")}
              </div>
            </li>
          )}
          {redoRows.map((row) => (
            <li key={`redo-${row.stackIndex}`} className="layer-ui__history-section">
              <button
                type="button"
                className="layer-ui__history-row"
                onClick={() => onRowClick(row)}
              >
                <span className="layer-ui__history-badges">
                  <span className="layer-ui__history-badge">
                    {t("historyPanel.labelRedo")}
                  </span>
                </span>{" "}
                {getRowLabel(t, app.history, row)}
              </button>
            </li>
          ))}
          {hasCurrent && (
            <li key="current" className="layer-ui__history-section">
              <div
                className="layer-ui__history-row layer-ui__history-row--current"
                role="status"
                aria-current="true"
              >
                {t("historyPanel.current")}
              </div>
            </li>
          )}
          {undoRows.length > 0 && (
            <li className="layer-ui__history-section" aria-hidden>
              <div className="layer-ui__history-section-label">
                {t("historyPanel.sectionUndo")}
              </div>
            </li>
          )}
          {undoRows.map((row) => (
            <li key={`undo-${row.stackIndex}`} className="layer-ui__history-section">
              <button
                type="button"
                className="layer-ui__history-row"
                onClick={() => onRowClick(row)}
              >
                <span className="layer-ui__history-badges">
                  <span className="layer-ui__history-badge">
                    {t("historyPanel.labelUndo")}
                  </span>
                </span>{" "}
                {getRowLabel(t, app.history, row)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <p className="layer-ui__history-note">{t("historyPanel.driftNote")}</p>
      )}
    </div>
  );
};

HistoryPanel.displayName = "HistoryPanel";
