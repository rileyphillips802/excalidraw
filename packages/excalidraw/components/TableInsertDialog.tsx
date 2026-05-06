import React, { useCallback, useState } from "react";

import { KEYS } from "@excalidraw/common";

import { t } from "../i18n";

import { Dialog } from "./Dialog";

import "./TableInsertDialog.scss";

const MAX_DIM = 10;
const DEFAULT_ROWS = 3;
const DEFAULT_COLS = 3;

type TableInsertDialogProps = {
  onClose: () => void;
  onConfirm: (rows: number, cols: number) => void;
};

export const TableInsertDialog = ({
  onClose,
  onConfirm,
}: TableInsertDialogProps) => {
  const [hover, setHover] = useState({ row: DEFAULT_ROWS, col: DEFAULT_COLS });

  const handleConfirm = useCallback(() => {
    onConfirm(hover.row, hover.col);
    onClose();
  }, [hover.row, hover.col, onConfirm, onClose]);

  return (
    <Dialog
      title={t("table.insertTitle")}
      onCloseRequest={onClose}
      size="small"
    >
      <div className="TableInsertDialog">
        <p className="TableInsertDialog__hint">{t("table.insertHint")}</p>
        <div
          className="TableInsertDialog__grid"
          role="grid"
          aria-label={t("table.insertTitle")}
          onPointerLeave={() =>
            setHover({ row: DEFAULT_ROWS, col: DEFAULT_COLS })
          }
        >
          {Array.from({ length: MAX_DIM }, (_, ri) => (
            <div key={ri} className="TableInsertDialog__row">
              {Array.from({ length: MAX_DIM }, (_, ci) => {
                const row = ri + 1;
                const col = ci + 1;
                const active = row <= hover.row && col <= hover.col;
                return (
                  <button
                    key={ci}
                    type="button"
                    className={`TableInsertDialog__cell${
                      active ? " TableInsertDialog__cell--active" : ""
                    }`}
                    aria-label={`${row}×${col}`}
                    onPointerEnter={() => setHover({ row, col })}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      onConfirm(row, col);
                      onClose();
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
        <div className="TableInsertDialog__footer">
          <span className="TableInsertDialog__size">
            {hover.row} × {hover.col}
          </span>
          <button
            type="button"
            className="TableInsertDialog__confirm"
            onClick={handleConfirm}
          >
            {t("buttons.confirm")}
          </button>
        </div>
        <p className="TableInsertDialog__shortcut">
          {t("table.keyboardHint", { key: KEYS.T.toUpperCase() })}
        </p>
      </div>
    </Dialog>
  );
};
