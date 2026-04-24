import {
  KEYS,
  DEFAULT_SIDEBAR,
  HISTORY_SIDEBAR_TAB,
  matchKey,
} from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { historyIcon } from "../components/icons";

import { register } from "./register";

export const actionToggleHistoryPanel = register({
  name: "historyPanel",
  icon: historyIcon,
  keywords: ["history", "undo", "redo", "timeline"],
  label: "historyPanel.title",
  viewMode: false,
  trackEvent: {
    category: "history",
    action: "toggle_history_panel",
  },
  perform(elements, appState, _form, _app) {
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
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    return {
      appState: {
        ...appState,
        openSidebar: { name: DEFAULT_SIDEBAR.name, tab: HISTORY_SIDEBAR_TAB },
        openDialog: null,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    event.shiftKey &&
    matchKey(event, KEYS.H) &&
    !event.altKey,
});
