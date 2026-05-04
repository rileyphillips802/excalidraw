import {
  BOUND_TEXT_PADDING,
  THEME,
  VERTICAL_ALIGN,
  applyDarkModeFilter,
  getFontString,
  getVerticalOffset,
} from "@excalidraw/common";

import type {
  ElementsMap,
  ExcalidrawTableElement,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "./types";

import { getLineHeightInPx } from "./textMeasurements";

import type { StaticCanvasRenderConfig } from "@excalidraw/excalidraw/scene/types";

/** Draw cell texts inside table bounds (local element coordinates). */
export const drawTableTextsOnCanvas = (
  element: ExcalidrawTableElement,
  elementsMap: ElementsMap,
  context: CanvasRenderingContext2D,
  renderConfig: StaticCanvasRenderConfig,
) => {
  const pad = BOUND_TEXT_PADDING;
  const rows = element.cellIds.length;
  if (rows === 0) {
    return;
  }
  const cols = element.cellIds[0]?.length ?? 0;
  if (cols === 0) {
    return;
  }

  let cumLeft = 0;
  for (let c = 0; c < cols; c++) {
    const cw = element.width * element.colWidths[c]!;
    let cumTop = 0;
    for (let r = 0; r < rows; r++) {
      const ch = element.height * element.rowHeights[r]!;
      const cellId = element.cellIds[r]?.[c];
      if (!cellId) {
        cumTop += ch;
        continue;
      }
      const textEl = elementsMap.get(cellId);
      if (
        !textEl ||
        textEl.type !== "text" ||
        textEl.isDeleted ||
        textEl.containerId !== element.id
      ) {
        cumTop += ch;
        continue;
      }

      const te = textEl as NonDeletedExcalidrawElement & ExcalidrawTextElement;
      context.save();
      context.beginPath();
      context.rect(cumLeft + pad, cumTop + pad, cw - pad * 2, ch - pad * 2);
      context.clip();

      context.font = getFontString(te);
      context.fillStyle =
        renderConfig.theme === THEME.DARK
          ? applyDarkModeFilter(te.strokeColor)
          : te.strokeColor;
      context.textAlign = te.textAlign as CanvasTextAlign;

      const innerW = cw - pad * 2;
      const horizontalOffset =
        te.textAlign === "center"
          ? innerW / 2
          : te.textAlign === "right"
          ? innerW
          : 0;

      const lines = te.text.replace(/\r\n?/g, "\n").split("\n");
      const lineHeightPx = getLineHeightInPx(te.fontSize, te.lineHeight);
      const verticalOffset = getVerticalOffset(
        te.fontFamily,
        te.fontSize,
        lineHeightPx,
      );

      const innerH = ch - pad * 2;
      let yStart = cumTop + pad + verticalOffset;
      if (te.verticalAlign === VERTICAL_ALIGN.MIDDLE) {
        const totalTextH =
          lines.length * lineHeightPx - (lineHeightPx - te.fontSize);
        yStart = cumTop + pad + (innerH - totalTextH) / 2 + verticalOffset;
      } else if (te.verticalAlign === VERTICAL_ALIGN.BOTTOM) {
        const totalTextH =
          lines.length * lineHeightPx - (lineHeightPx - te.fontSize);
        yStart = cumTop + pad + innerH - totalTextH + verticalOffset;
      }

      for (let index = 0; index < lines.length; index++) {
        context.fillText(
          lines[index],
          cumLeft + pad + horizontalOffset,
          yStart + index * lineHeightPx,
        );
      }

      context.restore();
      cumTop += ch;
    }
    cumLeft += cw;
  }
};
