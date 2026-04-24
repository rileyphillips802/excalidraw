import { EDITOR_LS_KEYS } from "@excalidraw/common";

import type { ToolType } from "./types";

export type LaserToolModePreference = Extract<
  ToolType,
  "laser" | "laserPersistent"
>;

export const readStoredLaserMode = (): LaserToolModePreference => {
  if (typeof localStorage === "undefined") {
    return "laser";
  }
  try {
    const value = localStorage.getItem(EDITOR_LS_KEYS.LAST_LASER_TOOL);
    if (value === "laserPersistent" || value === "laser") {
      return value;
    }
  } catch {
    // ignore
  }
  return "laser";
};

export const writeStoredLaserMode = (mode: LaserToolModePreference) => {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(EDITOR_LS_KEYS.LAST_LASER_TOOL, mode);
  } catch {
    // ignore
  }
};
