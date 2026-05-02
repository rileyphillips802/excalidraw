import { Emitter, toBrandedType } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  StoreChange,
  StoreDelta,
} from "@excalidraw/element";

import type { StoreSnapshot, Store } from "@excalidraw/element";

import type { SceneElementsMap } from "@excalidraw/element/types";

import type { AppState } from "./types";

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

  /** Parallel to {@link undoStack} — epoch ms when each delta was recorded */
  public readonly undoRecordedAt: number[] = [];

  /** Parallel to {@link redoStack} — timestamps kept in sync when undo/redo moves entries */
  public readonly redoRecordedAt: number[] = [];

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
    this.undoRecordedAt.length = 0;
    this.redoRecordedAt.length = 0;
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
    this.undoRecordedAt.push(Date.now());

    if (!historyDelta.elements.isEmpty()) {
      // don't reset redo stack on local appState changes,
      // as a simple click (unselect) could lead to losing all the redo entries
      // only reset on non empty elements changes!
      this.redoStack.length = 0;
      this.redoRecordedAt.length = 0;
    }

    this.onHistoryChangedEmitter.trigger(
      new HistoryChangedEvent(this.isUndoStackEmpty, this.isRedoStackEmpty),
    );
  }

  public undo(elements: SceneElementsMap, appState: AppState) {
    return this.perform(elements, appState, "undo");
  }

  public redo(elements: SceneElementsMap, appState: AppState) {
    return this.perform(elements, appState, "redo");
  }

  /**
   * Preview canvas state after applying `steps` undos from the current stacks
   * without mutating stacks or the store (uses current {@link Store.snapshot}).
   */
  public previewAfterUndos(
    elements: SceneElementsMap,
    appState: AppState,
    steps: number,
  ): [SceneElementsMap, AppState] | null {
    if (steps <= 0) {
      return null;
    }
    const snapshot = this.store.snapshot;
    let nextElements = toBrandedType<SceneElementsMap>(new Map(elements));
    let nextAppState = appState;
    for (let i = 0; i < steps; i++) {
      const idx = this.undoStack.length - 1 - i;
      if (idx < 0) {
        return null;
      }
      const [els, st] = this.undoStack[idx].applyTo(
        nextElements,
        nextAppState,
        snapshot,
      );
      nextElements = els;
      nextAppState = st;
    }
    return [nextElements, nextAppState];
  }

  /**
   * Preview canvas state after applying `steps` redos from the current stacks.
   */
  public previewAfterRedos(
    elements: SceneElementsMap,
    appState: AppState,
    steps: number,
  ): [SceneElementsMap, AppState] | null {
    if (steps <= 0) {
      return null;
    }
    const snapshot = this.store.snapshot;
    let nextElements = toBrandedType<SceneElementsMap>(new Map(elements));
    let nextAppState = appState;
    for (let i = 0; i < steps; i++) {
      const idx = this.redoStack.length - 1 - i;
      if (idx < 0) {
        return null;
      }
      const [els, st] = this.redoStack[idx].applyTo(
        nextElements,
        nextAppState,
        snapshot,
      );
      nextElements = els;
      nextAppState = st;
    }
    return [nextElements, nextAppState];
  }

  private perform(
    elements: SceneElementsMap,
    appState: AppState,
    direction: "undo" | "redo",
  ): [SceneElementsMap, AppState] | void {
    const sourceStack = direction === "undo" ? this.undoStack : this.redoStack;
    const sourceTimes =
      direction === "undo" ? this.undoRecordedAt : this.redoRecordedAt;
    const targetStack = direction === "undo" ? this.redoStack : this.undoStack;
    const targetTimes =
      direction === "undo" ? this.redoRecordedAt : this.undoRecordedAt;

    const pop = (): { delta: HistoryDelta; recordedAt: number } | null => {
      const delta = History.pop(sourceStack);
      const recordedAt = sourceTimes.pop();
      if (!delta) {
        return null;
      }
      return { delta, recordedAt: recordedAt ?? Date.now() };
    };

    const push = (entry: HistoryDelta, recordedAt: number) => {
      History.push(targetStack, entry);
      targetTimes.push(recordedAt);
    };

    try {
      let popped = pop();
      let historyDelta = popped?.delta ?? null;
      let recordedAt = popped?.recordedAt ?? Date.now();

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
          push(historyDelta, recordedAt);
        }

        if (containsVisibleChange) {
          break;
        }

        popped = pop();
        historyDelta = popped?.delta ?? null;
        recordedAt = popped?.recordedAt ?? Date.now();
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
