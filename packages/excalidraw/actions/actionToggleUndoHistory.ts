import { KEYS, matchKey } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { historyIcon } from "../components/icons";
import { HISTORY_SIDEBAR_NAME } from "../components/history/constants";

import { register } from "./register";

export const actionToggleUndoHistory = register({
  name: "toggleUndoHistory",
  icon: historyIcon,
  label: "history.panelTitle",
  keywords: ["history", "undo", "redo", "timeline"],
  viewMode: true,
  trackEvent: { category: "history", action: "togglePanel" },
  perform(_elements, appState) {
    if (appState.openDialog) {
      return false;
    }

    const isOpen = appState.openSidebar?.name === HISTORY_SIDEBAR_NAME;

    return {
      appState: {
        ...appState,
        openSidebar: isOpen ? null : { name: HISTORY_SIDEBAR_NAME },
        historyPreview: isOpen ? null : appState.historyPreview,
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] &&
    event.shiftKey &&
    matchKey(event, KEYS.H),
});
