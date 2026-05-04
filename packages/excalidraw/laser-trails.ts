import { DEFAULT_LASER_COLOR, easeOut } from "@excalidraw/common";

import type { LaserPointerOptions } from "@excalidraw/laser-pointer";

import { AnimatedTrail } from "./animated-trail";
import { getClientColor } from "./clients";

import type { Trail } from "./animated-trail";
import type { AnimationFrameHandler } from "./animation-frame-handler";
import type App from "./components/App";
import type { AppState, SocketId } from "./types";

export class LaserTrails implements Trail {
  public localTrail: AnimatedTrail;
  private collabTrails = new Map<SocketId, AnimatedTrail>();

  private container?: SVGSVGElement;
  private localTrailLaserMode: AppState["laserPointerMode"] | null = null;

  constructor(
    private animationFrameHandler: AnimationFrameHandler,
    private app: App,
  ) {
    this.animationFrameHandler.register(this, this.onFrame.bind(this));

    this.localTrail = new AnimatedTrail(this.animationFrameHandler, app, {
      ...this.getLocalTrailOptions(),
      fill: () => DEFAULT_LASER_COLOR,
    });
    this.localTrailLaserMode = app.state.laserPointerMode;
  }

  private getFadingSizeMapping(): NonNullable<
    Partial<LaserPointerOptions>["sizeMapping"]
  > {
    return (c) => {
      const DECAY_TIME = 1000;
      const DECAY_LENGTH = 50;
      const t = Math.max(
        0,
        1 - (performance.now() - c.pressure) / DECAY_TIME,
      );
      const l =
        (DECAY_LENGTH -
          Math.min(DECAY_LENGTH, c.totalLength - c.currentIndex)) /
        DECAY_LENGTH;

      return Math.min(easeOut(l), easeOut(t));
    };
  }

  private getLocalTrailOptions(): Partial<LaserPointerOptions> {
    if (this.app.state.laserPointerMode === "persistent") {
      return {
        simplify: 0,
        streamline: 0.4,
        sizeMapping: () => 1,
      };
    }
    return {
      simplify: 0,
      streamline: 0.4,
      sizeMapping: this.getFadingSizeMapping(),
    };
  }

  /** Recreate local trail when fading vs persistent options change. */
  syncLocalTrailOptions() {
    const mode = this.app.state.laserPointerMode;
    if (this.localTrailLaserMode === mode) {
      return;
    }
    this.localTrail.stop();
    this.localTrail = new AnimatedTrail(this.animationFrameHandler, this.app, {
      ...this.getLocalTrailOptions(),
      fill: () => DEFAULT_LASER_COLOR,
    });
    this.localTrailLaserMode = mode;
    if (this.container) {
      this.localTrail.start(this.container);
    }
  }

  startPath(x: number, y: number): void {
    this.syncLocalTrailOptions();
    this.localTrail.startPath(x, y);
  }

  addPointToPath(x: number, y: number): void {
    this.localTrail.addPointToPath(x, y);
  }

  endPath(): void {
    this.localTrail.endPath({
      preserveFullStroke: this.app.state.laserPointerMode === "persistent",
    });
  }

  clearPersistentLocalTrails(): void {
    this.localTrail.clearTrails();
  }

  start(container: SVGSVGElement) {
    this.container = container;

    this.animationFrameHandler.start(this);
    this.localTrail.start(container);
  }

  stop() {
    this.animationFrameHandler.stop(this);
    this.localTrail.stop();
  }

  onFrame() {
    this.updateCollabTrails();
  }

  private updateCollabTrails() {
    if (!this.container || this.app.state.collaborators.size === 0) {
      return;
    }

    const collabOptions = {
      simplify: 0,
      streamline: 0.4,
      sizeMapping: this.getFadingSizeMapping(),
    } as Partial<LaserPointerOptions>;

    for (const [key, collaborator] of this.app.state.collaborators.entries()) {
      let trail!: AnimatedTrail;

      if (!this.collabTrails.has(key)) {
        trail = new AnimatedTrail(this.animationFrameHandler, this.app, {
          ...collabOptions,
          fill: () =>
            collaborator.pointer?.laserColor ||
            getClientColor(key, collaborator),
        });
        trail.start(this.container);

        this.collabTrails.set(key, trail);
      } else {
        trail = this.collabTrails.get(key)!;
      }

      if (collaborator.pointer && collaborator.pointer.tool === "laser") {
        if (collaborator.button === "down" && !trail.hasCurrentTrail) {
          trail.startPath(collaborator.pointer.x, collaborator.pointer.y);
        }

        if (
          collaborator.button === "down" &&
          trail.hasCurrentTrail &&
          !trail.hasLastPoint(collaborator.pointer.x, collaborator.pointer.y)
        ) {
          trail.addPointToPath(collaborator.pointer.x, collaborator.pointer.y);
        }

        if (collaborator.button === "up" && trail.hasCurrentTrail) {
          trail.addPointToPath(collaborator.pointer.x, collaborator.pointer.y);
          trail.endPath();
        }
      }
    }

    for (const key of this.collabTrails.keys()) {
      if (!this.app.state.collaborators.has(key)) {
        const trail = this.collabTrails.get(key)!;
        trail.stop();
        this.collabTrails.delete(key);
      }
    }
  }
}
