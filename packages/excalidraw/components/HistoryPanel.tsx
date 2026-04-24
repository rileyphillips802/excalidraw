import clsx from "clsx";
import { memo, useMemo, useState } from "react";

import { createRedoAction, createUndoAction } from "../actions/actionHistory";
import { HistoryChangedEvent } from "../history";
import { useEmitter } from "../hooks/useEmitter";
import { atom, useAtom } from "../editor-jotai";

import { Island } from "./Island";
import { CloseIcon, historyIcon, UndoIcon, RedoIcon } from "./icons";

import "./HistoryPanel.scss";

import type { HistoryEntrySummary } from "../history";
import type { AppClassProperties } from "../types";

export const isHistoryPanelOpenAtom = atom<boolean>(false);

interface HistoryPanelProps {
  app: AppClassProperties;
  actionManager: AppClassProperties["actionManager"];
}

const formatRelativeTime = (timestamp: number, now: number) => {
  if (!timestamp) {
    return "";
  }
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 5) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
};

const EntryRow = ({
  entry,
  direction,
  onJump,
}: {
  entry: HistoryEntrySummary;
  direction: "undo" | "redo";
  onJump: () => void;
}) => {
  const icon = direction === "undo" ? UndoIcon : RedoIcon;
  return (
    <button
      type="button"
      className={clsx("HistoryPanel__entry", {
        "HistoryPanel__entry--appState": entry.appStateOnly,
        "HistoryPanel__entry--redo": direction === "redo",
      })}
      onClick={onJump}
      title={`${entry.label} — ${direction} ${entry.stepsAway} step${
        entry.stepsAway === 1 ? "" : "s"
      }`}
    >
      <span className="HistoryPanel__entry-icon" aria-hidden>
        {icon}
      </span>
      <span className="HistoryPanel__entry-label">{entry.label}</span>
      <span className="HistoryPanel__entry-time">
        {formatRelativeTime(entry.timestamp, Date.now())}
      </span>
    </button>
  );
};

export const HistoryPanel = memo(({ app, actionManager }: HistoryPanelProps) => {
  const [, setOpen] = useAtom(isHistoryPanelOpenAtom);

  // re-render whenever the history stacks change
  useEmitter<HistoryChangedEvent>(
    app.history.onHistoryChangedEmitter,
    new HistoryChangedEvent(
      app.history.isUndoStackEmpty,
      app.history.isRedoStackEmpty,
    ),
  );

  // re-render every 30s so "x s ago" labels stay fresh while panel is open
  const [, setTick] = useState(0);
  useMemo(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const entries = app.history.getEntries();

  const jump = (direction: "undo" | "redo", steps: number) => {
    const createAction =
      direction === "undo" ? createUndoAction : createRedoAction;
    for (let i = 0; i < steps; i++) {
      actionManager.executeAction(createAction(app.history));
    }
  };

  const isEmpty = entries.undo.length === 0 && entries.redo.length === 0;

  return (
    <Island className="HistoryPanel" padding={0}>
      <div className="HistoryPanel__header">
        <span className="HistoryPanel__header-icon" aria-hidden>
          {historyIcon}
        </span>
        <span className="HistoryPanel__header-title">History</span>
        <button
          type="button"
          className="HistoryPanel__close"
          aria-label="Close history"
          onClick={() => setOpen(false)}
        >
          {CloseIcon}
        </button>
      </div>

      <div className="HistoryPanel__body">
        {isEmpty && (
          <div className="HistoryPanel__empty">
            No history yet — start drawing.
          </div>
        )}

        {entries.redo.length > 0 && (
          <div className="HistoryPanel__section HistoryPanel__section--redo">
            <div className="HistoryPanel__section-heading">
              Redo ({entries.redo.length})
            </div>
            {entries.redo.map((entry, i) => (
              <EntryRow
                key={`redo-${i}`}
                entry={entry}
                direction="redo"
                onJump={() => jump("redo", entry.stepsAway)}
              />
            ))}
          </div>
        )}

        {(entries.redo.length > 0 || entries.undo.length > 0) && (
          <div className="HistoryPanel__current">
            <span className="HistoryPanel__current-dot" aria-hidden />
            <span>Current state</span>
          </div>
        )}

        {entries.undo.length > 0 && (
          <div className="HistoryPanel__section HistoryPanel__section--undo">
            <div className="HistoryPanel__section-heading">
              Undo ({entries.undo.length})
            </div>
            {entries.undo.map((entry, i) => (
              <EntryRow
                key={`undo-${i}`}
                entry={entry}
                direction="undo"
                onJump={() => jump("undo", entry.stepsAway)}
              />
            ))}
          </div>
        )}
      </div>
    </Island>
  );
});

HistoryPanel.displayName = "HistoryPanel";
