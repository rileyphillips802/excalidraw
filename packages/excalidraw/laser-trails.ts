import { DEFAULT_LASER_COLOR, easeOut } from "@excalidraw/common";

import type { LaserPointerOptions } from "@excalidraw/laser-pointer";

import { AnimatedTrail } from "./animated-trail";
import { getClientColor } from "./clients";

import type { Trail } from "./animated-trail";
import type { AnimationFrameHandler } from "./animation-frame-handler";
import type App from "./components/App";
import type { SocketId } from "./types";

export class LaserTrails implements Trail {
  public localFadingTrail: AnimatedTrail;
  public localPersistentTrail: AnimatedTrail;
  private collabTrails = new Map<SocketId, AnimatedTrail>();

  private container?: SVGSVGElement;
  private localGestureTarget: "fading" | "persistent" | null = null;

  constructor(
    private animationFrameHandler: AnimationFrameHandler,
    private app: App,
  ) {
    this.animationFrameHandler.register(this, this.onFrame.bind(this));

    this.localFadingTrail = new AnimatedTrail(animationFrameHandler, app, {
      ...this.getFadingTrailOptions(),
      fill: () => DEFAULT_LASER_COLOR,
    });
    this.localPersistentTrail = new AnimatedTrail(animationFrameHandler, app, {
      ...this.getPersistentTrailOptions(),
      fill: () => DEFAULT_LASER_COLOR,
    });
  }

  private getFadingTrailOptions() {
    return {
      simplify: 0,
      streamline: 0.4,
      sizeMapping: (c) => {
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
      },
    } as Partial<LaserPointerOptions>;
  }

  private getPersistentTrailOptions() {
    return {
      simplify: 0,
      streamline: 0.4,
      sizeMapping: () => 1,
    } as Partial<LaserPointerOptions>;
  }

  startPath(x: number, y: number): void {
    const toolType = this.app.state.activeTool.type;
    if (toolType === "laser") {
      this.localGestureTarget = "fading";
      this.localFadingTrail.startPath(x, y);
    } else if (toolType === "laserPersistent") {
      this.localGestureTarget = "persistent";
      this.localPersistentTrail.startPath(x, y);
    }
  }

  addPointToPath(x: number, y: number): void {
    if (this.localGestureTarget === "fading") {
      this.localFadingTrail.addPointToPath(x, y);
    } else if (this.localGestureTarget === "persistent") {
      this.localPersistentTrail.addPointToPath(x, y);
    }
  }

  endPath(): void {
    if (this.localGestureTarget === "fading") {
      this.localFadingTrail.endPath();
    } else if (this.localGestureTarget === "persistent") {
      this.localPersistentTrail.endPath();
    }
    this.localGestureTarget = null;
  }

  clearPersistentTrails(): void {
    this.localPersistentTrail.clearTrails();
    this.localGestureTarget = null;
  }

  start(container: SVGSVGElement) {
    this.container = container;

    this.animationFrameHandler.start(this);
    this.localFadingTrail.start(container);
    this.localPersistentTrail.start(container);
  }

  stop() {
    this.animationFrameHandler.stop(this);
    this.localFadingTrail.stop();
    this.localPersistentTrail.stop();
  }

  onFrame() {
    this.updateCollabTrails();
  }

  private updateCollabTrails() {
    if (!this.container || this.app.state.collaborators.size === 0) {
      return;
    }

    for (const [key, collaborator] of this.app.state.collaborators.entries()) {
      let trail!: AnimatedTrail;

      if (!this.collabTrails.has(key)) {
        trail = new AnimatedTrail(this.animationFrameHandler, this.app, {
          ...this.getFadingTrailOptions(),
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
