import { KEYS, matchKey } from "@excalidraw/common";

import { CaptureUpdateAction } from "@excalidraw/element";

import { isHistoryPanelOpenAtom } from "../components/HistoryPanel";
import { historyIcon } from "../components/icons";
import { editorJotaiStore } from "../editor-jotai";

import { register } from "./register";

export const actionToggleHistoryPanel = register({
  name: "toggleHistoryPanel",
  label: "labels.historyPanel",
  icon: historyIcon,
  viewMode: true,
  trackEvent: {
    category: "history",
    action: "togglePanel",
  },
  keywords: ["history", "timeline", "undo", "redo"],
  perform(elements, appState) {
    const open = editorJotaiStore.get(isHistoryPanelOpenAtom);
    editorJotaiStore.set(isHistoryPanelOpenAtom, !open);
    return { captureUpdate: CaptureUpdateAction.EVENTUALLY };
  },
  keyTest: (event) =>
    event[KEYS.CTRL_OR_CMD] && event.shiftKey && matchKey(event, KEYS.H),
});
