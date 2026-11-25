import * as THREE from "three";

const UP = new THREE.Vector3(0, 1, 0);
const v = (x, y, z) => new THREE.Vector3(x, y, z);
function nameTexture(name, local) {
  const c = document.createElement("canvas");
  c.width = 768;
  c.height = 160;
  const ctx = c.getContext("2d");
  ctx.fillStyle = local ? "#f3f4e9" : "#fff4ea";
  ctx.beginPath();
  ctx.roundRect(4, 8, 760, 136, 38);
  ctx.fill();
  ctx.strokeStyle = local ? "#91a17b" : "#c2ab96";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = "#59634b";
  ctx.textAlign = "center";
  const text = name + (local ? " · you" : "");
  let size = 48;
  ctx.font = `500 ${size}px Arial`;
  while (ctx.measureText(text).width > 680 && size > 24) {
    size -= 2;
    ctx.font = `500 ${size}px Arial`;
  }
  ctx.fillText(text, 384, 94);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function segment(parent, material, radius) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 12), material);
  m.userData.radius = radius;
  parent.add(m);
  return m;
}
function placeSegment(mesh, a, b) {
  const delta = b.clone().sub(a);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, delta.clone().normalize());
  mesh.scale.set(mesh.userData.radius, delta.length(), mesh.userData.radius);
}
// Two-bone elbow solver. The target is in the character's own coordinate space.
export function armJoints(shoulder, target, bendSign = 1) {
  const direction = target.clone().sub(shoulder),
    rawLength = direction.length();
  const length = THREE.MathUtils.clamp(rawLength, 0.06, 0.6);
  direction.normalize();
  const end = shoulder.clone().addScaledVector(direction, length);
  let bend = v(bendSign * 0.6, 0, -1);
  bend.addScaledVector(direction, -bend.dot(direction)).normalize();
  if (bend.lengthSq() < 0.01) bend = v(0, 0, 1);
  const elbow = shoulder
    .clone()
    .addScaledVector(direction, length / 2)
    .addScaledVector(bend, Math.sqrt(0.31 * 0.31 - (length * length) / 4));
  return { elbow, end };
}
export function createVisitorAvatar(person, local = false) {
  const group = new THREE.Group();
  group.name = `visitor:${person.id}`;
  const skin = new THREE.MeshStandardMaterial({
    color: "#d7b599",
    roughness: 0.85,
  });
  const shirt = new THREE.MeshStandardMaterial({
    color: person.color || "#a0ad87",
    roughness: 0.88,
  });
  const pants = new THREE.MeshStandardMaterial({
    color: "#535649",
    roughness: 0.9,
  });
  const shoes = new THREE.MeshStandardMaterial({
    color: "#ede5d5",
    roughness: 0.72,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: "#4c382d",
    roughness: 0.95,
  });
  function sphere(radius, material, x, y, z, sx = 1, sy = 1, sz = 1) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 20, 14),
      material,
    );
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    group.add(m);
    return m;
  }
  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.215, 0.29, 8, 18),
    shirt,
  );
  group.add(torso);
  const hips = sphere(0.19, pants, 0, 0.8, 0, 1.04, 0.78, 0.9);
  const head = new THREE.Group();
  group.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 18), skin);
  face.scale.set(0.91, 1.11, 0.95);
  head.add(face);
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.185, 24, 16, 0, Math.PI * 2, 0, 1.5),
    hairMat,
  );
  cap.position.y = 0.035;
  head.add(cap);
  if (person.hair === "long") {
    const back = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.15, 0.19, 8, 16),
      hairMat,
    );
    back.position.set(0, -0.12, 0.105);
    back.scale.z = 0.63;
    head.add(back);
  }
  const eyes = new THREE.MeshStandardMaterial({
    color: "#342820",
    roughness: 0.7,
  });
  for (const x of [-0.062, 0.062]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.019, 10, 8), eyes);
    eye.position.set(x, 0.025, -0.158);
    head.add(eye);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.029, 12, 8), skin);
  nose.scale.set(0.65, 0.85, 1);
  nose.position.set(0, -0.02, -0.175);
  head.add(nose);
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.084, 0.016, 8, 24),
    shoes,
  );
  group.add(collar);
  const buttons = [];
  for (let i = 0; i < 3; i++)
    buttons.push(sphere(0.012, shoes, 0, 1.25 - i * 0.105, -0.211));
  const arms = [-1, 1].map((side) => ({
    side,
    upper: segment(group, shirt, 0.063),
    lower: segment(group, skin, 0.048),
    hand: sphere(0.058, skin, 0, 0, 0),
  }));
  const legs = [-1, 1].map((side) => ({
    side,
    upper: segment(group, pants, 0.082),
    lower: segment(group, pants, 0.071),
    shoe: sphere(0.095, shoes, side * 0.12, 0.07, -0.045, 0.78, 0.65, 1.5),
  }));
  const tag = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: nameTexture(person.name || "Guest", local),
      transparent: true,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  tag.scale.set(1.08, 0.225, 1);
  tag.position.y = 2.13;
  group.add(tag);
  if (local) {
    const marker = new THREE.Mesh(
      new THREE.RingGeometry(0.25, 0.285, 48),
      new THREE.MeshBasicMaterial({
        color: person.color || "#a0ad87",
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    marker.rotation.x = -Math.PI / 2;
    marker.position.y = 0.025;
    group.add(marker);
  }
  const box = new THREE.Group();
  const velvet = new THREE.MeshStandardMaterial({
    color: "#713d48",
    roughness: 0.8,
  });
  const brass = new THREE.MeshStandardMaterial({
    color: "#d1ac5c",
    metalness: 0.8,
    roughness: 0.2,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.13, 0.23), velvet);
  box.add(base);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.025, 0.23), velvet);
  lid.position.set(0, 0.155, 0.09);
  lid.rotation.x = 0.9;
  box.add(lid);
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.039, 0.009, 8, 24),
    brass,
  );
  band.position.y = 0.1;
  box.add(band);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.026),
    new THREE.MeshPhysicalMaterial({
      color: "#fffefa",
      roughness: 0.06,
      metalness: 0.45,
      clearcoat: 1,
    }),
  );
  diamond.position.y = 0.15;
  box.add(diamond);
  box.visible = false;
  group.add(box);
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = 64;
  shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext("2d");
  const gradient = shadowContext.createRadialGradient(32, 32, 3, 32, 32, 31);
  gradient.addColorStop(0, "rgba(48,41,25,.26)");
  gradient.addColorStop(1, "rgba(48,41,25,0)");
  shadowContext.fillStyle = gradient;
  shadowContext.fillRect(0, 0, 64, 64);
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.8),
    new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(shadowCanvas),
      transparent: true,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.022;
  group.add(shadow);
  group.userData = {
    id: person.id,
    local,
    appearanceKey: [person.name, person.color, person.hair, local].join(":"),
    rig: { torso, hips, head, collar, buttons, arms, legs, tag, box },
  };
  group.traverse((o) => {
    if (o.isMesh) {
      // Moving contact shadows avoid rebuilding all of the hall's static shadow maps.
      o.castShadow = false;
      o.receiveShadow = true;
    }
  });
  poseVisitorAvatar(group, {});
  return group;
}
export function poseVisitorAvatar(
  group,
  {
    pose = "standing",
    walking = false,
    phase = 0,
    gesture = null,
    actor = false,
    handTarget = null,
  } = {},
) {
  const r = group.userData.rig;
  const kneel = gesture === "propose" && actor,
    kiss = gesture === "kiss",
    sitting = pose === "sitting" && !gesture;
  const bob = walking ? Math.abs(Math.sin(phase)) * 0.025 : 0;
  const shift = kneel ? -0.43 : sitting ? 0.1 : bob;
  r.torso.position.set(0, 1.1 + shift, kiss ? -0.07 : 0);
  r.torso.rotation.x = kiss ? 0.12 : 0;
  r.hips.position.set(0, 0.8 + shift, 0);
  r.head.position.set(0, 1.66 + shift, kiss ? -0.105 : 0);
  r.head.rotation.set(kiss ? 0.12 : 0, 0, actor && kneel ? -0.04 : 0);
  r.collar.position.set(0, 1.43 + shift, kiss ? -0.09 : 0);
  r.collar.rotation.x = Math.PI / 2;
  r.buttons.forEach((button, i) =>
    button.position.set(
      0,
      1.25 + shift - i * 0.105,
      -0.211 - (kiss ? 0.07 : 0),
    ),
  );
  for (const leg of r.legs) {
    const side = leg.side,
      hip = v(side * 0.12, 0.8 + shift, 0);
    let knee, ankle;
    if (kneel) {
      knee =
        side > 0 ? v(side * 0.14, 0.11, 0.02) : v(side * 0.14, 0.44, -0.34);
      ankle =
        side > 0 ? v(side * 0.14, 0.075, 0.34) : v(side * 0.14, 0.075, -0.43);
    } else if (sitting) {
      knee = v(side * 0.14, 0.75, -0.37);
      ankle = v(side * 0.14, 0.12, -0.45);
    } else {
      const swing = walking ? Math.sin(phase + (side > 0 ? Math.PI : 0)) : 0;
      ankle = v(side * 0.12, 0.075 + Math.max(0, swing) * 0.12, -swing * 0.24);
      knee = v(side * 0.12, 0.43 + bob, -swing * 0.12 - 0.035);
    }
    placeSegment(leg.upper, hip, knee);
    placeSegment(leg.lower, knee, ankle);
    leg.shoe.position.copy(ankle).add(v(0, -0.015, -0.055));
  }
  for (const arm of r.arms) {
    const side = arm.side,
      shoulder = v(side * 0.255, 1.36 + shift, kiss ? -0.045 : 0);
    let target;
    if (kneel) target = v(side * 0.12, 0.96, -0.47);
    else if (kiss) target = v(side * 0.23, 1.14, -0.46);
    else if (
      gesture === "hands" &&
      handTarget &&
      Math.sign(handTarget.x) === side
    )
      target = handTarget.clone();
    else if (sitting) target = v(side * 0.18, 0.93, -0.34);
    else
      target = v(
        side * 0.3,
        0.82 + shift,
        walking ? Math.sin(phase + (side > 0 ? 0 : Math.PI)) * 0.18 : 0,
      );
    const { elbow, end } = armJoints(shoulder, target, side);
    placeSegment(arm.upper, shoulder, elbow);
    placeSegment(arm.lower, elbow, end);
    arm.hand.position.copy(end);
  }
  r.box.visible = kneel;
  r.box.position.set(0, 0.96, -0.49);
  r.tag.position.set(
    gesture === "hands" && handTarget ? -Math.sign(handTarget.x) * 0.25 : 0,
    2.13 + shift,
    0,
  );
}
export function disposeVisitorAvatar(group) {
  const geometries = new Set(),
    materials = new Set(),
    textures = new Set();
  group.traverse((o) => {
    if (o.geometry) geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      if (m) {
        materials.add(m);
        if (m.map) textures.add(m.map);
      }
  });
  geometries.forEach((g) => g.dispose());
  materials.forEach((m) => m.dispose());
  textures.forEach((t) => t.dispose());
  group.removeFromParent();
}
