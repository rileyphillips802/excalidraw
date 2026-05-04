import { Emitter } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  StoreChange,
  StoreDelta,
} from "@excalidraw/element";

import type { StoreSnapshot, Store } from "@excalidraw/element";

import type { SceneElementsMap } from "@excalidraw/element/types";

import type { AppState } from "./types";

/** True if the delta only affects selection / editing UI in app state (no element or canvas data). */
export const isAppStateOnlyHistoryEntry = (delta: HistoryDelta): boolean => {
  if (!delta.elements.isEmpty()) {
    return false;
  }

  if (delta.appState.isEmpty()) {
    return false;
  }

  const { deleted, inserted } = delta.appState.delta;
  const selectionKeys = new Set([
    "selectedElementIds",
    "selectedGroupIds",
    "lockedMultiSelections",
    "selectedLinearElement",
    "editingGroupId",
    "croppingElementId",
    "activeLockedId",
  ]);

  for (const key of Object.keys(deleted)) {
    if (!selectionKeys.has(key)) {
      return false;
    }
  }

  for (const key of Object.keys(inserted)) {
    if (!selectionKeys.has(key)) {
      return false;
    }
  }

  return true;
};

export class HistoryDelta extends StoreDelta {
  /**
   * Apply the delta to the passed elements and appState, does not modify the snapshot.
   */
  public applyTo(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: StoreSnapshot,
  ): [SceneElementsMap, AppState, boolean] {
    const [nextElements, elementsContainVisibleChange] = this.elements.applyTo(
      elements,
      // used to fallback into local snapshot in case we couldn't apply the delta
      // due to a missing (force deleted) elements in the scene
      snapshot.elements,
      // we don't want to apply the `version` and `versionNonce` properties for history
      // as we always need to end up with a new version due to collaboration,
      // approaching each undo / redo as a new user action
      {
        excludedProperties: new Set(["version", "versionNonce"]),
      },
    );

    const [nextAppState, appStateContainsVisibleChange] = this.appState.applyTo(
      appState,
      nextElements,
    );

    const appliedVisibleChanges =
      elementsContainVisibleChange || appStateContainsVisibleChange;

    return [nextElements, nextAppState, appliedVisibleChanges];
  }

  /**
   * Overriding once to avoid type casting everywhere.
   */
  public static override calculate(
    prevSnapshot: StoreSnapshot,
    nextSnapshot: StoreSnapshot,
  ) {
    return super.calculate(prevSnapshot, nextSnapshot) as HistoryDelta;
  }

  /**
   * Overriding once to avoid type casting everywhere.
   */
  public static override inverse(delta: StoreDelta): HistoryDelta {
    return super.inverse(delta) as HistoryDelta;
  }

  /**
   * Overriding once to avoid type casting everywhere.
   */
  public static override applyLatestChanges(
    delta: StoreDelta,
    prevElements: SceneElementsMap,
    nextElements: SceneElementsMap,
    modifierOptions?: "deleted" | "inserted",
  ) {
    return super.applyLatestChanges(
      delta,
      prevElements,
      nextElements,
      modifierOptions,
    ) as HistoryDelta;
  }

  /**
   * Reconstruct scene state after moving to target stack lengths (same total entries).
   * Does not mutate the history stacks or the store.
   */
  public static getStateAtStackLengths(
    elements: SceneElementsMap,
    appState: AppState,
    snapshot: StoreSnapshot,
    undoStack: readonly HistoryDelta[],
    redoStack: readonly HistoryDelta[],
    targetUndoLen: number,
    targetRedoLen: number,
  ): [
    SceneElementsMap,
    AppState,
    StoreSnapshot,
    HistoryDelta[],
    HistoryDelta[],
  ] {
    let nextElements = elements;
    let nextAppState = appState;
    let nextSnapshot = snapshot;

    const tempUndo = undoStack.slice();
    const tempRedo = redoStack.slice();

    while (tempUndo.length > targetUndoLen) {
      const historyDelta = tempUndo.pop();
      if (!historyDelta) {
        break;
      }
      const applied = historyDelta.applyTo(
        nextElements,
        nextAppState,
        nextSnapshot,
      );
      nextElements = applied[0];
      nextAppState = applied[1];
      nextSnapshot = nextSnapshot.maybeClone(
        CaptureUpdateAction.IMMEDIATELY,
        nextElements,
        nextAppState,
      );
      tempRedo.push(HistoryDelta.inverse(historyDelta));
    }

    while (tempUndo.length < targetUndoLen) {
      const historyDelta = tempRedo.pop();
      if (!historyDelta) {
        break;
      }
      const applied = historyDelta.applyTo(
        nextElements,
        nextAppState,
        nextSnapshot,
      );
      nextElements = applied[0];
      nextAppState = applied[1];
      nextSnapshot = nextSnapshot.maybeClone(
        CaptureUpdateAction.IMMEDIATELY,
        nextElements,
        nextAppState,
      );
      tempUndo.push(HistoryDelta.inverse(historyDelta));
    }

    return [nextElements, nextAppState, nextSnapshot, tempUndo, tempRedo];
  }
}

export class HistoryChangedEvent {
  constructor(
    public readonly isUndoStackEmpty: boolean = true,
    public readonly isRedoStackEmpty: boolean = true,
  ) {}
}

export class History {
  public readonly onHistoryChangedEmitter = new Emitter<
    [HistoryChangedEvent]
  >();

  public readonly undoStack: HistoryDelta[] = [];
  public readonly redoStack: HistoryDelta[] = [];

  public get isUndoStackEmpty() {
    return this.undoStack.length === 0;
  }

  public get isRedoStackEmpty() {
    return this.redoStack.length === 0;
  }

  constructor(private readonly store: Store) {}

  public clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }

  /**
   * Record a non-empty local durable increment, which will go into the undo stack..
   * Do not re-record history entries, which were already pushed to undo / redo stack, as part of history action.
   */
  public record(delta: StoreDelta) {
    if (delta.isEmpty() || delta instanceof HistoryDelta) {
      return;
    }

    // construct history entry, so once it's emitted, it's not recorded again
    const historyDelta = HistoryDelta.inverse(delta);

    this.undoStack.push(historyDelta);

    if (!historyDelta.elements.isEmpty()) {
      // don't reset redo stack on local appState changes,
      // as a simple click (unselect) could lead to losing all the redo entries
      // only reset on non empty elements changes!
      this.redoStack.length = 0;
    }

    this.onHistoryChangedEmitter.trigger(
      new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
    );
  }

  public undo(elements: SceneElementsMap, appState: AppState) {
    return this.perform(
      elements,
      appState,
      () => History.pop(this.undoStack),
      (entry: HistoryDelta) => History.push(this.redoStack, entry),
    );
  }

  public redo(elements: SceneElementsMap, appState: AppState) {
    return this.perform(
      elements,
      appState,
      () => History.pop(this.redoStack),
      (entry: HistoryDelta) => History.push(this.undoStack, entry),
    );
  }

  /**
   * Reconstruct elements and app state at a given undo-stack depth without mutating stacks.
   * `targetUndoLen` is clamped to `[0, undoStack.length + redoStack.length]`.
   */
  public getStateAtUndoLength(
    elements: SceneElementsMap,
    appState: AppState,
    targetUndoLen: number,
  ): [SceneElementsMap, AppState, StoreSnapshot] {
    const maxLen = this.undoStack.length + this.redoStack.length;
    const u = Math.max(0, Math.min(targetUndoLen, maxLen));
    const targetRedoLen = maxLen - u;
    const [nextElements, nextAppState, nextSnapshot] =
      HistoryDelta.getStateAtStackLengths(
        elements,
        appState,
        this.store.snapshot,
        this.undoStack,
        this.redoStack,
        u,
        targetRedoLen,
      );
    return [nextElements, nextAppState, nextSnapshot];
  }

  /**
   * Jump history to the given undo-stack length (same semantics as `getStateAtUndoLength`).
   * Mutates undo/redo stacks and syncs the store snapshot; triggers `HistoryChangedEvent` once.
   */
  public navigateToUndoLength(
    elements: SceneElementsMap,
    appState: AppState,
    targetUndoLen: number,
  ): [SceneElementsMap, AppState] | void {
    const maxLen = this.undoStack.length + this.redoStack.length;
    const u = Math.max(0, Math.min(targetUndoLen, maxLen));
    const targetRedoLen = maxLen - u;

    try {
      const [nextElements, nextAppState, nextSnapshot, finalUndo, finalRedo] =
        HistoryDelta.getStateAtStackLengths(
          elements,
          appState,
          this.store.snapshot,
          this.undoStack,
          this.redoStack,
          u,
          targetRedoLen,
        );

      if (finalUndo.length !== u || finalRedo.length !== targetRedoLen) {
        return;
      }

      this.undoStack.length = 0;
      this.redoStack.length = 0;
      this.undoStack.push(...finalUndo);
      this.redoStack.push(...finalRedo);
      this.store.snapshot = nextSnapshot;

      return [nextElements, nextAppState];
    } finally {
      this.onHistoryChangedEmitter.trigger(
        new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
      );
    }
  }

  private perform(
    elements: SceneElementsMap,
    appState: AppState,
    pop: () => HistoryDelta | null,
    push: (entry: HistoryDelta) => void,
  ): [SceneElementsMap, AppState] | void {
    try {
      let historyDelta = pop();

      if (historyDelta === null) {
        return;
      }

      const action = CaptureUpdateAction.IMMEDIATELY;

      let prevSnapshot = this.store.snapshot;

      let nextElements = elements;
      let nextAppState = appState;
      let containsVisibleChange = false;

      // iterate through the history entries in case they result in no visible changes
      while (historyDelta) {
        try {
          [nextElements, nextAppState, containsVisibleChange] =
            historyDelta.applyTo(nextElements, nextAppState, prevSnapshot);

          const prevElements = prevSnapshot.elements;
          const nextSnapshot = prevSnapshot.maybeClone(
            action,
            nextElements,
            nextAppState,
          );

          const change = StoreChange.create(prevSnapshot, nextSnapshot);
          const delta = HistoryDelta.applyLatestChanges(
            historyDelta,
            prevElements,
            nextElements,
          );

          if (!delta.isEmpty()) {
            // schedule immediate capture, so that it's emitted for the sync purposes
            this.store.scheduleMicroAction({
              action,
              change,
              delta,
            });

            historyDelta = delta;
          }

          prevSnapshot = nextSnapshot;
        } finally {
          push(historyDelta);
        }

        if (containsVisibleChange) {
          break;
        }

        historyDelta = pop();
      }

      return [nextElements, nextAppState];
    } finally {
      // trigger the history change event before returning completely
      // also trigger it just once, no need doing so on each entry
      this.onHistoryChangedEmitter.trigger(
        new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
      );
    }
  }

  private static pop(stack: HistoryDelta[]): HistoryDelta | null {
    if (!stack.length) {
      return null;
    }

    const entry = stack.pop();

    if (entry !== undefined) {
      return entry;
    }

    return null;
  }

  private static push(stack: HistoryDelta[], entry: HistoryDelta) {
    const inversedEntry = HistoryDelta.inverse(entry);
    return stack.push(inversedEntry);
  }
}
