// 3D ID card on an elastic lanyard: three.js for rendering, a small verlet simulation for the strap and the swing.
// The canvas covers the whole hero but ignores the pointer, so text and buttons stay clickable; only a press that
// lands on the card starts a drag (mouse, pen or finger). A click/tap without dragging flips the card, and the
// strap twists round with it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const canvas = document.querySelector('.lanyard');
const hero = document.querySelector('.hero');
const badge = document.querySelector('.hero__badge');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const SHORT_LANDSCAPE = '(max-width: 980px) and (orientation: landscape) and (max-height: 560px)';

// Artwork size (2D canvas → texture) and palette: cream paper, navy ink, blue accent.
const W = 1024, H = 1443;
const CREAM = '#ece4cf', INK = '#141d38', BLUE = '#2f6bff', SKY = '#8fb2ff';

function start() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(2, 3, 6);
  scene.add(key);
  const rim = new THREE.PointLight(0x3b6dff, 9, 18, 1.6);
  rim.position.set(-3, 0.5, -1.5);
  scene.add(rim);

  // ── Sizes (world units) ──
  const CARD_W = 1.62, CARD_H = 2.3, CARD_D = 0.03, BEVEL = 0.008, CORNER = 0.11;
  const RIM = 0.04, RIM_TOP = 0.1; // black frame around the printed face (wider at the top, where the slot is)
  const CLIP = 0.26; // end of the strap → top edge of the card
  // The slot sits just below the black top band: SLOT_TOP below the start of the printed face.
  const SLOT_W = 0.36, SLOT_H = 0.075, SLOT_TOP = 0.018;
  const SEGMENTS = 16, STRAP_W = 0.22, SAMPLES = 80;

  // ── Card: a black rounded body with the printed faces set into it ──
  const card = new THREE.Group();
  scene.add(card);
  const outline = new THREE.Shape();
  {
    const x = -CARD_W / 2, y = -CARD_H / 2, r = CORNER;
    outline.moveTo(x + r, y);
    outline.lineTo(x + CARD_W - r, y);
    outline.absarc(x + CARD_W - r, y + r, r, -Math.PI / 2, 0, false);
    outline.lineTo(x + CARD_W, y + CARD_H - r);
    outline.absarc(x + CARD_W - r, y + CARD_H - r, r, 0, Math.PI / 2, false);
    outline.lineTo(x + r, y + CARD_H);
    outline.absarc(x + r, y + CARD_H - r, r, Math.PI / 2, Math.PI, false);
    outline.lineTo(x, y + r);
    outline.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    // The slot: a real hole through the card, so the ring can pass through it and the background shows through.
    const hy = CARD_H / 2 - RIM_TOP - SLOT_TOP - SLOT_H / 2, hw = SLOT_W / 2 - SLOT_H / 2, hr = SLOT_H / 2;
    const hole = new THREE.Path();
    hole.moveTo(-hw, hy - hr);
    hole.absarc(-hw, hy, hr, -Math.PI / 2, Math.PI / 2, true);
    hole.lineTo(hw, hy + hr);
    hole.absarc(hw, hy, hr, Math.PI / 2, -Math.PI / 2, true);
    hole.lineTo(-hw, hy - hr);
    outline.holes.push(hole);
  }
  const bodyGeo = new THREE.ExtrudeGeometry(outline, { depth: CARD_D, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 3, curveSegments: 14 });
  bodyGeo.translate(0, 0, -CARD_D / 2);
  const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: 0x0b0c11, roughness: 0.32, metalness: 0.2, envMapIntensity: 0.7 }));
  const cardY = -CLIP - CARD_H / 2;
  body.position.y = cardY;
  card.add(body);

  const faceGeo = new THREE.PlaneGeometry(CARD_W - RIM * 2, CARD_H - RIM_TOP - RIM);
  const faceY = cardY + (RIM - RIM_TOP) / 2, faceZ = CARD_D / 2 + BEVEL + 0.002;
  const front = makeFace(faceGeo, drawFront);
  front.mesh.position.set(0, faceY, faceZ);
  const back = makeFace(faceGeo, drawBack);
  back.mesh.position.set(0, faceY, -faceZ);
  back.mesh.rotation.y = Math.PI;
  card.add(front.mesh, back.mesh);

  // Hardware, top to bottom: a gunmetal clamp crimped on the end of the strap, then a split ring that hangs from
  // it and passes through the slot at the top of the card.
  // Satin-chrome clamp as wide as the strap, then two linked rings: a small one hanging from the clamp and a
  // bigger one through it and through the slot in the card (turned about 90° to each other, like a real chain).
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9ccd4, metalness: 0.92, roughness: 0.3, envMapIntensity: 1.1 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xeef0f5, metalness: 1, roughness: 0.14, envMapIntensity: 1.2 });
  const clamp = new THREE.Group();
  const clampBody = new THREE.Mesh(new RoundedBoxGeometry(STRAP_W * 1.12, 0.15, 0.07, 4, 0.03), steel);
  const clampFace = new THREE.Mesh(new RoundedBoxGeometry(STRAP_W * 0.86, 0.1, 0.075, 3, 0.02), new THREE.MeshStandardMaterial({ color: 0x8e929c, metalness: 0.9, roughness: 0.42 }));
  clamp.add(clampBody, clampFace);
  clamp.position.y = -0.075;
  const linkRing = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.012, 12, 32), chrome);
  linkRing.position.y = -0.2;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.015, 14, 44), chrome);
  // Its lowest point lands in the middle of the slot.
  ring.position.y = -CLIP - RIM_TOP - SLOT_TOP - SLOT_H / 2 + 0.095;
  ring.rotation.y = 0.8; // nearly edge-on, so it threads through the slot instead of lying flat on the card
  card.add(clamp, linkRing, ring);

  // ── Strap: a flat ribbon rebuilt along the rope every frame; it can twist around its own length ──
  const strapGeo = new THREE.BufferGeometry();
  const strapPos = new Float32Array(SAMPLES * 2 * 3);
  const strapUv = new Float32Array(SAMPLES * 2 * 2);
  const idx = [];
  for (let i = 0; i < SAMPLES - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  strapGeo.setIndex(idx);
  strapGeo.setAttribute('position', new THREE.BufferAttribute(strapPos, 3));
  strapGeo.setAttribute('uv', new THREE.BufferAttribute(strapUv, 2));
  const strapTex = makeStrapTexture();
  const STRAP_REPEAT = STRAP_W * (strapTex.image.width / strapTex.image.height); // strap length covered by one copy of the artwork
  // Glossy black: a clear lacquer coat over a pure-black ribbon catches the room's light as it swings.
  const strap = new THREE.Mesh(strapGeo, new THREE.MeshPhysicalMaterial({
    // The ribbon itself has no sheen (specularIntensity 0), so it stays pure black; only the sharp lacquer
    // coat reflects, which draws thin bright highlights along the curves instead of a grey wash.
    map: strapTex, color: 0xffffff, roughness: 1, metalness: 0, specularIntensity: 0, envMapIntensity: 1.25,
    clearcoat: 1, clearcoatRoughness: 0.06, side: THREE.DoubleSide,
  }));
  scene.add(strap);
  // How far each point of the strap has turned (radians). `follow` trails the card's spin up the strap;
  // TWIST_SHAPE keeps the fastened top end flat (0 at the anchor → 1 a third of the way down).
  const twist = new Float32Array(SAMPLES), follow = new Float32Array(SAMPLES);
  const TWIST_SHAPE = Float32Array.from({ length: SAMPLES }, (_, i) => {
    const t = Math.min(1, i / (SAMPLES - 1) / 0.34);
    return t * t * (3 - 2 * t);
  });

  // ── Simulation: rope points (0 pinned to the anchor; the last one is the end of the strap) + the card's bottom ──
  const anchor = new THREE.Vector3();
  let ropeLength = 3, segLen = ropeLength / SEGMENTS;
  const pts = [], prev = [];
  const bottom = new THREE.Vector3(), bottomPrev = new THREE.Vector3();
  // `drop`: the card starts bunched up above the top edge and falls in on its elastic strap (first load);
  // otherwise it starts swung out to the side (after a resize).
  function resetRope(drop = false) {
    pts.length = prev.length = 0;
    for (let i = 0; i <= SEGMENTS; i++) {
      const t = i / SEGMENTS;
      const p = drop
        ? new THREE.Vector3(anchor.x + Math.sin(t * 2.4) * 0.35, anchor.y + t * 0.4, 0)
        : new THREE.Vector3(anchor.x + Math.sin(t * 1.2) * ropeLength * 0.55, anchor.y - t * ropeLength * 0.8, 0);
      pts.push(p);
      prev.push(p.clone());
    }
    const tip = pts[SEGMENTS];
    bottom.set(tip.x + (drop ? 0.25 : 0.6), tip.y - CLIP - CARD_H, 0);
    bottomPrev.copy(bottom);
  }

  // `face` is the side the card settles on (0 = front, π = back); a click turns it over and the next one turns it back.
  let spin = 0.9, spinVel = 0, face = 0, lastTipX = 0, time = 0;
  const GRAVITY = -19, DAMP = 0.991, STEP = 1 / 120;
  const tmp = new THREE.Vector3();

  // Distance constraint. `k` < 1 makes it springy: the strap stretches under a pull and snaps back.
  function satisfy(a, b, len, pinA, pinB, k) {
    if (pinA && pinB) return;
    tmp.subVectors(b, a);
    const dist = tmp.length() || 1e-6;
    const diff = ((dist - len) / dist) * k;
    if (pinA) b.addScaledVector(tmp, -diff);
    else if (pinB) a.addScaledVector(tmp, diff);
    else {
      a.addScaledVector(tmp, diff * 0.5);
      b.addScaledVector(tmp, -diff * 0.5);
    }
  }

  let dragging = false;
  const dragTarget = new THREE.Vector3();

  function step(dt) {
    time += dt;
    const breeze = reduced ? 0 : Math.sin(time * 0.6) * 0.5 + Math.sin(time * 1.7) * 0.18;
    for (let i = 1; i <= SEGMENTS; i++) {
      const p = pts[i], q = prev[i];
      const vx = (p.x - q.x) * DAMP, vy = (p.y - q.y) * DAMP, vz = (p.z - q.z) * DAMP;
      q.copy(p);
      p.x += vx; p.y += vy + GRAVITY * 0.3 * dt * dt; p.z += vz - p.z * 0.03;
    }
    {
      const vx = (bottom.x - bottomPrev.x) * DAMP, vy = (bottom.y - bottomPrev.y) * DAMP, vz = (bottom.z - bottomPrev.z) * DAMP;
      bottomPrev.copy(bottom);
      bottom.x += vx + breeze * dt * dt; bottom.y += vy + GRAVITY * dt * dt; bottom.z += vz - bottom.z * 0.06;
    }
    pts[0].copy(anchor);
    if (dragging) pts[SEGMENTS].copy(dragTarget);
    for (let it = 0; it < 7; it++) {
      for (let i = 0; i < SEGMENTS; i++) satisfy(pts[i], pts[i + 1], segLen, i === 0, dragging && i + 1 === SEGMENTS, dragging ? 0.3 : 0.55);
      // The card itself is rigid.
      satisfy(pts[SEGMENTS], bottom, CLIP + CARD_H, dragging, false, 1);
    }
    // Sideways motion of the strap's end spins the card; a damped spring settles it on the face it should show.
    const tipX = pts[SEGMENTS].x;
    spinVel += (tipX - lastTipX) * 7;
    lastTipX = tipX;
    spinVel += (-11 * (spin - face) - 3.2 * spinVel) * dt;
    spin += spinVel * dt;
    // The strap turns with the card: the turn starts at the clamp and travels up the strap. The top end is
    // fastened, so the strap ends up with a half twist just below where it hangs from.
    follow[SAMPLES - 1] = spin;
    for (let i = SAMPLES - 2; i >= 0; i--) follow[i] += (follow[i + 1] - follow[i]) * 0.5;
    for (let i = 0; i < SAMPLES; i++) twist[i] = follow[i] * TWIST_SHAPE[i];
  }

  const up = new THREE.Vector3(), qBase = new THREE.Quaternion(), qSpin = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0);
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(), new THREE.Vector3(0, -1, 0)]);
  const tangent = new THREE.Vector3(), flat = new THREE.Vector3(), out = new THREE.Vector3(), side = new THREE.Vector3(), pnt = new THREE.Vector3();
  const leadIn = new THREE.Vector3(), tuckIn = new THREE.Vector3(), curvePts = [];
  // The hint follows the card's lowest point on screen (eased, so it doesn't bob with every swing).
  const hintEl = document.querySelector('.badge-hint');
  const hintOff = { x: 0, y: 0, on: false }, hintPos = { x: 0, y: -1 }, proj = new THREE.Vector3();
  function placeHint() {
    if (!hintEl || !hintOff.on || !cw) return;
    proj.copy(bottom).project(camera);
    const x = ((proj.x + 1) / 2) * cw, y = ((1 - proj.y) / 2) * ch + 30;
    if (hintPos.y < 0) { hintPos.x = x; hintPos.y = y; } else { hintPos.x += (x - hintPos.x) * 0.06; hintPos.y += (y - hintPos.y) * 0.06; }
    hintEl.style.cssText = `left:${(hintOff.x + hintPos.x).toFixed(1)}px;top:${(hintOff.y + hintPos.y).toFixed(1)}px;right:auto;bottom:auto;transform:translateX(-50%);white-space:nowrap;${hintEl.style.opacity ? `opacity:${hintEl.style.opacity};` : ''}`;
  }

  // strapTopY: world height of the top of the visible strap (set by layout). strapShift: the artwork's offset.
  let strapTopY = 1e9, strapShift = null, underNav = false, canvasPageTop = 0;
  const navForStrap = document.querySelector('.nav');
  function sync() {
    const tip = pts[SEGMENTS];
    up.subVectors(tip, bottom).normalize();
    qBase.setFromUnitVectors(Y, up);
    qSpin.setFromAxisAngle(Y, spin);
    card.quaternion.copy(qBase).multiply(qSpin);
    card.position.copy(tip);
    // The laminate's glare follows the card's turn and sideways tilt: it rests near the top corner and sweeps
    // across the face whenever the card swings, is dragged or flips.
    const sweep = Math.sin(spin - face) * 0.9 + up.x * 1.4;
    const o = (v) => Math.min(0.5, Math.max(0, v));
    front.glare.offset.setScalar(o(0.13 + sweep * 0.32));
    back.glare.offset.setScalar(o(0.13 - sweep * 0.32));

    // The strap's last stretch follows the card's own axis and runs into the clamp, so the two always meet
    // flush — at any angle, twist or stretch — instead of leaving a gap or a wedge where they join.
    leadIn.copy(tip).addScaledVector(up, Math.min(segLen * 0.6, 0.12));
    tuckIn.copy(tip).addScaledVector(up, -0.07);
    curvePts.length = 0;
    for (let i = 0; i < SEGMENTS; i++) curvePts.push(pts[i]);
    curvePts.push(leadIn, tip, tuckIn);
    curve.points = curvePts;
    curve.updateArcLengths(); // the points moved, so even spacing (and the artwork on it) needs fresh lengths
    // Centre "AX Arianit Xhafa" in the stretch of strap that's on screen — from the top edge (or under the
    // navbar on phones) down to the clamp — with the same space above the name as below it. The artwork is
    // measured along the curve from its end (hidden 0.07 inside the clamp), so the lettering keeps its size.
    const curveLen = curve.getLength();
    if (!dragging || strapShift === null) {
      // On phones the strap starts under the navbar: follow where it really is (it slides in after loading).
      if (underNav && navForStrap) strapTopY = toWorld(0, navForStrap.getBoundingClientRect().bottom + 4 - canvasPageTop).y; // (as seen at the top of the page)
      let vis = 0;
      for (let i = 0; i <= 60; i++) {
        curve.getPointAt(1 - i / 60, pnt);
        if (pnt.y > strapTopY) break;
        vis = (i / 60) * curveLen;
      }
      const shown = Math.max(0, vis - 0.07);
      const text = strapTex.textFrac * STRAP_REPEAT;
      const gap = Math.max(0.03, (shown - text) / 2);
      const target = strapTex.nameEndFrac + (0.07 + gap) / STRAP_REPEAT;
      strapShift = strapShift === null || Math.abs(target - strapShift) > 0.5 ? target : strapShift + (target - strapShift) * 0.08;    }
    for (let i = 0; i < SAMPLES; i++) {
      const t = i / (SAMPLES - 1);
      curve.getPointAt(t, pnt);
      curve.getTangentAt(t, tangent);
      // Flat across the screen when untwisted; turned around the strap's own direction by its twist.
      flat.set(-tangent.y, tangent.x, 0);
      if (flat.lengthSq() < 1e-8) flat.set(1, 0, 0);
      flat.normalize();
      out.crossVectors(flat, tangent); // = (strap's "up") × flat
      const a = twist[i];
      side.copy(flat).multiplyScalar(Math.cos(a)).addScaledVector(out, Math.sin(a)).multiplyScalar(STRAP_W / 2);
      const o = i * 6;
      strapPos[o] = pnt.x - side.x; strapPos[o + 1] = pnt.y - side.y; strapPos[o + 2] = pnt.z - side.z;
      strapPos[o + 3] = pnt.x + side.x; strapPos[o + 4] = pnt.y + side.y; strapPos[o + 5] = pnt.z + side.z;
      // The artwork is laid out from the clamp upwards, at its true length, shifted so the name sits centred.
      const u = strapShift - ((1 - t) * curveLen) / STRAP_REPEAT;
      strapUv[i * 4] = u; strapUv[i * 4 + 1] = 0; strapUv[i * 4 + 2] = u; strapUv[i * 4 + 3] = 1;
    }
    strapGeo.attributes.position.needsUpdate = true;
    strapGeo.attributes.uv.needsUpdate = true;
    strapGeo.computeVertexNormals();
    strapGeo.computeBoundingSphere();
  }

  // ── Layout in screen pixels: the card is about half the viewport tall and hangs from above the top edge ──
  let pxPerUnit = 200, halfW = 1, halfH = 1, cw = 1, ch = 1;
  const toWorld = (px, py, out3 = new THREE.Vector3()) => out3.set((px / cw) * 2 * halfW - halfW, halfH - (py / ch) * 2 * halfH, 0);
  function layout() {
    cw = canvas.clientWidth; ch = canvas.clientHeight;
    if (!cw || !ch) return false;
    renderer.setSize(cw, ch, false);
    camera.aspect = cw / ch;
    // Phones held sideways are short and wide: text and card sit side by side (see the matching block in styles.css).
    const short = matchMedia(SHORT_LANDSCAPE).matches;
    const stacked = matchMedia('(max-width: 980px)').matches && !short;
    const vh = innerHeight;
    // The strap above the card must be long enough to show the whole name: that length grows with the card
    // (both scale with pxPerUnit), so it's a fixed share `k` of the card's own height.
    // (name length + the part inside the clamp + a little room above and below it)
    const k = (strapTex.textFrac * STRAP_REPEAT + 0.07 + 0.34) / (CARD_H + CLIP);
    // Where the navbar ends once it has settled (offsets ignore its slide-in animation).
    const navEl = document.querySelector('.nav');
    const navBottom = stacked ? (navEl ? navEl.offsetTop + navEl.offsetHeight : 76) : 0;
    // Card + clamp height in px. On short screens it shrinks so card, strap name and hint all fit.
    const cardPx = short ? Math.min(400, (vh - 24) / (1 + k))
      : stacked ? Math.min(470, vh * 0.6, cw * 1.12)
      : Math.min(Math.max(420, Math.min(vh * 0.64, 700)), (vh - 48) / (1 + k));
    pxPerUnit = cardPx / (CARD_H + CLIP);
    halfH = ch / pxPerUnit / 2;
    halfW = halfH * camera.aspect;
    camera.position.set(0, 0, halfH / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    camera.updateProjectionMatrix();
    // Where the strap is fastened (above the top edge) and how far down the card hangs at rest.
    const b = badge.getBoundingClientRect(), c = canvas.getBoundingClientRect();
    const ax = stacked ? cw / 2 : b.left - c.left + b.width * 0.5;
    toWorld(ax, -60, anchor);
    // How far below the top the card hangs: enough strap above it for the whole "AX Arianit Xhafa" (below the
    // navbar on phones, where the strap runs behind it), never less than the old minimums.
    const nameStrap = k * cardPx + 16;
    const restTopPx = short ? Math.max(70, nameStrap) : stacked ? Math.max(250, navBottom + nameStrap) : Math.max(165, vh * 0.3, nameStrap);
    // The page layout (phones: where the text starts) follows the card.
    hero.style.setProperty('--card-top', `${Math.round(restTopPx)}px`);
    // Top of the visible strap, in world units: the top of the screen, or just under the navbar on phones
    // (where the strap runs behind it). Measured from the page top, as the card hangs at the top of the page.
    canvasPageTop = c.top + scrollY;
    underNav = stacked;
    strapTopY = toWorld(0, (stacked ? navBottom + 4 : 0) - canvasPageTop).y;
    strapShift = null;
    hero.style.setProperty('--card-px', `${Math.round(cardPx)}px`);
    ropeLength = (restTopPx + 60) / pxPerUnit;
    segLen = ropeLength / SEGMENTS;
    // "Drag · click to flip" is placed under the card's real position (see placeHint), in badge coordinates.
    hintOff.x = c.left - b.left; hintOff.y = c.top - b.top; hintOff.on = !stacked;
    hintPos.y = -1;
    return true;
  }

  // ── Pointer: only presses that land on the card are taken; everything else reaches the page ──
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const grabOffset = new THREE.Vector3();
  const pick = (x, y) => {
    const r = canvas.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects([body, front.mesh, back.mesh, clampBody], false)[0] || null;
  };
  let pressX = 0, pressY = 0, pressT = 0, moved = false, pointerId = null;

  // Stop the page from scrolling when a finger lands on the card, so it can be dragged on phones too.
  hero.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    if (t && pick(t.clientX, t.clientY)) e.preventDefault();
  }, { passive: false });

  hero.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || !pick(e.clientX, e.clientY)) return;
    e.preventDefault();
    e.stopPropagation();
    wake();
    hideHint();
    dragging = true;
    moved = false;
    pointerId = e.pointerId;
    pressX = e.clientX; pressY = e.clientY; pressT = performance.now();
    hero.classList.add('is-dragging');
    raycaster.ray.intersectPlane(plane, tmp);
    grabOffset.subVectors(pts[SEGMENTS], tmp);
    dragTarget.copy(pts[SEGMENTS]);
  }, { capture: true });

  addEventListener('pointermove', (e) => {
    if (dragging && e.pointerId === pointerId) {
      if (Math.hypot(e.clientX - pressX, e.clientY - pressY) > 6) moved = true;
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const p = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(plane, p)) {
        p.add(grabOffset);
        // The strap stretches as far as the corners of the hero, but not forever.
        const d = p.distanceTo(anchor), max = Math.hypot(halfW * 2, halfH * 2);
        if (d > max) p.sub(anchor).multiplyScalar(max / d).add(anchor);
        dragTarget.copy(p);
      }
      return;
    }
    if (e.pointerType === 'mouse') hero.classList.toggle('is-over-card', !!pick(e.clientX, e.clientY));
  }, { passive: true });

  const release = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;
    hero.classList.remove('is-dragging');
    // A short press without dragging flips the card.
    if (!moved && performance.now() - pressT < 350) {
      const toBack = face === 0;
      face = toBack ? Math.PI : 0;
      spinVel += toBack ? 4 : -4;
      document.dispatchEvent(new CustomEvent('lanyard:flip'));
    }
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);

  const hint = document.querySelector('.badge-hint');
  let hintHidden = false;
  function hideHint() {
    if (hintHidden || !hint) return;
    hintHidden = true;
    hint.style.opacity = '0';
  }

  // ── Loop: fixed-step physics; pauses off screen and in background tabs; settles to a stop with reduced motion ──
  let running = false, visible = true, acc = 0, lastT = 0, calm = 0, started = false;
  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - (lastT || t)) / 1000);
    lastT = t;
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 8) { step(STEP); acc -= STEP; n++; }
    sync();
    if (!hintHidden) placeHint();
    renderer.render(scene, camera);
    if (reduced && !dragging) {
      const motion = pts[SEGMENTS].distanceTo(prev[SEGMENTS]) + bottom.distanceTo(bottomPrev) + Math.abs(spinVel) * 0.01;
      calm = motion < 0.0004 ? calm + dt : 0;
      if (calm > 0.6) { running = false; return; }
    }
    requestAnimationFrame(frame);
  }
  function wake() {
    calm = 0;
    if (!started || running || !visible || document.hidden) return;
    running = true;
    lastT = 0;
    requestAnimationFrame(frame);
  }
  const sleep = () => { running = false; };

  layout();
  resetRope(!reduced);
  if (reduced) { spin = 0; spinVel = 0; for (let i = 0; i < 900; i++) step(STEP); }
  follow.fill(spin);
  for (let i = 0; i < SAMPLES; i++) twist[i] = spin * TWIST_SHAPE[i];
  sync();
  renderer.render(scene, camera);
  hero.classList.add('is-3d');
  // The card drops in once the loading screen has gone.
  (window.siteReady || Promise.resolve()).then(() => {
    started = true;
    if (!reduced) { resetRope(true); spin = 0.6; spinVel = 0; face = 0; follow.fill(spin); }
    wake();
  });

  let lastW = cw;
  new ResizeObserver(() => {
    const before = cw;
    if (!layout()) return;
    // A real width change (rotation, resize) re-hangs the card; small height changes (mobile URL bar) don't.
    if (Math.abs(cw - before) > 40 && Math.abs(cw - lastW) > 40) { lastW = cw; resetRope(); }
    wake();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) wake(); else sleep();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? sleep() : wake()));

  // Redraw the artwork once the fonts, the photo and the QR code have loaded.
  const loadImg = (src) => new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
  const fontsReady = Promise.race([
    Promise.all([
      document.fonts.load('400 120px "Anton"'),
      document.fonts.load('800 60px "Inter"'),
      document.fonts.load('600 30px "Inter"'),
      document.fonts.load('700 26px "JetBrains Mono"'),
    ]),
    new Promise((r) => setTimeout(r, 3500)),
  ]);
  Promise.all([fontsReady, loadImg(canvas.dataset.photo), loadImg(canvas.dataset.qr)]).then(([, photo, qr]) => {
    front.redraw({ photo });
    back.redraw({ qr });
    strapTex.redraw();
    layout(); // the real font changes the name's length on the strap, and with it where the card hangs
    renderer.render(scene, camera);
    document.dispatchEvent(new Event('lanyard:ready'));
    wake();
  });
}

// ─────────────────────────────── Card artwork ───────────────────────────────
// The artwork is drawn in W×H units onto a canvas FACE_SCALE times larger, so small type stays sharp on screen.
const FACE_SCALE = 1.6;
function makeFace(geometry, draw) {
  const c = document.createElement('canvas');
  c.width = Math.round(W * FACE_SCALE); c.height = Math.round(H * FACE_SCALE);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  // alphaTest (not blending) cuts the rounded corners, so the face never sorts wrongly against the strap or ring.
  // Not tone-mapped: the printed colours come out as drawn (deep navy, warm cream) instead of washed towards white.
  // Matte (Lambert): no specular sheen, which was laying a white haze over the navy ink.
  // Ambient (0.6) + key (1.5 · cosθ) reach a Lambert surface divided by π, so ~0.6 on a card facing the camera;
  // the colour scales that up to ~1, so the print shows its real colours and still shades as the card swings.
  const mat = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, toneMapped: false });
  mat.color.setScalar(1.62);
  const mesh = new THREE.Mesh(geometry, mat);
  // Glossy laminate: a bright diagonal glare added on top of the print (additive, so it never greys the
  // colours), cut to the card's rounded shape and slot. `glare.offset` is moved every frame from the card's
  // tilt and turn, so the shine sweeps across the card as it swings, like light on a laminated badge.
  const glare = glareTexture();
  const gloss = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    map: glare, alphaMap: faceMask(), transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false,
  }));
  gloss.position.z = 0.0012;
  gloss.renderOrder = 2;
  gloss.raycast = () => {};
  mesh.add(gloss);
  const redraw = (assets = {}) => {
    const ctx = c.getContext('2d');
    ctx.setTransform(FACE_SCALE, 0, 0, FACE_SCALE, 0, 0);
    draw(ctx, assets);
    tex.needsUpdate = true;
  };
  redraw();
  return { mesh, redraw, glare };
}

// A diagonal glare (a soft wide band with a sharp bright core, plus a thin second streak) on a texture twice the
// card's size: the card shows half of it (repeat 0.5), and sliding `offset` between 0 and 0.5 sweeps the band
// from one corner to the other without ever reaching the texture's edges.
function glareTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 512, 512, 0);
  [[0, 0], [0.36, 0], [0.43, 0.07], [0.48, 0.2], [0.5, 0.42], [0.515, 0.2], [0.56, 0.06], [0.6, 0],
    [0.64, 0], [0.655, 0.16], [0.67, 0], [1, 0]].forEach(([at, a]) => g.addColorStop(at, `rgba(255,255,255,${a})`));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(0.5, 0.5);
  tex.offset.set(0.25, 0.25);
  return tex;
}

// White where the print is (rounded corners), black in the lanyard slot: cuts the glare to the face's shape.
function faceMask() {
  const k = 256 / W;
  const c = document.createElement('canvas');
  c.width = 256; c.height = Math.round(H * k);
  const ctx = c.getContext('2d');
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  rr(ctx, 0, 0, W, H, 34);
  ctx.fillStyle = '#fff';
  ctx.fill();
  const PX = H / 2.16, w = 0.36 * PX, h = 0.075 * PX, y = 0.018 * PX;
  rr(ctx, W / 2 - w / 2 - 12, y - 12, w + 24, h + 24, h / 2 + 12);
  ctx.fillStyle = '#000';
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Seeded noise so the paper texture is the same on every load.
function rand(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Cream paper with a faint drafting grid, fibres and creases. Leaves the context clipped to the rounded face.
function paper(ctx) {
  ctx.clearRect(0, 0, W, H);
  rr(ctx, 0, 0, W, H, 34);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W * 0.5, H * 0.45, W * 0.2, W * 0.5, H * 0.5, W * 0.95);
  v.addColorStop(0, 'rgba(255,255,255,0.2)');
  v.addColorStop(1, 'rgba(110,96,70,0.18)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(20,29,56,0.07)';
  ctx.lineWidth = 1.5;
  for (let x = 32; x < W; x += 48) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = 32; y < H; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
  const r = rand(7);
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = `rgba(${r() < 0.5 ? '90,76,50' : '255,255,255'},${0.04 + r() * 0.06})`;
    ctx.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
  }
  ctx.strokeStyle = 'rgba(110,96,70,0.09)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    let x = r() * W, y = r() * H;
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) { x += (r() - 0.5) * 260; y += (r() - 0.5) * 260; ctx.lineTo(x, y); }
    ctx.stroke();
  }
}

// The slot the ring passes through: a black pill cut into the top edge of the face.
// The face is 2.16 units tall in the 3D card (H px), so 0.018 / 0.075 / 0.36 units map to these pixel sizes.
const PX = H / 2.16;
function slot(ctx) {
  const w = 0.36 * PX, h = 0.075 * PX, y = 0.018 * PX;
  // A thin dark lip around the hole, then the hole itself is cleared so you can see through the card.
  rr(ctx, W / 2 - w / 2 - 12, y - 12, w + 24, h + 24, h / 2 + 12);
  ctx.fillStyle = '#0b0c11';
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  rr(ctx, W / 2 - w / 2, y, w, h, h / 2);
  ctx.fill();
  ctx.restore();
}

function node(ctx, x, y, r = 10) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function stripes(ctx, x, y, w, h, color = INK) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = color;
  for (let i = -h; i < w + h; i += 34) {
    ctx.beginPath();
    ctx.moveTo(x + i, y + h); ctx.lineTo(x + i + 17, y + h); ctx.lineTo(x + i + 17 + h, y); ctx.lineTo(x + i + h, y);
    ctx.fill();
  }
  ctx.restore();
}

function tape(ctx, x, y, w, h, angle, fill) {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  ctx.fillStyle = fill;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

function verticalText(ctx, text, x, y, size, color, maxLen = Infinity) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.PI / 2);
  ctx.fillStyle = color;
  ctx.font = `400 ${size}px "Anton", "Inter", sans-serif`;
  ctx.textBaseline = 'middle';
  const len = ctx.measureText(text).width;
  if (len > maxLen) ctx.scale(maxLen / len, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

// The "AX" mark in a rounded square, then the university beside it.
function emblem(ctx, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(2.1, 2.1);
  ctx.fillStyle = INK;
  rr(ctx, 0, 0, 40, 40, 11);
  ctx.fill();
  ctx.strokeStyle = SKY;
  ctx.lineWidth = 2.6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(10, 29); ctx.lineTo(16.5, 11); ctx.lineTo(23, 29);
  ctx.moveTo(12.6, 22.5); ctx.lineTo(20.4, 22.5);
  ctx.moveTo(24, 11); ctx.lineTo(31, 29);
  ctx.moveTo(31, 11); ctx.lineTo(24, 29);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  ctx.font = '800 30px "Inter", sans-serif';
  ctx.fillText('UNIVERSITY', x + 98, y + 28);
  ctx.fillText('OF MITROVICA', x + 98, y + 60);
  ctx.font = '700 17px "JetBrains Mono", monospace';
  ctx.fillText('"ISA BOLETINI" · UMIB', x + 98, y + 84);
}

// A dark "editor" panel behind the photo, with faint lines of code and a blue glow.
function codePanel(ctx, x, y, w, h) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#16213f'); g.addColorStop(1, '#070b18');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  const glow = ctx.createRadialGradient(x + w * 0.55, y + h * 0.6, 10, x + w * 0.55, y + h * 0.6, w * 0.8);
  glow.addColorStop(0, 'rgba(47,107,255,0.6)'); glow.addColorStop(1, 'rgba(47,107,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x, y, w, h);
  ctx.font = '700 17px "JetBrains Mono", monospace';
  ctx.textBaseline = 'alphabetic';
  const lines = ['const dev = {', '  name: "Arianit",', '  stack: ["next", "pg"],', '  ships: true,', '};', '', 'await build(idea);', 'deploy({ prod: true });', '// learn → build → ship'];
  lines.forEach((l, i) => {
    ctx.fillStyle = i % 3 === 0 ? 'rgba(143,178,255,0.6)' : 'rgba(236,228,207,0.34)';
    ctx.fillText(l, x + 22, y + 46 + i * 30);
  });
  ctx.restore();
}

function drawFront(ctx, { photo } = {}) {
  paper(ctx);
  slot(ctx);

  // "JUNIOR" tag, with a leader line down to the headline frame
  ctx.fillStyle = INK;
  ctx.fillRect(66, 92, 232, 68);
  ctx.fillStyle = CREAM;
  ctx.font = '400 48px "Anton", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText('JUNIOR', 90, 128);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(298, 126); ctx.lineTo(430, 126); ctx.lineTo(430, 200); ctx.stroke();
  ctx.fillStyle = INK;
  node(ctx, 430, 200, 7);
  emblem(ctx, W - 400, 78);

  // Headline in a thin frame with corner nodes
  ctx.strokeRect(54, 200, W - 108, 270);
  [[54, 200], [W - 54, 200], [54, 470], [W - 54, 470]].forEach(([x, y]) => node(ctx, x, y));
  ctx.font = '400 226px "Anton", "Inter", sans-serif';
  ctx.textBaseline = 'alphabetic';
  const word = 'DEVELOPER';
  const tw = ctx.measureText(word).width;
  ctx.save();
  ctx.translate(W / 2, 438);
  ctx.scale(Math.min(1, (W - 150) / tw), 1);
  ctx.textAlign = 'center';
  ctx.fillText(word, 0, 0);
  ctx.restore();
  ctx.textAlign = 'left';

  // A small striped sticker on the headline
  ctx.save();
  ctx.translate(300, 392);
  ctx.rotate(-0.16);
  ctx.fillStyle = CREAM;
  ctx.fillRect(-64, -40, 128, 80);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.strokeRect(-64, -40, 128, 80);
  ctx.fillStyle = INK;
  ctx.font = '700 17px "JetBrains Mono", monospace';
  ctx.textBaseline = 'middle';
  ctx.fillText('est. 2024', -50, -22);
  stripes(ctx, -52, -6, 104, 34);
  ctx.restore();

  // Code panel, and a framed column of vertical type on the right
  codePanel(ctx, 66, 510, 630, 660);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.strokeRect(W - 204, 510, 138, 660);
  node(ctx, W - 204, 510, 8); node(ctx, W - 66, 1170, 8);
  verticalText(ctx, 'COMPUTER SCIENCE', W - 135, 532, 92, INK, 620);

  // Photo (cut-out), overlapping the headline and the panel
  if (photo) {
    const s = 880 / (photo.height * 0.62);
    const iw = photo.width * s, ih = photo.height * s;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H - 236); ctx.clip();
    ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 32; ctx.shadowOffsetY = 12;
    ctx.drawImage(photo, W / 2 - iw / 2 - 44, 296, iw, ih);
    ctx.restore();
  } else {
    ctx.fillStyle = BLUE;
    ctx.font = '400 300px "Anton", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AX', 380, 940);
    ctx.textAlign = 'left';
  }

  // Name tape
  tape(ctx, 132, 1010, 590, 86, -0.035, CREAM);
  ctx.save();
  ctx.translate(427, 1053);
  ctx.rotate(-0.035);
  ctx.fillStyle = INK;
  ctx.font = '400 58px "Anton", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('ARIANIT XHAFA', 0, 3);
  ctx.restore();

  // Bottom band
  ctx.fillStyle = INK;
  ctx.fillRect(0, H - 236, W, 236);
  ctx.fillStyle = BLUE;
  ctx.fillRect(0, H - 236, W, 8);
  ctx.fillStyle = CREAM;
  ctx.font = '400 132px "Anton", sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('PORTFOLIO', 64, H - 62);
  // A small "pill" mark and the motto
  ctx.strokeStyle = 'rgba(236,228,207,0.75)';
  ctx.lineWidth = 3;
  rr(ctx, W - 372, H - 132, 96, 40, 20); ctx.stroke();
  rr(ctx, W - 356, H - 124, 64, 24, 12); ctx.stroke();
  ctx.font = '600 27px "Inter", sans-serif';
  ctx.fillStyle = 'rgba(236,228,207,0.85)';
  ctx.fillText('Learn. Build.', W - 248, H - 118);
  ctx.fillStyle = SKY;
  ctx.fillText('Ship.', W - 248, H - 82);
  ctx.restore();
}

function drawBack(ctx, { qr } = {}) {
  paper(ctx);
  slot(ctx);

  // "SCAN ME" tape with hazard stripes
  tape(ctx, 62, 104, 340, 96, -0.07, CREAM);
  ctx.save();
  ctx.translate(232, 152);
  ctx.rotate(-0.07);
  ctx.fillStyle = INK;
  ctx.font = '400 70px "Anton", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCAN ME', 0, 3);
  ctx.restore();
  stripes(ctx, 76, 222, 310, 32);
  emblem(ctx, W - 400, 92);

  // Dark panel with the QR code (dark modules on cream, so every phone camera reads it)
  const px = 104, py = 300, pw = 660, ph = 800;
  ctx.fillStyle = INK;
  ctx.fillRect(px, py, pw, ph);
  stripes(ctx, px - 36, py + 40, 22, 270, INK);
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '400 70px "Anton", sans-serif';
  ctx.fillText('CONNECT WITH ME', px + pw / 2, py + 112);
  ctx.font = '700 26px "JetBrains Mono", monospace';
  ctx.fillStyle = SKY;
  ctx.fillText('— LINKEDIN —', px + pw / 2, py + 162);
  ctx.textAlign = 'left';
  const qs = 480, qx = px + (pw - qs) / 2, qy = py + 212;
  ctx.fillStyle = CREAM;
  ctx.fillRect(qx - 26, qy - 26, qs + 52, qs + 52);
  if (qr) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, qx, qy, qs, qs);
    ctx.imageSmoothingEnabled = true;
  }

  // Framed column of vertical type on the right
  ctx.strokeStyle = INK;
  ctx.lineWidth = 4;
  ctx.strokeRect(W - 204, 300, 138, 800);
  ctx.fillStyle = INK;
  node(ctx, W - 204, 300, 8); node(ctx, W - 66, 1100, 8);
  verticalText(ctx, 'COMPUTER SCIENCE & ENG.', W - 135, 322, 78, INK, 760);

  // Name label
  ctx.fillStyle = INK;
  ctx.fillRect(104, 1160, W - 208, 186);
  ctx.fillStyle = BLUE;
  ctx.fillRect(104, 1160, 14, 186);
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'center';
  ctx.font = '400 78px "Anton", sans-serif';
  ctx.fillText('ARIANIT XHAFA', W / 2, 1252);
  ctx.font = '600 29px "Inter", sans-serif';
  ctx.fillStyle = 'rgba(236,228,207,0.85)';
  ctx.fillText('—  Junior Developer  —', W / 2, 1306);
  ctx.textAlign = 'left';
  ctx.restore();
}

// Black woven strap with a round mark and the name in white, read from the top down.
function makeStrapTexture() {
  const c = document.createElement('canvas');
  // The right end of the canvas sits at the clamp, so the name is drawn there and shows just above the card.
  // Wide artwork with the name at one end: the next repeat of the name is far up, never on screen.
  c.width = 2048; c.height = 128;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  const draw = () => {
    const ctx = c.getContext('2d');
    // Pure black, no weave: the shine comes from the material's lacquer coat.
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, c.width, c.height);
    // Satin sheen: a soft light band a little above the middle, and a thin bright line inside it
    const sheen = ctx.createLinearGradient(0, 0, 0, c.height);
    sheen.addColorStop(0, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.24, 'rgba(255,255,255,0.14)');
    sheen.addColorStop(0.36, 'rgba(255,255,255,0.3)');
    sheen.addColorStop(0.48, 'rgba(255,255,255,0.12)');
    sheen.addColorStop(0.8, 'rgba(255,255,255,0)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, c.width, c.height);
    // Bright edges and a stitched seam along both sides, so the black strap reads against the dark page
    ctx.fillStyle = 'rgba(205,215,235,0.75)';
    ctx.fillRect(0, 0, c.width, 4);
    ctx.fillRect(0, c.height - 4, c.width, 4);
    ctx.fillStyle = 'rgba(205,215,235,0.55)';
    for (let x = 0; x < c.width; x += 18) {
      ctx.fillRect(x, 11, 11, 3);
      ctx.fillRect(x, c.height - 14, 11, 3);
    }
    // Round mark
    ctx.strokeStyle = '#ffffff';
    // Large type. The lettering sits at the right end of the artwork; the strap shifts it along (see sync) so
    // it's centred in the visible strap. textFrac / nameEndFrac: its length and its clamp-side end, as shares
    // of the artwork's width.
    ctx.lineWidth = 7;
    ctx.font = '800 68px "Inter", sans-serif';
    ctx.letterSpacing = '5px';
    const nameEnd = c.width - 24;
    const nameStart = nameEnd - ctx.measureText('Arianit Xhafa').width;
    ctx.letterSpacing = '0px';
    const markR = 36, markX = nameStart - markR - 22;
    tex.nameEndFrac = (nameEnd + 2) / c.width;
    tex.textFrac = (nameEnd + 2 - (markX - markR - 4)) / c.width;
    ctx.beginPath(); ctx.arc(markX, 64, markR, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.font = '800 36px "Inter", sans-serif';
    ctx.fillText('AX', markX, 66);
    // Name
    ctx.textAlign = 'left';
    ctx.font = '800 68px "Inter", sans-serif';
    ctx.letterSpacing = '5px';
    ctx.fillText('Arianit Xhafa', nameStart, 68);
    ctx.letterSpacing = '0px';
    tex.needsUpdate = true;
  };
  draw();
  tex.redraw = draw;
  return tex;
}

// Started last, so every constant and helper above is initialised.
if (canvas && hero && badge) {
  try {
    start();
  } catch (error) {
    console.warn('3D card unavailable, showing the static card instead.', error);
    document.dispatchEvent(new Event('lanyard:ready'));
  }
} else {
  document.dispatchEvent(new Event('lanyard:ready'));
}
