import { Vector3, Plane } from '@babylonjs/core';

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

    // Mouse position caching for throttled updates
    this.pendingMouseX = 0;
    this.pendingMouseY = 0;
    this.mouseDirty = false;

    // Pre-allocate reusable Vector3 for raycast result
    this._rayResult = new Vector3();

    // Bind event handlers
    this.setupInputListeners();
  }

  setupInputListeners() {
    // Cache mouse position instead of raycasting on every move event
    this.scene.onPointerMove = (evt) => {
      this.pendingMouseX = evt.clientX;
      this.pendingMouseY = evt.clientY;
      this.mouseDirty = true;
    };

    this.scene.onPointerDown = () => {
      this.spacebarHeld = true;
      this.game.onHitStart();
    };

    this.scene.onPointerUp = () => {
      this.spacebarHeld = false;
      this.game.onHitEnd();
    };

    window.addEventListener('keydown', (event) => {
      if (event.code === 'Space' && !this.spacebarHeld) {
        event.preventDefault();
        this.spacebarHeld = true;
        this.game.onHitStart();
      }
      const widthKeys = { KeyA: 0, KeyS: 1, KeyD: 2 };
      if (event.code in widthKeys) this.game.setTargetWidthIndex(widthKeys[event.code]);
    });

    window.addEventListener('keyup', (event) => {
      if (event.code === 'Space') {
        event.preventDefault();
        this.spacebarHeld = false;
        this.game.onHitEnd();
      }
    });
  }

  // Call this once per frame from the game loop
  update() {
    if (!this.mouseDirty) return;
    this.mouseDirty = false;

    const ray = this.scene.createPickingRay(this.pendingMouseX, this.pendingMouseY, null, this.camera);
    const distance = ray.intersectsPlane(this.plane);
    if (distance !== null) {
      // Reuse Vector3 instead of creating new ones
      ray.direction.scaleToRef(distance, this._rayResult);
      this._rayResult.addInPlace(ray.origin);
      this.game.moveTargetZone(this._rayResult.x);
    }
  }
}
