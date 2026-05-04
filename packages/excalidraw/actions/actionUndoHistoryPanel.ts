import { CODES, KEYS, matchKey } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { historyIcon } from "../components/icons";

import { register } from "./register";

export const actionToggleUndoHistoryPanel = register({
  name: "toggleUndoHistoryPanel",
  icon: historyIcon,
  keywords: ["undo", "redo", "history", "time"],
  label: "undoHistory.title",
  trackEvent: { category: "history", action: "toggle_undo_history_panel" },
  viewMode: true,
  perform: (_elements, appState) => {
    if (appState.openDialog?.name === "undoHistory") {
      return {
        appState: { openDialog: null },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    if (appState.openDialog) {
      return false;
    }

    return {
      appState: { openDialog: { name: "undoHistory" } },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState) => appState.openDialog?.name === "undoHistory",
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    event.shiftKey &&
    (matchKey(event, KEYS.H) || event.code === CODES.H),
});
