import clsx from "clsx";
import React from "react";

import { getShortcutFromShortcutName } from "../actions/shortcuts";
import { t } from "../i18n";

import { useExcalidrawAppState, useExcalidrawElements } from "./App";

import { Popover } from "./Popover";

import "./ContextMenu.scss";

import type { AppClassProperties } from "../types";

import type { ActionManager } from "../actions/manager";
import type { ShortcutName } from "../actions/shortcuts";
import type { Action } from "../actions/types";

import type { TranslationKeys } from "../i18n";

export type ContextMenuItem = typeof CONTEXT_MENU_SEPARATOR | Action;

export type ContextMenuCustomItem = {
  __contextMenuCustom: true;
  translationKey: TranslationKeys;
  testId?: string;
  onSelect: (app: AppClassProperties) => void;
  predicate?: Action["predicate"];
};

export type ContextMenuItems = (
  | ContextMenuItem
  | ContextMenuCustomItem
  | false
  | null
  | undefined
)[];

const isContextMenuCustomItem = (
  item: ContextMenuItems[number],
): item is ContextMenuCustomItem =>
  !!item && typeof item === "object" && "__contextMenuCustom" in item;

type ContextMenuProps = {
  actionManager: ActionManager;
  items: ContextMenuItems;
  top: number;
  left: number;
  onClose: (callback?: () => void) => void;
};

export const CONTEXT_MENU_SEPARATOR = "separator";

export const ContextMenu = React.memo(
  ({ actionManager, items, top, left, onClose }: ContextMenuProps) => {
    const appState = useExcalidrawAppState();
    const elements = useExcalidrawElements();

    const filteredItems = items.reduce(
      (acc: (ContextMenuItem | ContextMenuCustomItem)[], item) => {
        if (!item) {
          return acc;
        }
        if (item === CONTEXT_MENU_SEPARATOR) {
          acc.push(item);
          return acc;
        }
        if (isContextMenuCustomItem(item)) {
          if (
            !item.predicate ||
            item.predicate(
              elements,
              appState,
              actionManager.app.props,
              actionManager.app,
            )
          ) {
            acc.push(item);
          }
          return acc;
        }
        if (
          !item.predicate ||
          item.predicate(
            elements,
            appState,
            actionManager.app.props,
            actionManager.app,
          )
        ) {
          acc.push(item);
        }
        return acc;
      },
      [],
    );

    return (
      <Popover
        onCloseRequest={() => {
          onClose();
        }}
        top={top}
        left={left}
        fitInViewport={true}
        offsetLeft={appState.offsetLeft}
        offsetTop={appState.offsetTop}
        viewportWidth={appState.width}
        viewportHeight={appState.height}
        className="context-menu-popover"
      >
        <ul
          className="context-menu"
          onContextMenu={(event) => event.preventDefault()}
        >
          {filteredItems.map((item, idx) => {
            if (item === CONTEXT_MENU_SEPARATOR) {
              if (
                !filteredItems[idx - 1] ||
                filteredItems[idx - 1] === CONTEXT_MENU_SEPARATOR
              ) {
                return null;
              }
              return <hr key={idx} className="context-menu-item-separator" />;
            }

            if (isContextMenuCustomItem(item)) {
              const label = t(item.translationKey);
              return (
                <li
                  key={idx}
                  data-testid={item.testId}
                  onClick={() => {
                    onClose(() => {
                      item.onSelect(actionManager.app);
                    });
                  }}
                >
                  <button type="button" className="context-menu-item">
                    <div className="context-menu-item__label">{label}</div>
                  </button>
                </li>
              );
            }

            const actionName = item.name;
            let label = "";
            if (item.label) {
              if (typeof item.label === "function") {
                label = t(
                  item.label(
                    elements,
                    appState,
                    actionManager.app,
                  ) as unknown as TranslationKeys,
                );
              } else {
                label = t(item.label as unknown as TranslationKeys);
              }
            }

            return (
              <li
                key={idx}
                data-testid={actionName}
                onClick={() => {
                  // we need update state before executing the action in case
                  // the action uses the appState it's being passed (that still
                  // contains a defined contextMenu) to return the next state.
                  onClose(() => {
                    actionManager.executeAction(item, "contextMenu");
                  });
                }}
              >
                <button
                  type="button"
                  className={clsx("context-menu-item", {
                    dangerous: actionName === "deleteSelectedElements",
                    checkmark: item.checked?.(appState),
                  })}
                >
                  <div className="context-menu-item__label">{label}</div>
                  <kbd className="context-menu-item__shortcut">
                    {actionName
                      ? getShortcutFromShortcutName(actionName as ShortcutName)
                      : ""}
                  </kbd>
                </button>
              </li>
            );
          })}
        </ul>
      </Popover>
    );
  },
);
