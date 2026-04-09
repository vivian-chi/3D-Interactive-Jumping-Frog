import * as THREE from 'three';

const LERP_SPEED  = 5.0;
const MAX_YAW     = 1.25;
const MAX_PITCH   = 0.38;
const JUMP_DIST   = 1.8;

// Frog center must project inside this NDC range for the jump to be allowed.
// Leaves enough margin for the body to remain fully visible on all sides.
const NDC_LIMIT = 0.62;

// Camera is at z=5.2, frog starts at z=-1.5 → initial distance = 6.7
// Max 20% larger on screen → min distance = 6.7/1.2 = 5.583 → Z_MAX = 5.2−5.583 = −0.38
const Z_MAX = -0.4;  // frog never comes closer than this (≈20% size increase cap)
const Z_MIN = -5.5;  // frog can retreat this far inward

const _raycaster = new THREE.Raycaster();
const _mouse     = new THREE.Vector2();
const _hitPoint  = new THREE.Vector3();

export class CursorTrackingController {
  constructor(renderer, camera, frogModel, jumpCtrl) {
    this.renderer  = renderer;
    this.camera    = camera;
    this.frog      = frogModel;
    this._jump     = jumpCtrl;

    this._plane = new THREE.Plane(
      new THREE.Vector3(0, 0, 1),
      -(frogModel.position.z + 1),
    );

    this._targetRotX = 0;
    this._targetRotY = 0;
    this._targetRotZ = 0;

    this._cursorNdcX = 0;
    this._cursorNdcY = 0;

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onTouchMove = this._onTouchMove.bind(this);
    this._onClick     = this._onClick.bind(this);
    this._onTouchEnd  = this._onTouchEnd.bind(this);

    renderer.domElement.addEventListener('mousemove', this._onMouseMove);
    renderer.domElement.addEventListener('touchmove', this._onTouchMove, { passive: true });
    renderer.domElement.addEventListener('click',    this._onClick);
    renderer.domElement.addEventListener('touchend', this._onTouchEnd, { passive: true });
  }

  destroy() {
    this.renderer.domElement.removeEventListener('mousemove', this._onMouseMove);
    this.renderer.domElement.removeEventListener('touchmove', this._onTouchMove);
    this.renderer.domElement.removeEventListener('click',    this._onClick);
    this.renderer.domElement.removeEventListener('touchend', this._onTouchEnd);
  }

  update(dt) {
    // Cursor tracking is paused while jumping — JumpController owns rotation then
    if (this._jump && this._jump.isJumping) return;

    this._lerp('x', this._targetRotX, dt);
    this._lerp('y', this._targetRotY, dt);
    this._lerp('z', this._targetRotZ, dt);
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  _lerp(axis, target, dt) {
    let diff = target - this.frog.rotation[axis];
    while (diff >  Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.frog.rotation[axis] += diff * Math.min(1, LERP_SPEED * dt);
  }

  _track(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    _mouse.set(
      ((clientX - rect.left) / rect.width)  * 2 - 1,
      -((clientY - rect.top)  / rect.height) * 2 + 1,
    );

    // Keep plane in sync with frog's current Z (after jumps)
    this._plane.constant = -(this.frog.position.z + 1);

    _raycaster.setFromCamera(_mouse, this.camera);
    if (!_raycaster.ray.intersectPlane(this._plane, _hitPoint)) return;

    this._cursorNdcX = _mouse.x;
    this._cursorNdcY = _mouse.y;

    const dx = _hitPoint.x - this.frog.position.x;
    const dy = _hitPoint.y - this.frog.position.y;
    const dz = _hitPoint.z - this.frog.position.z;

    const yaw = Math.atan2(dx, dz);
    this._targetRotY = Math.max(-MAX_YAW, Math.min(MAX_YAW, yaw));

    const horiz = Math.sqrt(dx * dx + dz * dz);
    const pitch = -Math.atan2(dy, horiz);
    this._targetRotX = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitch));

  }

  _triggerJump() {
    if (!this._jump || this._jump.isJumping) return;

    // Cursor quadrant drives jump direction:
    //   NDC X: left(−) → jump left, right(+) → jump right
    //   NDC Y: upper(+) → jump inward (−Z, frog shows back)
    //          lower(−) → jump outward (+Z, frog faces audience)
    const rawDx = this._cursorNdcX;
    const rawDz = -this._cursorNdcY; // flip: upper half → negative Z (inward)

    const len = Math.sqrt(rawDx * rawDx + rawDz * rawDz);
    if (len < 0.05) {
      // Cursor near dead-centre — jump in place
      this._jump.jump(this.frog.position.x, this.frog.position.y, this.frog.position.z, null);
      return;
    }

    const dx = (rawDx / len) * JUMP_DIST;
    const dz = (rawDz / len) * JUMP_DIST;

    let targetX = this.frog.position.x + dx;
    // Clamp Z to hard limits — never used to block the jump itself
    let targetZ = Math.max(Z_MIN, Math.min(Z_MAX, this.frog.position.z + dz));

    // Only block when frog centre would leave the safe horizontal NDC zone
    if (this._xOutOfBounds(targetX, targetZ)) {
      targetX = this.frog.position.x;
      targetZ = this.frog.position.z;
    }

    // Lower quadrant (toward audience): land facing camera; upper: auto-face travel dir
    const endRotY = rawDz > 0 ? 0 : null;
    this._jump.jump(targetX, this.frog.position.y, targetZ, endRotY);
  }

  _xOutOfBounds(targetX, targetZ) {
    _hitPoint.set(targetX, this.frog.position.y, targetZ);
    _hitPoint.project(this.camera);
    return Math.abs(_hitPoint.x) > NDC_LIMIT;
  }

  _onMouseMove(e) {
    if (this._jump && this._jump.isJumping) return;
    this._track(e.clientX, e.clientY);
  }

  _onClick(e) { this._triggerJump(); }

  _onTouchMove(e) {
    if (this._jump && this._jump.isJumping) return;
    if (!e.touches.length) return;
    this._track(e.touches[0].clientX, e.touches[0].clientY);
  }

  _onTouchEnd(e) {
    if (!e.changedTouches.length) return;
    this._triggerJump();
  }
}
