// Low-poly model pack: every character and prop is generated from rounded
// primitives with vertex colors, so the whole city shares one clean material.
window.ToyKit = (() => {
  'use strict';
  const T = THREE;
  const random = n => { const v = Math.sin(n * 127.1 + 17.7) * 43758.5453; return v - Math.floor(v); };
  const pick = (list, n) => list[Math.floor(random(n) * list.length) % list.length];

  // ---- Primitives (all centered on the origin, indexed, with normals) ----
  function roundedBox(w, h, d, r = Math.min(w, h, d) * .3, segments = 2) {
    const geometry = new T.BoxGeometry(w, h, d, segments * 2, segments * 2, segments * 2);
    const position = geometry.attributes.position, normal = geometry.attributes.normal;
    const v = new T.Vector3(), inner = new T.Vector3();
    const hx = Math.max(0, w / 2 - r), hy = Math.max(0, h / 2 - r), hz = Math.max(0, d / 2 - r);
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i);
      inner.set(T.MathUtils.clamp(v.x, -hx, hx), T.MathUtils.clamp(v.y, -hy, hy), T.MathUtils.clamp(v.z, -hz, hz));
      v.sub(inner);
      if (v.lengthSq() < 1e-12) v.set(0, 1, 0);
      v.normalize();normal.setXYZ(i, v.x, v.y, v.z);
      position.setXYZ(i, inner.x + v.x * r, inner.y + v.y * r, inner.z + v.z * r);
    }
    return geometry;
  }
  const sphere = (r, w = 12, h = 9) => new T.SphereGeometry(r, w, h);
  const cylinder = (top, bottom, height, segments = 12) => new T.CylinderGeometry(top, bottom, height, segments);
  const cone = (r, height, segments = 12) => new T.ConeGeometry(r, height, segments);
  const capsule = (r, length, radial = 7) => new T.CapsuleGeometry(r, Math.max(.001, length), 2, Math.min(radial, 7));
  const torus = (r, tube, radial = 8, tubular = 20, arc = Math.PI * 2) => new T.TorusGeometry(r, tube, radial, tubular, arc);

  // Primitives are cached by their arguments; the builder clones them anyway.
  const memo = fn => { const cache = new Map(); return (...args) => { const key = args.join(','); if (!cache.has(key)) cache.set(key, fn(...args)); return cache.get(key); }; };
  const roundedBoxCached = memo(roundedBox), sphereCached = memo(sphere), cylinderCached = memo(cylinder), coneCached = memo(cone), capsuleCached = memo(capsule), torusCached = memo(torus);

  // ---- Builder: merges colored parts (optionally bound to bones) into one geometry ----
  const tmpMatrix = new T.Matrix4(), tmpQuat = new T.Quaternion(), tmpEuler = new T.Euler(), tmpScale = new T.Vector3(), tmpPos = new T.Vector3(), tmpColor = new T.Color();
  const up = new T.Vector3(0, 1, 0);
  class Builder {
    constructor() { this.parts = []; }
    add(geometry, color, { p = [0, 0, 0], r = [0, 0, 0], s = 1, q = null, bone = 0 } = {}) {
      tmpPos.set(p[0], p[1], p[2]);
      if (q) tmpQuat.copy(q); else tmpQuat.setFromEuler(tmpEuler.set(r[0], r[1], r[2]));
      if (typeof s === 'number') tmpScale.setScalar(s); else tmpScale.set(s[0], s[1], s[2]);
      tmpMatrix.compose(tmpPos, tmpQuat, tmpScale);
      const placed = geometry.clone().applyMatrix4(tmpMatrix);
      if (!placed.index) placed.setIndex([...Array(placed.attributes.position.count).keys()]);
      this.parts.push({ geometry: placed, color: tmpColor.set(color).clone(), bone });
      return this;
    }
    // A capsule from point a to point b, for limbs and poles.
    limb(a, b, radius, color, bone = 0, radial = 8) {
      const from = new T.Vector3(...a), to = new T.Vector3(...b), dir = to.clone().sub(from), length = dir.length();
      return this.add(capsuleCached(radius, length - radius * 2 > 0 ? length - radius * 2 : .001, radial), color, { p: from.clone().add(to).multiplyScalar(.5).toArray(), q: new T.Quaternion().setFromUnitVectors(up, dir.normalize()), bone });
    }
    // A tapered limb segment: radius r1 at a, r2 at b.
    taper(a, b, r1, r2, color, bone = 0, segments = 10) {
      const from = new T.Vector3(...a), to = new T.Vector3(...b), dir = to.clone().sub(from), length = dir.length();
      return this.add(cylinderCached(r2, r1, length, segments), color, { p: from.clone().add(to).multiplyScalar(.5).toArray(), q: new T.Quaternion().setFromUnitVectors(up, dir.normalize()), bone });
    }
    // A smooth stretched sphere spanning a to b, like a muscle or limb segment.
    ellipsoid(a, b, rx, rz, color, bone = 0, stretch = 1.12) {
      const from = new T.Vector3(...a), to = new T.Vector3(...b), dir = to.clone().sub(from), length = dir.length();
      return this.add(sphereCached(1, 16, 12), color, { p: from.clone().add(to).multiplyScalar(.5).toArray(), q: new T.Quaternion().setFromUnitVectors(up, dir.normalize()), s: [rx, length / 2 * stretch, rz], bone });
    }
    // A body of revolution from [radius, y] pairs, squashed front to back.
    lathe(profile, color, { depth = .62, bone = 0, p = [0, 0, 0], segments = 24 } = {}) {
      const geometry = new T.LatheGeometry(new T.SplineCurve(profile.map(([r, y]) => new T.Vector2(r, y))).getPoints(profile.length * 4), segments);
      return this.add(geometry, color, { p, s: [1, 1, depth], bone });
    }
    rod(a, b, radius, color, bone = 0, segments = 8) {
      const from = new T.Vector3(...a), to = new T.Vector3(...b), dir = to.clone().sub(from), length = dir.length();
      return this.add(cylinderCached(radius, radius, length, segments), color, { p: from.clone().add(to).multiplyScalar(.5).toArray(), q: new T.Quaternion().setFromUnitVectors(up, dir.normalize()), bone });
    }
    geometry(skinned = false) {
      let vertexCount = 0, indexCount = 0;
      for (const { geometry } of this.parts) { vertexCount += geometry.attributes.position.count; indexCount += geometry.index.count; }
      const positions = new Float32Array(vertexCount * 3), normals = new Float32Array(vertexCount * 3), colors = new Float32Array(vertexCount * 3);
      const indices = new (vertexCount > 65535 ? Uint32Array : Uint16Array)(indexCount);
      const skinIndex = skinned ? new Uint8Array(vertexCount * 4) : null, skinWeight = skinned ? new Uint8Array(vertexCount * 4) : null;
      let v = 0, n = 0;
      for (const { geometry, color, bone } of this.parts) {
        const position = geometry.attributes.position, normal = geometry.attributes.normal, index = geometry.index;
        for (let i = 0; i < position.count; i++) {
          const o = (v + i) * 3;
          positions[o] = position.getX(i); positions[o + 1] = position.getY(i); positions[o + 2] = position.getZ(i);
          normals[o] = normal.getX(i); normals[o + 1] = normal.getY(i); normals[o + 2] = normal.getZ(i);
          colors[o] = color.r; colors[o + 1] = color.g; colors[o + 2] = color.b;
          if (skinned) { skinIndex[(v + i) * 4] = bone; skinWeight[(v + i) * 4] = 255; }
        }
        for (let i = 0; i < index.count; i++) indices[n + i] = index.getX(i) + v;
        v += position.count; n += index.count;
      }
      const merged = new T.BufferGeometry();
      merged.setAttribute('position', new T.BufferAttribute(positions, 3));
      merged.setAttribute('normal', new T.BufferAttribute(normals, 3));
      merged.setAttribute('color', new T.BufferAttribute(colors, 3));
      if (skinned) { merged.setAttribute('skinIndex', new T.Uint8BufferAttribute(skinIndex, 4)); merged.setAttribute('skinWeight', new T.Uint8BufferAttribute(skinWeight, 4, true)); }
      merged.setIndex(new T.BufferAttribute(indices, 1));
      merged.computeBoundingSphere();merged.computeBoundingBox();
      for (const part of this.parts) part.geometry.dispose();
      return merged;
    }
    mesh(material = toyMaterial) { const mesh = new T.Mesh(this.geometry(), material); mesh.castShadow = true; mesh.receiveShadow = true; return mesh; }
  }
  const toyMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .72, metalness: 0 });
  const glowMaterial = new T.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
  const metalMaterial = new T.MeshStandardMaterial({ vertexColors: true, roughness: .42, metalness: .45 });

  // ---- Palettes ----
  const skins = ['#ffe0bd', '#f6cfa3', '#e8b98a', '#d39a6a', '#a8714a', '#7b4f32', '#5a3a26'];
  const hairs = ['#2b1d14', '#4a2f1c', '#7b4a26', '#c98f3c', '#e8c46a', '#161616', '#9c2f2f', '#a8a8a8', '#ff7eb6', '#5c6cff', '#3fbf8f'];
  const tops = ['#ff5a5f', '#2ec4b6', '#ffbf3c', '#7b6cf6', '#1fb36d', '#ff7ab8', '#2f86eb', '#f07b3f', '#f4f1e8', '#3b3f4a', '#8fd3ff', '#b6e36b'];
  const bottoms = ['#2c3e5c', '#3a4f8f', '#1f2a44', '#6b4f3a', '#5b6370', '#c9c2b0', '#2f5b44', '#1b1b1f'];
  const shoesList = ['#25272c', '#f7f7f2', '#d94848', '#3d5af1', '#7a5236'];
  const suits = ['#2b3346', '#3b3b42', '#4a3a2e', '#1f2a3a', '#5b5f6b'];

  // Bones: 0 root, 1 head, 2 left arm, 3 left elbow, 4 right arm, 5 right elbow, 6 left leg, 7 left knee, 8 right leg, 9 right knee.
  // Realistic adult proportions: about 1.75 m tall and seven and a half heads high.
  const BONE = { root: 0, head: 1, lArm: 2, lElbow: 3, rArm: 4, rElbow: 5, lLeg: 6, lKnee: 7, rLeg: 8, rKnee: 9 };
  const HIP_Y = .93, KNEE_Y = .5, SHOULDER_Y = 1.41, ELBOW_Y = 1.13, WRIST_Y = .9, NECK_Y = 1.46, CY = 1.62;
  const casualTops = ['#3b5b8c', '#8c2f39', '#2f4f3f', '#d8d4ca', '#4a4a52', '#c9a26b', '#6b7f99', '#1f1f24', '#9c6b4e', '#e6e1d6', '#5c7d5a', '#b8473d', '#3f6f8f', '#e0b84a'];
  const casualBottoms = ['#2d3d5c', '#3c5a85', '#24262b', '#6b5a43', '#5a5e66', '#b9ad92', '#3f4a3a', '#4a3a30'];

  function hairCap(b, color, style) {
    const bone = BONE.head;
    if (style === 'bald') return;
    if (style === 'afro') { b.add(sphereCached(.13, 12, 9), color, { p: [0, CY + .04, .015], bone }); return; }
    b.add(sphereCached(.106, 20, 14), color, { p: [0, CY + .03, .012], s: [.95, .9, 1.06], bone });
    if (style === 'long') b.add(roundedBoxCached(.19, .26, .07, .03), color, { p: [0, CY - .08, .065], bone });
    if (style === 'bun') b.add(sphereCached(.045), color, { p: [0, CY + .1, .06], bone });
    if (style === 'ponytail') b.limb([0, CY + .05, .1], [0, CY - .14, .13], .026, color, bone);
    if (style === 'mohawk') b.add(roundedBoxCached(.03, .07, .19, .014), color, { p: [0, CY + .115, .01], bone });
    if (style === 'spiky') for (let i = 0; i < 5; i++) b.add(coneCached(.028, .07, 6), color, { p: [(i - 2) * .032, CY + .1, .01 + Math.abs(i - 2) * .01], r: [0, 0, (i - 2) * .25], bone });
  }
  function hat(b, kind, color) {
    const bone = BONE.head;
    if (kind === 'cap') { b.add(sphereCached(.108, 14, 8), color, { p: [0, CY + .035, .005], s: [.95, .62, 1.04], bone }); b.add(roundedBoxCached(.13, .012, .09, .006), color, { p: [0, CY + .045, -.13], bone }); }
    else if (kind === 'beanie') { b.add(sphereCached(.11, 14, 8), color, { p: [0, CY + .04, .005], s: [.95, .85, 1.04], bone }); }
    else if (kind === 'hardhat') { b.add(sphereCached(.115, 14, 8), '#f2b51b', { p: [0, CY + .04, 0], s: [1, .72, 1.08], bone }); b.add(cylinderCached(.145, .145, .014, 18), '#f2b51b', { p: [0, CY + .035, 0], s: [1, 1, 1.08], bone }); }
    else if (kind === 'chef') { b.add(cylinderCached(.1, .095, .1, 14), '#ffffff', { p: [0, CY + .13, 0], bone }); b.add(sphereCached(.12, 12, 8), '#ffffff', { p: [0, CY + .2, 0], s: [1, .6, 1], bone }); }
    else if (kind === 'cowboy') { b.add(cylinderCached(.19, .19, .014, 20), color, { p: [0, CY + .06, 0], bone }); b.add(roundedBoxCached(.15, .1, .13, .04), color, { p: [0, CY + .11, 0], bone }); }
    else if (kind === 'tophat') { b.add(cylinderCached(.15, .15, .012, 20), '#1d1d22', { p: [0, CY + .07, 0], bone }); b.add(cylinderCached(.085, .09, .17, 16), '#1d1d22', { p: [0, CY + .15, 0], bone }); }
    else if (kind === 'police') { b.add(cylinderCached(.115, .1, .06, 16), '#1f3a7a', { p: [0, CY + .085, 0], bone }); b.add(roundedBoxCached(.12, .012, .07, .006), '#111111', { p: [0, CY + .06, -.1], bone }); b.add(sphereCached(.016), '#d9b23a', { p: [0, CY + .095, -.115], bone }); }
  }

  // ---- People ----
  const STYLES = ['casual', 'casual', 'casual', 'hoodie', 'suit', 'worker', 'tourist', 'jogger', 'elder', 'punk', 'dress'];
  function person(seed = 1, options = {}) {
    const style = options.style || pick(STYLES, seed + 1), b = new Builder();
    const skin = pick(skins, seed + 2), shoes = pick(['#25272c', '#3b2c22', '#f2f0ea', '#5a5e66', '#7a5236'], seed + 5);
    let hair = pick(hairs.slice(0, style === 'punk' ? 11 : 7), seed + 3);
    let top = pick(casualTops, seed + 4), bottom = pick(casualBottoms, seed + 6), longSleeves = random(seed + 7) > .45, shorts = false, skirt = false;
    let hairStyle = pick(['short', 'short', 'short', 'long', 'bun', 'ponytail', 'afro', 'bald'], seed + 8), headwear = null, hatColor = pick(casualTops, seed + 9);
    const feminine = style === 'dress' || (style !== 'cop' && style !== 'brute' && random(seed + 31) > .5), w = style === 'brute' ? 1.35 : 1 + (random(seed + 10) > .75 ? .16 : 0) + random(seed + 11) * .06;
    if (feminine && hairStyle === 'bald') hairStyle = 'long';
    if (style === 'suit') { top = pick(suits, seed + 12); bottom = top; longSleeves = true; if (hairStyle === 'afro') hairStyle = 'short'; }
    if (style === 'hoodie') { longSleeves = true; top = pick(['#4a4a52', '#2d3d5c', '#8c2f39', '#2f4f3f', '#c9c3b6', '#1f1f24'], seed + 32); }
    if (style === 'worker') { top = '#e8742a'; bottom = '#2d3d5c'; headwear = 'hardhat'; longSleeves = false; }
    if (style === 'tourist') { top = pick(['#d94f4f', '#e0b84a', '#3fa7a0', '#e07aa8'], seed + 13); shorts = true; headwear = random(seed + 14) > .5 ? 'cap' : null; }
    if (style === 'jogger') { shorts = true; longSleeves = false; top = pick(['#2f9e5c', '#2f6fd9', '#d94f4f', '#9cc94a'], seed + 15); }
    if (style === 'elder') { hair = '#cfcfcf'; hairStyle = random(seed + 16) > .5 ? 'bald' : 'short'; top = pick(['#7a6a8a', '#6d7f6a', '#8a6f55', '#5c6f8a'], seed + 17); longSleeves = true; headwear = random(seed + 18) > .7 ? 'tophat' : null; }
    if (style === 'punk') { top = '#1b1b1f'; bottom = '#2c2c34'; hairStyle = 'mohawk'; hair = pick(['#ff3fa4', '#3fd98f', '#5c6cff', '#ff5a1f'], seed + 19); longSleeves = false; }
    if (style === 'dress') { skirt = true; if (hairStyle === 'bald') hairStyle = 'long'; }
    if (style === 'chef' || style === 'vendor') { top = '#f2f0ea'; bottom = '#2d3d5c'; headwear = style === 'chef' ? 'chef' : 'cap'; hatColor = '#b8473d'; }
    if (style === 'doctor') { top = '#eef2f6'; bottom = '#5b86c9'; longSleeves = true; }
    if (style === 'cop') { top = '#22417f'; bottom = '#1f2a44'; headwear = 'police'; longSleeves = true; hairStyle = 'short'; }
    if (style === 'thug' || style === 'brute' || style === 'gunner') { top = pick(['#1b1b1f', '#2a2a30', '#3a1f24', '#1f2a24'], seed + 34); bottom = '#26262c'; longSleeves = true; headwear = random(seed + 35) > .4 ? 'beanie' : null; hatColor = '#16161a'; if (hairStyle === 'long') hairStyle = 'short'; }
    if (!headwear && random(seed + 20) > .85) headwear = pick(['cap', 'beanie'], seed + 21);
    const sleeve = longSleeves ? top : skin, chestWidth = (feminine ? .33 : .37) * w;
    // Legs and feet.
    for (const [side, legBone, kneeBone] of [[-1, BONE.lLeg, BONE.lKnee], [1, BONE.rLeg, BONE.rKnee]]) {
      const x = side * .095, lower = shorts || skirt ? skin : bottom;
      const thigh = .082 * w, knee = .052, ankle = .036;
      b.taper([x, HIP_Y + .02, 0], [x, KNEE_Y, 0], thigh, knee, bottom, legBone, 14);
      b.add(sphereCached(thigh, 14, 10), bottom, { p: [x, HIP_Y + .02, 0], s: [1, .8, 1], bone: legBone });
      if (shorts) b.taper([x, .72, 0], [x, KNEE_Y, 0], .068, knee, skin, legBone, 14);
      b.add(sphereCached(knee, 14, 10), lower, { p: [x, KNEE_Y, 0], bone: kneeBone });
      b.taper([x, KNEE_Y, 0], [x, .1, 0], knee, ankle, lower, kneeBone, 14);
      b.ellipsoid([x, .44, .012], [x, .2, .012], .05, .052, lower, kneeBone, 1);
      b.add(sphereCached(ankle, 12, 8), lower, { p: [x, .1, 0], bone: kneeBone });
      b.add(roundedBoxCached(.095, .075, .25, .035), shoes, { p: [x, .04, -.055], bone: kneeBone });
    }
    // Pelvis, torso and neck.
    // One smooth lathed torso: hips, waist, chest and sloping shoulders.
    const hipR = (feminine ? .168 : .158) * w, waistR = (feminine ? .135 : .148) * w, chestR = chestWidth / 2;
    b.lathe([[0, .895], [hipR * .9, .9], [hipR, .94], [waistR * 1.0, 1.0], [waistR * .97, 1.03]], bottom, { depth: .6 });
    b.lathe([[0, .97], [waistR * 1.04, .975], [waistR * 1.03, 1.0], [waistR, 1.07], [waistR * 1.06, 1.14], [chestR * .96, 1.24], [chestR, 1.32], [chestR * .95, 1.39], [chestR * .72, 1.44], [.075, 1.465], [0, 1.47]], top, { depth: .6 });
    if (skirt) b.lathe([[0, .56], [hipR * 1.2, .565], [hipR * 1.32, .58], [hipR * 1.18, .74], [hipR * 1.04, .9], [hipR * .98, 1.0]], bottom, { depth: .7 });
    b.ellipsoid([0, 1.42, .004], [0, 1.56, 0], .05, .052, skin);
    if (style === 'suit') {
      b.add(roundedBoxCached(.07, .2, .01, .005), '#f2f0ea', { p: [0, 1.36, -.106 * w] });
      b.add(roundedBoxCached(.028, .2, .01, .005), pick(['#8c2f39', '#2f5c9e', '#c9a26b', '#4a3a6b'], seed + 22), { p: [0, 1.33, -.112 * w] });
    }
    if (style === 'hoodie') b.add(torusCached(.075, .03, 6, 14), top, { p: [0, 1.45, .05], r: [Math.PI / 2.3, 0, 0] });
    if (style === 'worker') for (const y of [1.12, 1.28]) b.add(roundedBoxCached(chestWidth + .01, .025, .22 * w, .01), '#d9ff4a', { p: [0, y, 0] });
    if (style === 'chef' || style === 'vendor' || style === 'doctor') b.add(roundedBoxCached(chestWidth * .9, .62, .012, .006), '#ffffff', { p: [0, 1.1, -.108 * w] });
    if (style === 'cop') { b.add(roundedBoxCached(.04, .045, .01, .005), '#d9b23a', { p: [-.08, 1.36, -.108 * w] }); b.add(roundedBoxCached(.33 * w, .04, .21 * w, .015), '#111111', { p: [0, .99, 0] }); }
    // Arms and hands.
    for (const [side, armBone, elbowBone] of [[-1, BONE.lArm, BONE.lElbow], [1, BONE.rArm, BONE.rElbow]]) {
      const x = side * (chestWidth / 2 + .005);
      const forearm = longSleeves ? sleeve : skin;
      const upper = .047 * Math.min(w, 1.1), elbow = .038, wrist = .028;
      b.add(sphereCached(.05, 14, 10), top, { p: [x - side * .018, SHOULDER_Y - .025, 0], s: [1.05, .85, .95], bone: armBone });
      b.taper([x, SHOULDER_Y - .02, 0], [x, ELBOW_Y, 0], upper, elbow, longSleeves ? sleeve : skin, armBone, 14);
      if (!longSleeves) b.taper([x, SHOULDER_Y - .02, 0], [x, SHOULDER_Y - .13, 0], upper + .004, upper + .001, top, armBone, 14);
      b.add(sphereCached(elbow, 12, 8), forearm, { p: [x, ELBOW_Y, 0], bone: elbowBone });
      b.taper([x, ELBOW_Y, 0], [x, WRIST_Y, 0], elbow, wrist, forearm, elbowBone, 14);
      b.add(sphereCached(wrist, 10, 8), skin, { p: [x, WRIST_Y, 0], bone: elbowBone });
      b.ellipsoid([x, WRIST_Y - .005, -.004], [x, .76, -.012], .022, .042, skin, elbowBone, 1);
      b.ellipsoid([x - side * .022, .875, -.025], [x - side * .026, .82, -.04], .011, .011, skin, elbowBone, 1);
    }
    // Head and face.
    b.add(sphereCached(.1, 22, 16), skin, { p: [0, CY, 0], s: [.92, 1.13, 1.02], bone: BONE.head });
    b.add(sphereCached(.032, 12, 8), skin, { p: [0, CY - .088, -.044], s: [1.15, .75, 1], bone: BONE.head });
    for (const side of [-1, 1]) {
      b.add(sphereCached(.014, 10, 8), '#f4f1ea', { p: [side * .034, CY + .012, -.09], s: [1.2, .8, .6], bone: BONE.head });
      b.add(sphereCached(.0075, 8, 6), '#2a1e17', { p: [side * .034, CY + .012, -.096], s: [1, 1, .6], bone: BONE.head });
      b.add(roundedBoxCached(.036, .008, .01, .003), hairStyle === 'bald' || style === 'elder' ? '#6b5a4a' : hair, { p: [side * .036, CY + .036, -.092], r: [0, 0, side * -.08], bone: BONE.head });
      b.add(sphereCached(.02, 6, 5), skin, { p: [side * .092, CY + .004, .006], s: [.55, 1.15, .9], bone: BONE.head });
    }
    b.add(sphereCached(.011, 10, 8), skin, { p: [0, CY - .014, -.1], s: [.9, 1.7, 1.2], bone: BONE.head });
    b.add(sphereCached(.02, 12, 6), '#a85e56', { p: [0, CY - .056, -.087], s: [1, .28, .4], bone: BONE.head });
    if (!feminine && random(seed + 24) > .82) b.add(sphereCached(.06, 14, 10), hair, { p: [0, CY - .07, -.028], s: [1.25, .75, 1.15], bone: BONE.head });
    if (random(seed + 25) > .8 || style === 'doctor') for (const side of [-1, 1]) b.add(torusCached(.019, .004, 5, 12), '#1b1b20', { p: [side * .035, CY + .012, -.1], bone: BONE.head });
    if (style === 'thug' || style === 'brute' || style === 'gunner') b.add(sphereCached(.1, 16, 10), '#a3242c', { p: [0, CY - .05, -.012], s: [.96, .5, 1.04], bone: BONE.head });
    hairCap(b, hair, headwear === 'hardhat' || headwear === 'chef' || headwear === 'police' ? 'bald' : hairStyle);
    if (headwear) hat(b, headwear, hatColor);
    // Accessories, held in the right or left hand where it makes sense.
    const hand = chestWidth / 2 + .005;
    const extra = style === 'thug' || style === 'brute' || style === 'gunner' ? null : options.accessory ?? (style === 'suit' ? 'briefcase' : style === 'tourist' ? 'camera' : style === 'elder' && random(seed + 33) > .5 ? 'cane' : random(seed + 26) > .78 ? pick(['backpack', 'coffee', 'bag', 'phone'], seed + 27) : null);
    if (extra === 'briefcase') { b.add(roundedBoxCached(.36, .27, .09, .015), '#4a3222', { p: [hand, .62, 0], r: [0, Math.PI / 2, 0], bone: BONE.rElbow }); b.add(torusCached(.035, .008, 4, 10, Math.PI), '#2b1d14', { p: [hand, .76, 0], r: [0, Math.PI / 2, 0], bone: BONE.rElbow }); }
    if (extra === 'camera') { b.add(roundedBoxCached(.12, .08, .06, .015), '#222428', { p: [0, 1.22, -.14 * w] }); b.add(cylinderCached(.03, .03, .045, 10), '#444850', { p: [0, 1.22, -.18 * w], r: [Math.PI / 2, 0, 0] }); }
    if (extra === 'backpack') b.add(roundedBoxCached(.28 * w, .38, .14, .05), pick(casualTops, seed + 28), { p: [0, 1.22, .17 * w] });
    if (extra === 'coffee') { b.add(cylinderCached(.033, .028, .11, 10), '#f2f0ea', { p: [-hand, .8, -.06], bone: BONE.lElbow }); b.add(cylinderCached(.035, .035, .015, 10), '#2b5a3f', { p: [-hand, .86, -.06], bone: BONE.lElbow }); }
    if (extra === 'bag') b.add(roundedBoxCached(.28, .3, .1, .03), pick(['#c9b38a', '#7a2f3f', '#2f4f5f'], seed + 29), { p: [hand + .04, .62, 0], r: [0, Math.PI / 2, 0], bone: BONE.rElbow });
    if (extra === 'phone') b.add(roundedBoxCached(.07, .14, .01, .006), '#1b1b20', { p: [-hand, .84, -.07], r: [.7, 0, 0], bone: BONE.lElbow });
    if (style === 'gunner') { b.add(roundedBoxCached(.03, .05, .17, .01), '#1a1a1e', { p: [hand, .78, -.08], bone: BONE.rElbow }); b.add(roundedBoxCached(.03, .1, .04, .01), '#1a1a1e', { p: [hand, .74, -.02], bone: BONE.rElbow }); }
    if (style === 'brute') b.add(roundedBoxCached(.06, .06, .5, .02), '#5a3b26', { p: [hand, .78, -.2], r: [.3, 0, 0], bone: BONE.rElbow });
    if (extra === 'cane') b.rod([hand, .82, -.06], [hand, .02, -.12], .012, '#4a3222', BONE.rElbow);
    if (extra === 'sign') { b.rod([hand, .82, 0], [hand, 2.25, 0], .018, '#8a6a48', BONE.rElbow); b.add(roundedBoxCached(.7, .45, .025, .01), '#f2eedd', { p: [hand, 2.3, 0], bone: BONE.rElbow }); }

    // Skeleton: the bones are named like the old limb pivots, so existing animation code still works.
    const bones = Array.from({ length: 10 }, () => new T.Bone());
    const [root, head, lArm, lElbow, rArm, rElbow, lLeg, lKnee, rLeg, rKnee] = bones;
    const shoulderX = chestWidth / 2 + .005;
    head.position.set(0, NECK_Y, 0); lArm.position.set(-shoulderX, SHOULDER_Y, 0); rArm.position.set(shoulderX, SHOULDER_Y, 0);
    lElbow.position.set(0, ELBOW_Y - SHOULDER_Y, 0); rElbow.position.set(0, ELBOW_Y - SHOULDER_Y, 0);
    lLeg.position.set(-.095, HIP_Y, 0); rLeg.position.set(.095, HIP_Y, 0); lKnee.position.set(0, KNEE_Y - HIP_Y, 0); rKnee.position.set(0, KNEE_Y - HIP_Y, 0);
    root.add(head, lArm, rArm, lLeg, rLeg); lArm.add(lElbow); rArm.add(rElbow); lLeg.add(lKnee); rLeg.add(rKnee);
    const mesh = new T.SkinnedMesh(b.geometry(true), toyMaterial);
    mesh.add(root); mesh.castShadow = true; mesh.updateMatrixWorld(true); mesh.bind(new T.Skeleton(bones));
    mesh.geometry.boundingSphere.radius += .6;
    const scale = options.kid ? .66 : (feminine ? .93 : .98) + random(seed + 30) * .08;
    mesh.scale.setScalar(scale);
    lLeg.userData.knee = lKnee; rLeg.userData.knee = rKnee; lArm.userData.elbow = lElbow; rArm.userData.elbow = rElbow;
    return { mesh, head, leftArm: lArm, rightArm: rArm, leftLeg: lLeg, rightLeg: rLeg, style, top, scale };
  }

  // ---- Trees and props ----
  function tree(seed = 1, kind = null) {
    const b = new Builder(), type = kind || pick(['round', 'round', 'tall', 'pine', 'cluster'], seed);
    const height = 2.4 + random(seed + 1) * 1.6, leaf = pick(['#4caf50', '#5cc46a', '#3e9b54', '#7bcf5a', '#2f8f62'], seed + 2), leaf2 = pick(['#6bd46f', '#8be07a', '#4fbf6f'], seed + 3);
    b.add(cylinderCached(.14, .2, height, 8), '#8a5a3c', { p: [0, height / 2, 0] });
    if (type === 'pine') for (let i = 0; i < 3; i++) b.add(coneCached(1.5 - i * .35, 1.7, 9), i % 2 ? leaf2 : leaf, { p: [0, height - .3 + i * .9, 0] });
    else if (type === 'tall') { b.add(sphereCached(1.05, 10, 8), leaf, { p: [0, height + .9, 0], s: [1, 1.5, 1] }); }
    else if (type === 'cluster') for (let i = 0; i < 4; i++) { const a = i * 2.1 + seed; b.add(sphereCached(.75 + random(seed + i) * .3, 10, 8), i % 2 ? leaf2 : leaf, { p: [Math.cos(a) * .55, height + .4 + random(seed + i + 9) * .6, Math.sin(a) * .55] }); }
    else { b.add(sphereCached(1.35, 12, 9), leaf, { p: [0, height + .75, 0] }); b.add(sphereCached(.8, 10, 8), leaf2, { p: [.5, height + 1.4, -.3] }); }
    return { mesh: b.mesh(), height: height + 1.6 };
  }
  function hydrant() {
    const b = new Builder(), red = '#e53935';
    b.add(cylinderCached(.17, .2, .55, 12), red, { p: [0, .28, 0] }); b.add(sphereCached(.17, 12, 8), red, { p: [0, .56, 0], s: [1, .7, 1] });
    b.add(cylinderCached(.05, .05, .08, 8), '#ffd23f', { p: [0, .68, 0] }); b.add(roundedBoxCached(.5, .12, .12, .05), red, { p: [0, .38, 0] });
    b.add(cylinderCached(.22, .22, .06, 12), '#c62828', { p: [0, .03, 0] });
    return b.mesh();
  }
  function bench(color = '#3f8f5a') {
    const b = new Builder();
    for (let i = 0; i < 3; i++) b.add(roundedBoxCached(1.9, .07, .17, .03), color, { p: [0, .5, -.2 + i * .19] });
    for (let i = 0; i < 2; i++) b.add(roundedBoxCached(1.9, .14, .06, .03), color, { p: [0, .72 + i * .2, .33] });
    for (const x of [-.75, .75]) { b.add(roundedBoxCached(.08, .5, .5, .03), '#2b2f36', { p: [x, .25, 0] }); b.add(roundedBoxCached(.08, .6, .08, .03), '#2b2f36', { p: [x, .75, .34] }); }
    return b.mesh();
  }
  function trashCan() { const b = new Builder(); b.add(cylinderCached(.28, .24, .66, 12), '#2f8f62', { p: [0, .33, 0] }); b.add(cylinderCached(.3, .3, .06, 12), '#1f6e47', { p: [0, .68, 0] }); return b.mesh(); }

  // ---- First-person glove: chunky toy mitt and sleeve along a forearm axis ----
  function glove(elbow, wrist, tip, side) {
    const b = new Builder(), red = '#e8323c', blue = '#2346a8', web = '#1b1b24';
    const e = new T.Vector3(...elbow), w = new T.Vector3(...wrist), t = new T.Vector3(...tip), axis = t.clone().sub(w).normalize();
    b.limb(e.toArray(), w.toArray(), .085, blue);
    b.limb(e.clone().lerp(w, .55).toArray(), w.toArray(), .092, red);
    const palmCenter = w.clone().addScaledVector(axis, .07), q = new T.Quaternion().setFromUnitVectors(up, axis);
    b.add(roundedBoxCached(.15, .14, .08, .035), red, { p: palmCenter.toArray(), q });
    const across = new T.Vector3(1, 0, 0).applyQuaternion(q), outward = new T.Vector3(0, 0, 1).applyQuaternion(q);
    for (let i = 0; i < 4; i++) {
      const base = palmCenter.clone().addScaledVector(axis, .06).addScaledVector(across, (i - 1.5) * .036);
      b.limb(base.toArray(), base.clone().addScaledVector(axis, .085 - Math.abs(i - 1.5) * .012).toArray(), .017, red);
    }
    const thumb = palmCenter.clone().addScaledVector(across, -side * .085).addScaledVector(outward, .02);
    b.limb(thumb.toArray(), thumb.clone().addScaledVector(axis, .06).addScaledVector(across, -side * .02).toArray(), .02, red);
    for (let i = 0; i < 3; i++) b.add(torusCached(.088, .006, 4, 18), web, { p: e.clone().lerp(w, .6 + i * .13).toArray(), q: new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), axis) });
    return b.mesh();
  }

  return { Builder, metalMaterial, roundedBox, sphere, cylinder, cone, capsule, torus, toyMaterial, glowMaterial, person, tree, hydrant, bench, trashCan, glove, random, pick, palettes: { skins, hairs, tops, bottoms } };
})();
