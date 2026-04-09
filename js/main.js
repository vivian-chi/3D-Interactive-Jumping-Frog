import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CursorTrackingController } from './interaction.js';
import { JumpController }           from './jump.js';
import { easeInOutSine }            from './utils.js';

// ─── Renderer ─────────────────────────────────────────────────────────────────
const canvas   = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

// ─── Scene ────────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xD5E8C0);

// ─── Camera ───────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 2.3, 5.2);
camera.lookAt(0, 2.3, 0);

// ─── Lights ───────────────────────────────────────────────────────────────────
const hemi = new THREE.HemisphereLight(0xF0FAE8, 0x9ABA80, 2.2);
scene.add(hemi);

// Main key — casts the real shadow
const dir = new THREE.DirectionalLight(0xFFFAF0, 0.7);
dir.position.set(3, 5, 4);
dir.castShadow = true;
dir.shadow.mapSize.setScalar(1024);
dir.shadow.camera.near   = 1;
dir.shadow.camera.far    = 25;
dir.shadow.camera.left   = -3;
dir.shadow.camera.right  =  3;
dir.shadow.camera.top    =  3;
dir.shadow.camera.bottom = -3;
dir.shadow.radius = 36;
dir.shadow.bias   = -0.001;
scene.add(dir);

// Fill lights (no shadows — just even out the frog's look from all angles)
const fill = new THREE.DirectionalLight(0xFFEEDD, 0.4);
fill.position.set(0, 3, 5);
scene.add(fill);

const fillLeft = new THREE.DirectionalLight(0xEEF5E0, 0.45);
fillLeft.position.set(-4, 3, 2);
scene.add(fillLeft);

const fillBack = new THREE.DirectionalLight(0xDDEED0, 0.3);
fillBack.position.set(0, 4, -4);
scene.add(fillBack);

// ─── Shadow plane ─────────────────────────────────────────────────────────────
// Receives real cast shadows. Stencil test ensures it NEVER draws over the frog:
// frog meshes write stencilRef=1; this plane only passes where stencil≠1.
const shadowMat = new THREE.ShadowMaterial({
  opacity:         0.08,
  transparent:     true,
  depthWrite:      false,
  // stencilWrite must be true to make Three.js enable the stencil test;
  // stencilWriteMask=0 means we read stencil but never write it here.
  stencilWrite:    true,
  stencilWriteMask: 0x00,
  stencilFunc:     THREE.NotEqualStencilFunc,
  stencilRef:      1,
  stencilFuncMask: 0xff,
  stencilZPass:    THREE.KeepStencilOp,
});
const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), shadowMat);
shadowPlane.rotation.x    = -Math.PI / 2;
shadowPlane.receiveShadow = true;
scene.add(shadowPlane);

// ─── Breathing ────────────────────────────────────────────────────────────────
const BREATH_PERIOD = 2.0;
let   breathT       = 0;

function updateBreathing(dt, frogModel) {
  breathT = (breathT + dt / BREATH_PERIOD) % 1;
  const breathOffset = easeInOutSine(breathT) * 0.03;
  frogModel.scale.y = 1.0 + breathOffset;
  frogModel.scale.x = 1.0 - breathOffset * 0.5;
  frogModel.scale.z = 1.0 - breathOffset * 0.5;
}

// ─── Model loading ────────────────────────────────────────────────────────────
const loader = new GLTFLoader();

loader.load(
  'assets/Happy_Green_Frog.glb',
  (gltf) => {
    const frogModel = gltf.scene;

    // Auto-scale: bounding-box height → 2.0 world units
    const box  = new THREE.Box3().setFromObject(frogModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    frogModel.scale.setScalar(2.0 / size.y);

    // Center at origin, sit on ground plane
    box.setFromObject(frogModel);
    const center = new THREE.Vector3();
    box.getCenter(center);
    frogModel.position.sub(center);
    frogModel.position.y = 2.3;
    frogModel.position.z = -1.5;

    // Cast shadows, never receive them, and write stencil=1 wherever the frog
    // renders — the shadow plane reads this and skips those pixels entirely.
    frogModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = false;
        child.material.stencilWrite    = true;
        child.material.stencilWriteMask = 0xff;
        child.material.stencilFunc     = THREE.AlwaysStencilFunc;
        child.material.stencilRef      = 1;
        child.material.stencilZPass    = THREE.ReplaceStencilOp;
      }
    });

    scene.add(frogModel);

    // Shadow plane sits at foot level — stencil masking prevents it ever
    // rendering over the frog regardless of tilt angle.
    const feetY = frogModel.position.y - 0.7;
    shadowPlane.position.set(frogModel.position.x, feetY, frogModel.position.z);

    // Hide loading overlay
    document.getElementById('loading').style.display = 'none';

    // ── Wire up subsystems ───────────────────────────────────────────────────
    const jumpCtrl  = new JumpController(frogModel);
    const trackCtrl = new CursorTrackingController(renderer, camera, frogModel, jumpCtrl);

    // Home position (where the frog started)
    const HOME_X = frogModel.position.x;
    const HOME_Y = frogModel.position.y;
    const HOME_Z = frogModel.position.z;

    // ── Idle system ──────────────────────────────────────────────────────────
    const IDLE_TIMEOUT = 30; // seconds
    let   idleTimer    = 0;
    // 'watching' → normal; 'going-home' → mid jump to origin; 'celebrate' → in-place jump
    let   idleState    = 'watching';

    function resetIdle() { idleTimer = 0; }

    ['mousemove', 'mousedown', 'touchstart', 'keydown'].forEach(evt =>
      window.addEventListener(evt, resetIdle, { passive: true }),
    );

    jumpCtrl.onLand(() => {
      // Sync cursor tracking so rotation doesn't snap on resume
      trackCtrl._targetRotX = frogModel.rotation.x;
      trackCtrl._targetRotY = frogModel.rotation.y;
      trackCtrl._targetRotZ = frogModel.rotation.z;

      if (idleState === 'going-home') {
        // Arrived home — do one celebratory in-place jump
        idleState = 'celebrate';
        jumpCtrl.jump(HOME_X, HOME_Y, HOME_Z, 0);
      } else if (idleState === 'celebrate') {
        // Done — resume normal watching
        idleState = 'watching';
        resetIdle();
      }
    });

    // ── Render loop ──────────────────────────────────────────────────────────
    let lastTime = performance.now();

    (function animate() {
      requestAnimationFrame(animate);

      const now = performance.now();
      const dt  = Math.min((now - lastTime) / 1000, 0.1);
      lastTime  = now;

      jumpCtrl.update(dt);
      trackCtrl.update(dt);
      updateBreathing(dt, frogModel);

      // Idle timer — trigger home journey after 30s of inactivity
      if (idleState === 'watching' && !jumpCtrl.isJumping) {
        idleTimer += dt;
        if (idleTimer >= IDLE_TIMEOUT) {
          idleState = 'going-home';
          jumpCtrl.jump(HOME_X, HOME_Y, HOME_Z, 0); // face camera on arrival
        }
      }

      // Shadow plane tracks frog's ground position
      shadowPlane.position.x = frogModel.position.x;
      shadowPlane.position.z = frogModel.position.z;

      renderer.render(scene, camera);
    })();
  },
  (xhr) => {
    const bar = document.getElementById('loading-bar-fill');
    if (bar && xhr.total > 0) bar.style.width = (xhr.loaded / xhr.total * 100) + '%';
  },
  (err) => {
    console.error('GLTFLoader error:', err);
    document.getElementById('loading').innerHTML =
      '<p style="color:#c00;font-family:sans-serif">Failed to load model.</p>';
  },
);

// ─── Resize ───────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
