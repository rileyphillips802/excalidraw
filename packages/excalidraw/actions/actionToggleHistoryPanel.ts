import {
  KEYS,
  HISTORY_SIDEBAR_TAB,
  DEFAULT_SIDEBAR,
  matchKey,
} from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { HistoryPanelIcon } from "../components/icons";

import { register } from "./register";

import type { AppState } from "../types";

export const actionToggleHistoryPanel = register({
  name: "historyPanel",
  icon: HistoryPanelIcon,
  keywords: ["history", "undo", "redo", "timeline"],
  label: "historyPanel.title",
  viewMode: true,
  trackEvent: { category: "menu" },
  perform(elements, appState) {
    if (appState.openDialog) {
      return false;
    }

    if (
      appState.openSidebar?.name === DEFAULT_SIDEBAR.name &&
      appState.openSidebar.tab === HISTORY_SIDEBAR_TAB
    ) {
      return {
        appState: {
          ...appState,
          openSidebar: null,
          historyPreview: null,
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    return {
      appState: {
        ...appState,
        openSidebar: { name: DEFAULT_SIDEBAR.name, tab: HISTORY_SIDEBAR_TAB },
        openDialog: null,
        historyPreview: null,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState: AppState) =>
    appState.openSidebar?.name === DEFAULT_SIDEBAR.name &&
    appState.openSidebar?.tab === HISTORY_SIDEBAR_TAB,
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && matchKey(event, KEYS.H),
});
