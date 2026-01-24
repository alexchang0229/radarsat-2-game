import { Vector3, Plane, Ray } from '@babylonjs/core';

export class InputHandler {
  constructor(camera, game, scene) {
    this.camera = camera;
    this.game = game;
    this.scene = scene;
    this.spacebarHeld = false;

    // Create a plane at the target zone's Z position for raycasting
    const targetZ = this.game.getTargetZone().position.z;
    this.plane = Plane.FromPositionAndNormal(
      new Vector3(0, 0, targetZ),
      new Vector3(0, 0, 1)
    );

    // Bind event handlers
    this.setupInputListeners();
  }

  setupInputListeners() {
    // Mouse/touch move for target zone positioning
    this.scene.onPointerMove = (evt) => {
      this.updateTargetZone(evt.clientX, evt.clientY);
    };

    // Touch start/end for hold detection
    this.scene.onPointerDown = (evt) => {
      if (evt.pointerType === 'touch') {
        this.spacebarHeld = true;
        this.game.onHitStart();
      }
    };

    this.scene.onPointerUp = (evt) => {
      if (evt.pointerType === 'touch') {
        this.spacebarHeld = false;
        this.game.onHitEnd();
      }
    };

    // Keyboard for spacebar hold detection and width switching
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space' && !this.spacebarHeld) {
        event.preventDefault();
        this.spacebarHeld = true;
        this.game.onHitStart();
      }
      // A, S, D keys to switch target zone width (indices 0, 1, 2)
      if (event.code === 'KeyA') {
        this.game.setTargetWidthIndex(0);
      } else if (event.code === 'KeyS') {
        this.game.setTargetWidthIndex(1);
      } else if (event.code === 'KeyD') {
        this.game.setTargetWidthIndex(2);
      }
    });

    window.addEventListener('keyup', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        this.spacebarHeld = false;
        this.game.onHitEnd();
      }
    });
  }

  isSpacebarHeld() {
    return this.spacebarHeld;
  }

  updateTargetZone(clientX, clientY) {
    // Create a ray from the camera through the screen position
    const ray = this.scene.createPickingRay(
      clientX,
      clientY,
      null,
      this.camera
    );

    // Find intersection with the plane at target zone's Z position
    const distance = ray.intersectsPlane(this.plane);

    if (distance !== null) {
      const intersectPoint = ray.origin.add(ray.direction.scale(distance));
      // Move target zone to the X position of the intersection
      this.game.moveTargetZone(intersectPoint.x);
    }
  }
}
