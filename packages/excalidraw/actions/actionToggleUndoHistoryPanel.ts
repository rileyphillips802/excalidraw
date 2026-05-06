import {
  KEYS,
  DEFAULT_SIDEBAR,
  UNDO_HISTORY_TAB,
  isDarwin,
  matchKey,
} from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { UndoIcon } from "../components/icons";

import { register } from "./register";

import type { AppState } from "../types";

export const actionToggleUndoHistoryPanel = register({
  name: "toggleUndoHistoryPanel",
  icon: UndoIcon,
  keywords: ["history", "undo", "timeline"],
  label: "historyPanel.title",
  viewMode: true,
  trackEvent: { category: "menu", action: "toggleUndoHistory" },
  perform(elements, appState, _, app) {
    if (appState.openDialog) {
      return false;
    }

    const isOpen =
      appState.openSidebar?.name === DEFAULT_SIDEBAR.name &&
      appState.openSidebar.tab === UNDO_HISTORY_TAB;

    return {
      appState: {
        ...appState,
        openSidebar: isOpen
          ? null
          : { name: DEFAULT_SIDEBAR.name, tab: UNDO_HISTORY_TAB },
        openDialog: null,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState: AppState) =>
    appState.openSidebar?.name === DEFAULT_SIDEBAR.name &&
    appState.openSidebar.tab === UNDO_HISTORY_TAB,
  keyTest: (event) =>
    isDarwin
      ? event[KEYS.CTRL_OR_CMD] && event.shiftKey && matchKey(event, KEYS.H)
      : event.altKey &&
        event.shiftKey &&
        matchKey(event, KEYS.H) &&
        !event[KEYS.CTRL_OR_CMD],
});
