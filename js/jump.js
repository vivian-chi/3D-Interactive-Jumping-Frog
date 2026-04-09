import { easeOutSine, easeInSine, easeOutBack, lerp, clamp, lerpAngle } from './utils.js';

const ANTICIPATION = 'anticipation';
const ASCENT       = 'ascent';
const DESCENT      = 'descent';
const LANDING      = 'landing';
const SPRING       = 'spring';

const DUR = {
  [ANTICIPATION]: 0.10,
  [ASCENT]:       0.25,
  [DESCENT]:      0.25,
  [LANDING]:      0.15,
  [SPRING]:       0.20,
};

const JUMP_HEIGHT = 0.7;
const FWD_TILT    = -Math.PI / 12;
const BWD_TILT    =  Math.PI / 18;

export class JumpController {
  constructor(frogModel) {
    this.frog = frogModel;

    this.isJumping = false;
    this._phase    = null;
    this._phaseT   = 0;

    this._fromX = 0;
    this._fromY = 0;
    this._fromZ = 0;
    this._toX   = 0;
    this._toY   = 0;
    this._toZ   = 0;

    this._startRotY = 0;
    this._startRotZ = 0;
    this._endRotY   = 0;

    this._onLandCallbacks = [];
  }

  onLand(fn) {
    this._onLandCallbacks.push(fn);
  }

  /**
   * @param {number} endRotY  Target rotation.y at landing.
   *                          Pass null to auto-face the travel direction.
   */
  jump(targetX, targetY, targetZ, endRotY = null) {
    if (this.isJumping) return;

    this._fromX = this.frog.position.x;
    this._fromY = this.frog.position.y;
    this._fromZ = this.frog.position.z;
    this._toX   = targetX;
    this._toY   = (targetY !== undefined) ? targetY : this._fromY;
    this._toZ   = targetZ;

    this._startRotY = this.frog.rotation.y;
    this._startRotZ = this.frog.rotation.z;

    if (endRotY !== null) {
      this._endRotY = endRotY;
    } else {
      const dx = targetX - this._fromX;
      const dz = targetZ - this._fromZ;
      this._endRotY = (Math.abs(dx) > 0.001 || Math.abs(dz) > 0.001)
        ? Math.atan2(dx, dz)
        : this._startRotY;
    }

    this.isJumping = true;
    this._phase    = ANTICIPATION;
    this._phaseT   = 0;
  }

  update(dt) {
    if (!this.isJumping) return;

    this._phaseT += dt;
    const dur = DUR[this._phase];
    const t   = clamp(this._phaseT / dur, 0, 1);

    this._applyPhase(t);

    if (this._phaseT >= dur) {
      this._phaseT -= dur;
      this._nextPhase();
    }
  }

  _applyPhase(t) {
    const peakY = Math.max(this._fromY, this._toY) + JUMP_HEIGHT;

    switch (this._phase) {
      case ANTICIPATION: {
        const e = easeInSine(t);
        this.frog.scale.y    = lerp(1.0, 0.85, e);
        this.frog.scale.x    = lerp(1.0, 1.10, e);
        this.frog.scale.z    = lerp(1.0, 1.10, e);
        this.frog.position.y = this._fromY;
        break;
      }

      case ASCENT: {
        const e = easeOutSine(t);
        this.frog.scale.y    = lerp(0.85, 1.0, e);
        this.frog.scale.x    = lerp(1.10, 1.0, e);
        this.frog.scale.z    = lerp(1.10, 1.0, e);
        this.frog.position.y = lerp(this._fromY, peakY, easeOutSine(t));
        this.frog.rotation.x = lerp(0, FWD_TILT, e);
        this.frog.rotation.z = lerp(this._startRotZ, 0, e);
        this.frog.position.x = lerp(this._fromX, this._toX, t * 0.5);
        this.frog.position.z = lerp(this._fromZ, this._toZ, t * 0.5);
        this.frog.rotation.y = lerpAngle(this._startRotY, this._endRotY, t * 0.5);
        break;
      }

      case DESCENT: {
        this.frog.position.y = lerp(peakY, this._toY, easeInSine(t));
        const et = easeOutSine(t);
        this.frog.rotation.x = lerp(FWD_TILT, BWD_TILT, et);
        this.frog.rotation.z = 0;
        this.frog.position.x = lerp(this._fromX, this._toX, 0.5 + t * 0.5);
        this.frog.position.z = lerp(this._fromZ, this._toZ, 0.5 + t * 0.5);
        this.frog.rotation.y = lerpAngle(this._startRotY, this._endRotY, 0.5 + t * 0.5);
        break;
      }

      case LANDING: {
        const e = easeInSine(t);
        this.frog.scale.y    = lerp(1.0, 0.80, e);
        this.frog.scale.x    = lerp(1.0, 1.15, e);
        this.frog.scale.z    = lerp(1.0, 1.15, e);
        this.frog.rotation.x = lerp(BWD_TILT, 0, e);
        this.frog.rotation.z = 0;
        this.frog.position.y = this._toY;
        this.frog.rotation.y = this._endRotY;
        break;
      }

      case SPRING: {
        const e = easeOutBack(t);
        this.frog.scale.y    = lerp(0.80, 1.0, e);
        this.frog.scale.x    = lerp(1.15, 1.0, e);
        this.frog.scale.z    = lerp(1.15, 1.0, e);
        this.frog.rotation.z = 0;
        break;
      }
    }
  }

  _nextPhase() {
    switch (this._phase) {
      case ANTICIPATION: this._phase = ASCENT;  break;
      case ASCENT:       this._phase = DESCENT; break;

      case DESCENT:
        this.frog.position.set(this._toX, this._toY, this._toZ);
        this.frog.rotation.x = BWD_TILT;
        this.frog.rotation.y = this._endRotY;
        this._phase = LANDING;
        break;

      case LANDING: this._phase = SPRING; break;
      case SPRING:  this._finish();       break;
    }
  }

  _finish() {
    this.isJumping = false;
    this._phase    = null;
    this.frog.scale.set(1, 1, 1);
    this.frog.rotation.x = 0;
    this.frog.rotation.y = this._endRotY;
    this.frog.rotation.z = 0;
    this.frog.position.y = this._toY;
    this._onLandCallbacks.forEach(fn => fn());
  }
}
