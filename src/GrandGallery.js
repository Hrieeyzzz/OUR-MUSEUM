import * as THREE from "three";
import { PHOTO_BAYS } from "./photoLayout";
import { museumSpeakerPositions } from "./MuseumSound";

// All architecture is real geometry. Repeated mouldings, balusters, and columns
// are instanced so the richer room remains usable on mobile devices.
export function buildGrandGallery(
  scene,
  { depth, hero, renderer, onTextureLoad },
) {
  let seed = 9417;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const textures = [];
  function canvasTexture(draw, size = 1024) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    draw(canvas.getContext("2d"), size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
    textures.push(texture);
    return texture;
  }
  const limestoneMap = canvasTexture((c, s) => {
    c.fillStyle = "#c8b693";
    c.fillRect(0, 0, s, s);
    const pixels = c.getImageData(0, 0, s, s);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const n = (random() - 0.5) * 13;
      pixels.data[i] += n;
      pixels.data[i + 1] += n;
      pixels.data[i + 2] += n;
    }
    c.putImageData(pixels, 0, 0);
    for (let i = 0; i < 55; i++) {
      c.strokeStyle = `rgba(115,91,61,${0.015 + random() * 0.025})`;
      c.lineWidth = 0.5 + random() * 2;
      c.beginPath();
      const y = random() * s;
      c.moveTo(0, y);
      c.bezierCurveTo(s * 0.3, y - 80, s * 0.7, y + 120, s, y + 30);
      c.stroke();
    }
  });
  const marbleMap = canvasTexture((c, s) => {
    c.fillStyle = "#cfc4ac";
    c.fillRect(0, 0, s, s);
    for (let i = 0; i < 180; i++) {
      const y = random() * s,
        thick = random() * 5;
      c.strokeStyle = `rgba(106,91,65,${random() * 0.12})`;
      c.lineWidth = thick;
      c.beginPath();
      c.moveTo(-20, y);
      c.bezierCurveTo(s * 0.3, y + 100, s * 0.55, y - 190, s + 20, y + 210);
      c.stroke();
    }
  });
  const parquetMap = new THREE.TextureLoader().load(
    "/textures/oak-parquet.jpg",
    onTextureLoad,
  );
  parquetMap.colorSpace = THREE.SRGBColorSpace;
  parquetMap.wrapS = parquetMap.wrapT = THREE.RepeatWrapping;
  parquetMap.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  textures.push(parquetMap);
  parquetMap.repeat.set(2, (depth + 7) / 7);
  limestoneMap.repeat.set(2, 2);
  const wall = new THREE.MeshStandardMaterial({
    color: "#d7c3b7",
    map: limestoneMap,
    bumpMap: limestoneMap,
    bumpScale: 0.015,
    roughness: 0.88,
  });
  const stone = new THREE.MeshStandardMaterial({
    color: "#e8d7c6",
    map: marbleMap,
    bumpMap: marbleMap,
    bumpScale: 0.008,
    roughness: 0.57,
  });
  const darkStone = new THREE.MeshStandardMaterial({
    color: "#9d8864",
    map: limestoneMap,
    roughness: 0.65,
  });
  const gold = new THREE.MeshStandardMaterial({
    color: "#aa8744",
    metalness: 0.76,
    roughness: 0.29,
  });
  const bronze = new THREE.MeshStandardMaterial({
    color: "#433723",
    metalness: 0.78,
    roughness: 0.32,
  });
  const walnut = new THREE.MeshStandardMaterial({
    color: "#49301b",
    roughness: 0.34,
    metalness: 0.02,
  });
  const ceiling = new THREE.MeshStandardMaterial({
    color: "#706047",
    map: limestoneMap,
    roughness: 0.83,
  });
  const panelMat = new THREE.MeshStandardMaterial({
    color: "#aa9673",
    map: limestoneMap,
    roughness: 0.94,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: "#fff1cd",
    emissive: "#ffcf84",
    emissiveIntensity: 3,
    roughness: 0.3,
  });
  const glass = new THREE.MeshStandardMaterial({
    color: "#d9e5e3",
    emissive: "#bdcbd0",
    emissiveIntensity: 0.55,
    roughness: 0.25,
  });
  const floorMat = new THREE.MeshPhysicalMaterial({
    map: parquetMap,
    roughness: 0.38,
    clearcoat: 0.3,
    clearcoatRoughness: 0.36,
    bumpMap: parquetMap,
    bumpScale: 0.008,
    envMapIntensity: 0.6,
  });
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.22, depth + 7),
    floorMat,
  );
  floor.position.set(0, -0.13, (depth - 7) / 2);
  floor.receiveShadow = true;
  floor.userData.floor = true;
  scene.add(floor);

  const cube = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(1, 1, 1, 24);
  const sphere = new THREE.SphereGeometry(1, 12, 8);
  const torus = new THREE.TorusGeometry(1, 0.1, 8, 40);
  const batches = new Map();
  const dummy = new THREE.Object3D();
  function instance(
    geometry,
    material,
    x,
    y,
    z,
    sx = 1,
    sy = 1,
    sz = 1,
    rx = 0,
    ry = 0,
    rz = 0,
  ) {
    const key = geometry.uuid + material.uuid;
    if (!batches.has(key))
      batches.set(key, { geometry, material, matrices: [] });
    dummy.position.set(x, y, z);
    dummy.scale.set(sx, sy, sz);
    dummy.rotation.set(rx, ry, rz);
    dummy.updateMatrix();
    batches.get(key).matrices.push(dummy.matrix.clone());
  }
  const box = (w, h, d, mat, x, y, z) => instance(cube, mat, x, y, z, w, h, d);
  const round = (r, h, mat, x, y, z) =>
    instance(cylinder, mat, x, y, z, r, h, r);
  function moulding(x, y, z, width, height, mat, side = false) {
    // Layered rectangular surrounds, mounted flat against a wall.
    const b = (w, h, dx, dy) =>
      side
        ? box(0.09, h, w, mat, x, y + dy, z + dx)
        : box(w, h, 0.09, mat, x + dx, y + dy, z);
    b(width, 0.1, 0, height / 2);
    b(width, 0.1, 0, -height / 2);
    b(0.1, height, -width / 2, 0);
    b(0.1, height, width / 2, 0);
  }
  // Full-height stone shell, skirting, dado rail, and layered entablature.
  const middle = (depth - 6) / 2,
    length = depth + 6;
  box(18.4, 11.5, 0.35, wall, 0, 5.7, -6.2);
  for (const side of [-1, 1]) {
    box(0.3, 11.5, length, wall, side * 9, 5.7, middle);
    for (const [y, h, d, mat] of [
      [0.12, 0.24, 0.26, darkStone],
      [0.32, 0.15, 0.19, stone],
      [1.1, 0.1, 0.16, stone],
      [5.45, 0.16, 0.32, stone],
      [5.68, 0.2, 0.48, stone],
      [10.5, 0.13, 0.3, gold],
      [10.72, 0.23, 0.48, stone],
      [10.97, 0.15, 0.65, stone],
    ])
      box(d, h, length, mat, side * (8.93 - d / 2), y, middle);
  }
  for (const [y, h, d, mat] of [
    [0.12, 0.24, 0.26, darkStone],
    [0.32, 0.15, 0.2, stone],
    [1.1, 0.1, 0.16, stone],
    [5.45, 0.16, 0.32, stone],
    [5.68, 0.2, 0.48, stone],
    [10.5, 0.13, 0.3, gold],
    [10.72, 0.23, 0.48, stone],
    [10.97, 0.15, 0.65, stone],
  ])
    box(18, h, d, mat, 0, y, -6 + d / 2);
  if (!hero) box(18, 11.5, 0.25, wall, 0, 5.7, depth + 0.2);
  // Polished stone aisles and black-and-brass floor inlay.
  for (const side of [-1, 1]) {
    box(1.5, 0.025, length, stone, side * 8.12, 0.005, middle);
    box(0.065, 0.03, length, bronze, side * 7.34, 0.008, middle);
    box(0.035, 0.031, length, gold, side * 7.25, 0.01, middle);
    box(0.09, 0.03, length, walnut, side * 6.95, 0.008, middle);
  }
  box(14.6, 0.025, 1.1, stone, 0, 0.004, -5.4);
  box(14.6, 0.026, 0.065, bronze, 0, 0.008, -4.8);

  // Fluted, tapering Corinthian-inspired columns with carved capitals.
  const shaft = new THREE.CylinderGeometry(0.3, 0.38, 8.95, 64, 1);
  const positions = shaft.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i),
      a = Math.atan2(z, x);
    const f = 1 + 0.026 * Math.cos(a * 20);
    positions.setX(i, x * f);
    positions.setZ(i, z * f);
  }
  shaft.computeVertexNormals();
  function column(x, z) {
    box(0.94, 0.18, 0.94, darkStone, x, 0.09, z);
    box(0.85, 0.12, 0.85, stone, x, 0.24, z);
    round(0.46, 0.13, stone, x, 0.36, z);
    round(0.41, 0.11, stone, x, 0.48, z);
    instance(shaft, stone, x, 5.02, z);
    round(0.34, 0.09, gold, x, 9.52, z);
    round(0.4, 0.12, stone, x, 9.62, z);
    box(0.92, 0.16, 0.92, stone, x, 10.1, z);
    box(1.04, 0.12, 1.04, stone, x, 10.26, z);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      instance(
        sphere,
        stone,
        x + Math.cos(a) * 0.32,
        9.84,
        z + Math.sin(a) * 0.32,
        0.12,
        0.26,
        0.12,
        0,
        0,
        0.35,
      );
    }
    for (const xx of [-1, 1])
      for (const zz of [-1, 1])
        instance(
          torus,
          stone,
          x + xx * 0.33,
          9.99,
          z + zz * 0.33,
          0.14,
          0.14,
          0.14,
          Math.PI / 2,
          0,
          0,
        );
  }
  // Columns separate the photo bays, never covering the photographs.
  for (let z = PHOTO_BAYS.firstColumn; z < depth; z += PHOTO_BAYS.spacing)
    for (const side of [-1, 1]) column(side * 7.85, z);
  for (const x of [-8.2, -3.15, 3.15, 8.2]) column(x, -5.45);

  // Upper-level galleries: stone balustrades, bronze handrails, turned spindles.
  const balusterProfile = [
    [0.065, 0],
    [0.075, 0.06],
    [0.045, 0.12],
    [0.085, 0.23],
    [0.07, 0.36],
    [0.04, 0.49],
    [0.05, 0.64],
    [0.075, 0.7],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const baluster = new THREE.LatheGeometry(balusterProfile, 10);
  for (const side of [-1, 1]) {
    box(1.45, 0.24, length, stone, side * 8.1, 5.65, middle);
    box(0.3, 0.13, length, darkStone, side * 7.4, 5.85, middle);
    box(0.28, 0.13, length, stone, side * 7.4, 6.65, middle);
    box(0.065, 0.055, length, bronze, side * 7.4, 6.77, middle);
    for (let z = -5.4; z < depth; z += 0.32)
      instance(baluster, stone, side * 7.4, 5.9, z);
    for (let z = PHOTO_BAYS.firstColumn; z < depth; z += PHOTO_BAYS.spacing) {
      box(0.46, 1.0, 0.46, stone, side * 7.4, 6.2, z);
      box(0.53, 0.11, 0.53, darkStone, side * 7.4, 6.73, z);
    }
    // Glazed upper windows and recessed ornamental stone panels.
    for (
      let z = PHOTO_BAYS.firstCenter;
      z < depth - 1;
      z += PHOTO_BAYS.spacing
    ) {
      box(0.045, 2.75, 1.68, glass, side * 8.8, 8.38, z);
      moulding(side * 8.72, 8.38, z, 1.94, 3.03, stone, true);
      moulding(side * 8.66, 8.38, z, 2.12, 3.21, darkStone, true);
      box(0.08, 2.76, 0.055, stone, side * 8.69, 8.38, z);
      for (const y of [7.55, 8.38, 9.2])
        box(0.08, 0.05, 1.68, stone, side * 8.68, y, z);
      for (const dz of [-0.55, 0.55])
        box(0.08, 2.76, 0.035, stone, side * 8.68, 8.38, z + dz);
      // Wall panels below the balcony add real depth and contact shadows.
      moulding(side * 8.76, 3.1, z, 3.1, 4.1, darkStone, true);
    }
  }
  // Elaborate focal wall above the centrepiece, with a classical pediment.
  box(5.9, 3.65, 0.12, panelMat, 0, 7.95, -5.92);
  moulding(0, 7.95, -5.8, 5.95, 3.68, stone);
  moulding(0, 7.95, -5.72, 5.55, 3.28, darkStone);
  moulding(0, 7.95, -5.64, 5.35, 3.08, gold);
  for (const x of [-5.62, 5.62]) {
    box(2.65, 2.8, 0.05, panelMat, x, 8.1, -5.94);
    moulding(x, 8.1, -5.83, 2.85, 3.0, stone);
    instance(torus, gold, x, 8.12, -5.68, 0.59, 0.78, 0.1);
  }
  // Raised decorative crest and radial acanthus-like leaves.
  instance(torus, stone, 0, 10.05, -5.42, 0.58, 0.72, 0.22);
  instance(sphere, darkStone, 0, 10.05, -5.52, 0.46, 0.6, 0.1);
  for (let i = 0; i < 14; i++) {
    const a = (i / 13) * Math.PI;
    instance(
      sphere,
      stone,
      Math.cos(a) * 1.35,
      9.65 + Math.sin(a) * 0.7,
      -5.57,
      0.28,
      0.095,
      0.1,
      0,
      0,
      a,
    );
  }
  // A coffered ceiling: recessed squares, carved beams, gilt trim and rosettes.
  box(18.2, 0.22, length, ceiling, 0, 11.28, middle);
  for (let z = -4.2; z < depth; z += 3.8) {
    box(18, 0.21, 0.24, stone, 0, 11.08, z - 1.9);
    box(18, 0.035, 0.055, gold, 0, 10.95, z - 1.9);
    for (const x of [-6, -2, 2, 6]) {
      box(3.48, 0.06, 3.15, panelMat, x, 11.13, z);
      for (const xx of [-1.76, 1.76])
        box(0.1, 0.16, 3.44, stone, x + xx, 11.03, z);
      for (const zz of [-1.63, 1.63])
        box(3.57, 0.16, 0.1, stone, x, 11.03, z + zz);
      instance(torus, gold, x, 11.02, z, 0.25, 0.25, 0.14, Math.PI / 2);
      round(0.12, 0.035, gold, x, 10.99, z);
    }
  }
  for (const x of [-8, -4, 0, 4, 8])
    box(0.17, 0.22, length, stone, x, 11.03, middle);
  // Brass chandeliers, luminous opal bulbs, ceiling downlights and sconces.
  for (let z = -0.7; z < Math.min(depth, 19); z += 7.6) {
    round(0.025, 1.35, bronze, 0, 10.35, z);
    instance(torus, gold, 0, 9.58, z, 0.9, 0.9, 0.9, Math.PI / 2);
    round(0.1, 0.42, gold, 0, 9.55, z);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4,
        x = Math.cos(a) * 0.9,
        zz = z + Math.sin(a) * 0.9;
      instance(
        cylinder,
        gold,
        x / 2,
        9.58,
        (zz + z) / 2,
        0.022,
        0.9,
        0.022,
        0,
        -a,
        Math.PI / 2,
      );
      round(0.07, 0.15, gold, x, 9.65, zz);
      instance(sphere, glow, x, 9.83, zz, 0.085, 0.14, 0.085);
    }
    const light = new THREE.PointLight("#ffddb0", 50, 15, 2);
    light.position.set(0, 9.4, z);
    scene.add(light);
  }
  for (const x of [-5.5, 0, 5.5]) {
    round(0.14, 0.035, bronze, x, 10.91, -3.5);
    round(0.095, 0.04, glow, x, 10.88, -3.5);
    const light = new THREE.SpotLight("#ffe4ba", 75, 16, 0.48, 0.75, 2);
    light.position.set(x, 10.78, -3.5);
    light.target.position.set(x, 1, -4.8);
    if (x === 0) {
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.bias = -0.0003;
      light.shadow.normalBias = 0.03;
    }
    scene.add(light, light.target);
  }
  for (const side of [-1, 1])
    for (let z = -4.4; z < Math.min(depth, 18); z += 7.6) {
      box(0.08, 0.55, 0.15, bronze, side * 8.7, 4.1, z);
      for (const dz of [-0.21, 0.21]) {
        round(0.035, 0.4, gold, side * 8.48, 4.18, z + dz);
        instance(sphere, glow, side * 8.48, 4.48, z + dz, 0.075, 0.14, 0.075);
      }
    }
  // Discreet wall-mounted speakers match the Web Audio source positions.
  for (const speaker of museumSpeakerPositions(depth)) {
    box(0.2, 0.34, 0.25, bronze, speaker.x, speaker.y, speaker.z);
    const grille = new THREE.Mesh(
      new THREE.CircleGeometry(0.105, 20),
      new THREE.MeshStandardMaterial({ color: "#302c29", roughness: 0.86 }),
    );
    grille.position.set(
      speaker.x + (speaker.x < 0 ? 0.106 : -0.106),
      speaker.y,
      speaker.z,
    );
    grille.rotation.y = speaker.x < 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(grille);
  }
  // Flush mounted brass museum lettering, not a backdrop image.
  const inscription = document.createElement("canvas");
  inscription.width = 1536;
  inscription.height = 640;
  const ctx = inscription.getContext("2d");
  ctx.clearRect(0, 0, 1536, 640);
  ctx.textAlign = "center";
  ctx.fillStyle = "#6c5733";
  ctx.font = "38px Georgia";
  ctx.fillText("M E M O R I E S   M A D E   T I M E L E S S", 768, 210);
  ctx.font = "110px Georgia";
  ctx.font = "88px Georgia";
  ctx.fillText("A LOVE, COLLECTED", 768, 355);
  ctx.font = "italic 40px Georgia";
  ctx.fillText("Every chapter. Every promise. Every us.", 768, 455);
  const inscriptionMap = new THREE.CanvasTexture(inscription);
  inscriptionMap.colorSpace = THREE.SRGBColorSpace;
  textures.push(inscriptionMap);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(4.9, 2.04),
    new THREE.MeshStandardMaterial({
      map: inscriptionMap,
      transparent: true,
      roughness: 0.7,
      depthWrite: false,
    }),
  );
  sign.position.set(0, 7.95, -5.55);
  scene.add(sign);

  for (const { geometry, material, matrices } of batches.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    scene.add(mesh);
  }
  // Baked-style radial contact occlusion under the benches and plinth.
  const contactMap = canvasTexture((c, s) => {
    c.clearRect(0, 0, s, s);
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(25,18,9,.48)");
    g.addColorStop(0.45, "rgba(25,18,9,.27)");
    g.addColorStop(1, "rgba(25,18,9,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  }, 256);
  for (const [x, z, sx, sz] of [
    [-5.35, 1.25, 2.2, 2.2],
    [5.35, 1.25, 2.2, 2.2],
    [-5.35, 15, 2.2, 2.2],
    [5.35, 15, 2.2, 2.2],
    [-3.2, 12.2, 3.0, 2.0],
    [3.2, 12.2, 3.0, 2.0],
  ]) {
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(sx, sz),
      new THREE.MeshBasicMaterial({
        map: contactMap,
        transparent: true,
        depthWrite: false,
        opacity: 0.7,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(x, 0.023, z);
    scene.add(shadow);
  }
  return { floor, wall, stone, walnut, gold, textures };
}
