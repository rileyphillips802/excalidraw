import { EDITOR_LS_KEYS } from "@excalidraw/common";

export type LaserPointerModePreference = "fading" | "persistent";

export const readLaserPointerModePreference =
  (): LaserPointerModePreference => {
    if (typeof localStorage === "undefined") {
      return "fading";
    }
    try {
      const raw = localStorage.getItem(EDITOR_LS_KEYS.LASER_POINTER_MODE);
      return raw === "persistent" ? "persistent" : "fading";
    } catch {
      return "fading";
    }
  };

export const writeLaserPointerModePreference = (
  mode: LaserPointerModePreference,
) => {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.setItem(EDITOR_LS_KEYS.LASER_POINTER_MODE, mode);
  } catch {
    // ignore quota / private mode
  }
};
