import { isElementInViewport } from "@excalidraw/element";

import { memoize, toBrandedType } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  NonDeletedElementsMap,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { Scene } from "@excalidraw/element";

import { renderStaticSceneThrottled } from "../renderer/staticScene";

import type { RenderableElementsMap } from "./types";

import type { AppState } from "../types";

type RenderableParams = {
  zoom: AppState["zoom"];
  offsetLeft: AppState["offsetLeft"];
  offsetTop: AppState["offsetTop"];
  scrollX: AppState["scrollX"];
  scrollY: AppState["scrollY"];
  height: AppState["height"];
  width: AppState["width"];
  editingTextElement: AppState["editingTextElement"];
  newElementId: ExcalidrawElement["id"] | undefined;
};

const getVisibleCanvasElements = ({
  elementsMap,
  zoom,
  offsetLeft,
  offsetTop,
  scrollX,
  scrollY,
  height,
  width,
}: {
  elementsMap: NonDeletedElementsMap;
  zoom: AppState["zoom"];
  offsetLeft: AppState["offsetLeft"];
  offsetTop: AppState["offsetTop"];
  scrollX: AppState["scrollX"];
  scrollY: AppState["scrollY"];
  height: AppState["height"];
  width: AppState["width"];
}): readonly NonDeletedExcalidrawElement[] => {
  const visibleElements: NonDeletedExcalidrawElement[] = [];
  for (const element of elementsMap.values()) {
    if (
      isElementInViewport(
        element,
        width,
        height,
        {
          zoom,
          offsetLeft,
          offsetTop,
          scrollX,
          scrollY,
        },
        elementsMap,
      )
    ) {
      visibleElements.push(element);
    }
  }
  return visibleElements;
};

const buildRenderableElementsMap = ({
  elements,
  editingTextElement,
  newElementId,
}: {
  elements: readonly NonDeletedExcalidrawElement[];
  editingTextElement: AppState["editingTextElement"];
  newElementId: ExcalidrawElement["id"] | undefined;
}) => {
  const elementsMap = toBrandedType<RenderableElementsMap>(new Map());

  for (const element of elements) {
    if (newElementId === element.id) {
      continue;
    }

    // we don't want to render text element that's being currently edited
    // (it's rendered on remote only)
    if (
      !editingTextElement ||
      editingTextElement.type !== "text" ||
      element.id !== editingTextElement.id
    ) {
      elementsMap.set(element.id, element);
    }
  }
  return elementsMap;
};

export const computeRenderableElements = (
  elements: readonly NonDeletedExcalidrawElement[],
  params: RenderableParams,
): {
  elementsMap: RenderableElementsMap;
  visibleElements: readonly NonDeletedExcalidrawElement[];
} => {
  const elementsMap = buildRenderableElementsMap({
    elements,
    editingTextElement: params.editingTextElement,
    newElementId: params.newElementId,
  });

  const visibleElements = getVisibleCanvasElements({
    elementsMap,
    zoom: params.zoom,
    offsetLeft: params.offsetLeft,
    offsetTop: params.offsetTop,
    scrollX: params.scrollX,
    scrollY: params.scrollY,
    height: params.height,
    width: params.width,
  });

  return { elementsMap, visibleElements };
};

export class Renderer {
  private scene: Scene;

  constructor(scene: Scene) {
    this.scene = scene;
  }

  public getRenderableElements = (() => {
    return memoize(
      ({
        zoom,
        offsetLeft,
        offsetTop,
        scrollX,
        scrollY,
        height,
        width,
        editingTextElement,
        newElementId,
        // cache-invalidation nonce
        sceneNonce: _sceneNonce,
      }: RenderableParams & {
        sceneNonce: ReturnType<InstanceType<typeof Scene>["getSceneNonce"]>;
      },
    ) => {
      const elements = this.scene.getNonDeletedElements();

      return computeRenderableElements(elements, {
        zoom,
        offsetLeft,
        offsetTop,
        scrollX,
        scrollY,
        height,
        width,
        editingTextElement,
        newElementId,
      });
    });
  })();

  /**
   * Same layout logic as the memoized path, but using an explicit element list
   * (e.g. undo history hover preview) instead of the live scene.
   */
  public getRenderableElementsFromList(
    elements: readonly NonDeletedExcalidrawElement[],
    params: RenderableParams,
  ) {
    return computeRenderableElements(elements, params);
  }

  // NOTE Doesn't destroy everything (scene, rc, etc.) because it may not be
  // safe to break TS contract here (for upstream cases)
  public destroy() {
    renderStaticSceneThrottled.cancel();
    this.getRenderableElements.clear();
  }
}
