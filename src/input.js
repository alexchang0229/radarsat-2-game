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

    // Bind event handlers
    this.setupInputListeners();
  }

  setupInputListeners() {
    this.scene.onPointerMove = (evt) => this.updateTargetZone(evt.clientX, evt.clientY);

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

  updateTargetZone(clientX, clientY) {
    const ray = this.scene.createPickingRay(clientX, clientY, null, this.camera);
    const distance = ray.intersectsPlane(this.plane);
    if (distance !== null) {
      this.game.moveTargetZone(ray.origin.add(ray.direction.scale(distance)).x);
    }
  }
}
