import * as THREE from "three";
import { LOVE_ROTUNDA, rotundaSeat } from "./galleryLayout";
import { fitPhotoToMount } from "./photoLayout";

// Original, sculpted 3D objects and a walk-through, two-screen circular salon.
export function buildLoveRotunda(
  scene,
  { photos, question, stone, gold, walnut, clickables, textures, invalidate },
) {
  const plan = LOVE_ROTUNDA;
  const wine = new THREE.MeshStandardMaterial({
    color: "#56343b",
    roughness: 0.48,
  });
  const velvet = new THREE.MeshPhysicalMaterial({
    color: "#925e68",
    roughness: 0.86,
    sheen: 0.65,
    sheenColor: "#e2b4b4",
  });
  const paleStone = stone.clone();
  paleStone.color.set("#efdcd1");
  const bronze = new THREE.MeshStandardMaterial({
    color: "#a97958",
    metalness: 0.73,
    roughness: 0.32,
  });
  const glow = new THREE.MeshStandardMaterial({
    color: "#ffe8d0",
    emissive: "#ffc6ac",
    emissiveIntensity: 2.1,
  });
  function mesh(geometry, material, x = 0, y = 0, z = 0, parent = scene) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  const cube = new THREE.BoxGeometry(1, 1, 1);
  function box(w, h, d, material, x, y, z, parent = scene) {
    const m = mesh(cube, material, x, y, z, parent);
    m.scale.set(w, h, d);
    return m;
  }
  function cylinder(r, h, material, x, y, z, parent = scene) {
    return mesh(
      new THREE.CylinderGeometry(r, r, h, 48),
      material,
      x,
      y,
      z,
      parent,
    );
  }
  function tube(points, radius, material, parent = scene) {
    return mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        48,
        radius,
        10,
        false,
      ),
      material,
      0,
      0,
      0,
      parent,
    );
  }
  function torus(r, t, material, x, y, z, horizontal = false, parent = scene) {
    const m = mesh(
      new THREE.TorusGeometry(r, t, 10, 96),
      material,
      x,
      y,
      z,
      parent,
    );
    if (horizontal) m.rotation.x = Math.PI / 2;
    return m;
  }
  function heartPoints(scale = 1, ox = 0, oy = 0, oz = 0) {
    return Array.from({ length: 81 }, (_, i) => {
      const t = (i / 80) * Math.PI * 2;
      return [
        ox + Math.pow(Math.sin(t), 3) * 0.8 * scale,
        oy +
          (13 * Math.cos(t) -
            5 * Math.cos(2 * t) -
            2 * Math.cos(3 * t) -
            Math.cos(4 * t)) *
            0.05 *
            scale,
        oz,
      ];
    });
  }
  function textMap(title, sub = "", { dark = false, photo = null } = {}) {
    const c = document.createElement("canvas");
    c.width = 1280;
    c.height = 768;
    const ctx = c.getContext("2d");
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    function draw(image) {
      ctx.fillStyle = dark ? "#30272c" : "#eee2d5";
      ctx.fillRect(0, 0, 1280, 768);
      if (image) {
        const s = Math.max(1280 / image.width, 768 / image.height);
        ctx.drawImage(
          image,
          (1280 - image.width * s) / 2,
          (768 - image.height * s) / 2,
          image.width * s,
          image.height * s,
        );
        ctx.fillStyle = "#281b25aa";
        ctx.fillRect(0, 0, 1280, 768);
      }
      ctx.textAlign = "center";
      ctx.fillStyle = dark ? "#e1bfb3" : "#a47e63";
      ctx.font = "50px Georgia";
      ctx.fillText("♡", 640, 154);
      ctx.font = "19px Arial";
      ctx.fillText(sub.toUpperCase(), 640, 218);
      ctx.fillStyle = dark ? "#fff2dc" : "#684a42";
      ctx.font = "64px Georgia";
      const words = title.split(" ");
      let line = "",
        lines = [];
      for (const word of words) {
        if (ctx.measureText(line + word).width > 1040 && line) {
          lines.push(line.trim());
          line = "";
        }
        line += word + " ";
      }
      lines.push(line.trim());
      lines
        .slice(0, 5)
        .forEach((l, i) =>
          ctx.fillText(
            l,
            640,
            365 - (Math.min(lines.length, 5) - 1) * 39 + i * 78,
          ),
        );
      ctx.font = "22px Arial";
      ctx.fillStyle = dark ? "#e1bfb3" : "#a47e63";
      ctx.fillText(
        dark ? "TAP TO WATCH TOGETHER" : "TAP FOR A LITTLE MOMENT",
        640,
        648,
      );
      if (dark) {
        ctx.strokeStyle = "#f0d8bd";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(640, 539, 39, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(631, 521);
        ctx.lineTo(657, 539);
        ctx.lineTo(631, 557);
        ctx.closePath();
        ctx.fillStyle = "#f4dfc3";
        ctx.fill();
      }
      texture.needsUpdate = true;
      invalidate();
    }
    draw();
    if (photo) {
      const image = new Image();
      image.onload = () => draw(image);
      image.src = photo;
    }
    return texture;
  }
  function plaque(title, sub, x, y, z, width = 1.45, parent = scene) {
    const c = document.createElement("canvas");
    c.width = 1024;
    c.height = 256;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#e9dac5";
    ctx.fillRect(0, 0, 1024, 256);
    ctx.textAlign = "center";
    ctx.fillStyle = "#715444";
    ctx.font = "48px Georgia";
    ctx.fillText(title, 512, 112);
    ctx.fillStyle = "#a58b70";
    ctx.font = "22px Arial";
    ctx.fillText(sub.toUpperCase(), 512, 181);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    textures.push(t);
    return mesh(
      new THREE.PlaneGeometry(width, width / 4),
      new THREE.MeshBasicMaterial({ map: t, toneMapped: false }),
      x,
      y,
      z,
      parent,
    );
  }

  // A flush circular marble floor, with a double brass inlay, not a fenced dais.
  const salonStone = stone.clone();
  salonStone.color.set("#dac0b6");
  salonStone.roughness = 0.54;
  const disc = cylinder(plan.radius, 0.035, salonStone, 0, 0.018, plan.z);
  disc.userData.floor = true;
  clickables.push(disc);
  for (const r of [plan.radius - 0.1, plan.radius - 0.3, 3.35])
    torus(r, 0.015, gold, 0, 0.045, plan.z, true);
  const inlay = tube(heartPoints(1.05), 0.018, gold);
  inlay.rotation.x = -Math.PI / 2;
  inlay.position.set(0, 0.055, plan.z);
  const floorLetter = plaque(
    "Where our stories meet",
    "THE LOVE ROTUNDA",
    0,
    0.06,
    11,
    3.25,
  );
  floorLetter.rotation.x = -Math.PI / 2;

  function arcGeometry(radius, width, start, end, depth) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, radius + width / 2, start, end, false);
    shape.absarc(0, 0, radius - width / 2, end, start, true);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelSize: 0.035,
      bevelThickness: 0.035,
      bevelSegments: 3,
      curveSegments: 36,
      steps: 1,
    });
  }
  const seats = Array.from({ length: 4 }, (_, i) => rotundaSeat(i));
  plan.benchArcs.forEach(([start, end], i) => {
    const seat = seats[i];
    const cushion = mesh(
      arcGeometry(plan.benchRadius, plan.benchWidth, start, end, 0.23),
      velvet,
      0,
      0.82,
      plan.z,
    );
    cushion.rotation.x = Math.PI / 2;
    cushion.userData.bench = true;
    cushion.userData.seat = seat;
    clickables.push(cushion);
    const trim = mesh(
      arcGeometry(plan.benchRadius, plan.benchWidth + 0.045, start, end, 0.09),
      gold,
      0,
      0.57,
      plan.z,
    );
    trim.rotation.x = Math.PI / 2;
    const back = mesh(
      arcGeometry(plan.benchRadius + 0.37, 0.15, start, end, 0.55),
      velvet,
      0,
      1.26,
      plan.z,
    );
    back.rotation.x = Math.PI / 2;
    back.userData.bench = true;
    back.userData.seat = seat;
    clickables.push(back);
    for (let j = 0; j < 5; j++) {
      const a = start + ((end - start) * j) / 4;
      cylinder(
        0.045,
        0.49,
        bronze,
        Math.cos(a) * plan.benchRadius,
        0.25,
        plan.z + Math.sin(a) * plan.benchRadius,
      );
    }
  });

  // Two independent, freestanding screens. Their reverse sides are photo exhibits.
  let filmSurface;
  plan.screens.forEach((s, i) => {
    const group = new THREE.Group();
    group.position.set(s.x, 0, s.z);
    group.rotation.y = s.rotation;
    scene.add(group);
    box(s.width + 0.24, s.height + 0.24, 0.18, bronze, 0, 2.78, 0, group);
    box(s.width + 0.12, s.height + 0.12, 0.2, wine, 0, 2.78, 0.015, group);
    const map =
      s.kind === "film"
        ? textMap("Our favorite film: us.", "01 / OUR PRIVATE CINEMA", {
            dark: true,
            photo: photos[0],
          })
        : textMap(
            question || "The best is still to come.",
            "02 / A QUESTION FROM THE HEART",
          );
    const face = mesh(
      new THREE.PlaneGeometry(s.width, s.height),
      new THREE.MeshBasicMaterial({ map, toneMapped: false }),
      0,
      2.78,
      0.126,
      group,
    );
    face.userData.screen = s.kind;
    clickables.push(face);
    if (s.kind === "film") filmSurface = face;
    for (const x of [-1.28, 1.28]) {
      box(0.075, 1.58, 0.09, bronze, x, 0.83, 0, group);
      box(0.62, 0.06, 0.72, bronze, x, 0.06, 0, group);
    }
    plaque(
      s.kind === "film" ? "A film for us" : "One little question",
      s.kind === "film" ? "01 · OUR STORY IN MOTION" : "02 · OUR NEXT CHAPTER",
      0,
      1.32,
      0.13,
      2.5,
      group,
    );
    box(
      s.width - 0.08,
      s.height - 0.08,
      0.025,
      paleStone,
      0,
      2.78,
      -0.102,
      group,
    );
    const backPhoto = photos[(i + 1) % photos.length];
    const image = new THREE.TextureLoader().load(backPhoto, (t) => {
      const fit = fitPhotoToMount(
        t.image.width,
        t.image.height,
        s.width - 0.22,
        s.height - 0.22,
      );
      reverse.scale.set(
        fit.width / (s.width - 0.22),
        fit.height / (s.height - 0.22),
        1,
      );
      invalidate();
    });
    image.colorSpace = THREE.SRGBColorSpace;
    textures.push(image);
    const reverse = mesh(
      new THREE.PlaneGeometry(s.width - 0.22, s.height - 0.22),
      new THREE.MeshStandardMaterial({ map: image, roughness: 0.8 }),
      0,
      2.78,
      -0.122,
      group,
    );
    reverse.rotation.y = Math.PI;
    reverse.userData.photo = (i + 1) % photos.length;
    clickables.push(reverse);
    const backLabel = plaque(
      "The story continues",
      "MORE MEMORIES, JUST BEYOND",
      0,
      1.3,
      -0.13,
      2.4,
      group,
    );
    backLabel.rotation.y = Math.PI;
  });
  const banner = plaque(
    "The love rotunda",
    "A FILM. A QUESTION. A PLACE FOR TWO.",
    0,
    4.7,
    6.24,
    4.8,
  );
  for (const x of [-1.8, 1.8]) cylinder(0.008, 1.45, bronze, x, 5.58, 6.24);
  // Suspended warm halo, with real light and fine suspension rods.
  torus(4.8, 0.042, bronze, 0, 6.45, plan.z, true);
  torus(4.77, 0.016, glow, 0, 6.41, plan.z, true);
  for (const a of [0.4, 2.74, 4.71]) {
    const x = Math.cos(a) * 4.8,
      z = plan.z + Math.sin(a) * 4.8;
    cylinder(0.009, 4.6, bronze, x, 8.75, z);
  }
  const salonLight = new THREE.SpotLight("#ffd6c2", 70, 13, 0.91, 0.9, 2);
  salonLight.position.set(0, 6.15, plan.z);
  salonLight.target.position.set(0, 0, plan.z);
  scene.add(salonLight, salonLight.target);

  // Original romantic sculptures: two abstract marble figures in an embrace,
  // interlocking bronze hearts, and a museum-scale ring in an open velvet box.
  for (const exhibit of plan.sculptures) {
    const g = new THREE.Group();
    g.position.set(exhibit.x, 0, exhibit.z);
    scene.add(g);
    cylinder(0.78, 0.12, bronze, 0, 0.06, 0, g);
    cylinder(0.71, 0.96, paleStone, 0, 0.59, 0, g);
    cylinder(0.75, 0.08, stone, 0, 1.1, 0, g);
    plaque(exhibit.title, "THE PERMANENT COLLECTION", 0, 0.64, 0.715, 1.17, g);
    if (exhibit.kind === "embrace") {
      for (const side of [-1, 1]) {
        const figure = new THREE.Group();
        figure.position.set(side * 0.23, 1.15, 0);
        figure.rotation.z = side * 0.15;
        g.add(figure);
        const profile = [
          [0.18, 0],
          [0.25, 0.12],
          [0.22, 0.42],
          [0.15, 0.79],
          [0.22, 1.05],
          [0.19, 1.26],
          [0.09, 1.36],
        ].map(([r, y]) => new THREE.Vector2(r, y));
        mesh(new THREE.LatheGeometry(profile, 32), paleStone, 0, 0, 0, figure);
        const head = mesh(
          new THREE.SphereGeometry(0.18, 24, 16),
          paleStone,
          -side * 0.07,
          1.57,
          0,
          figure,
        );
        head.scale.set(0.82, 1.16, 0.95);
        tube(
          [
            [side * 0.13, 1.19, 0.03],
            [side * 0.05, 1.02, 0.28],
            [-side * 0.25, 0.91, 0.27],
            [-side * 0.38, 0.99, 0.1],
          ],
          0.065,
          paleStone,
          figure,
        );
        tube(
          [
            [-side * 0.15, 1.19, -0.02],
            [-side * 0.29, 1.23, -0.22],
            [-side * 0.37, 1.06, -0.18],
          ],
          0.065,
          paleStone,
          figure,
        );
      }
    } else if (exhibit.kind === "hearts") {
      const a = tube(heartPoints(1.02, -0.28, 2.05, 0), 0.072, bronze, g);
      a.rotation.y = -0.24;
      const b = tube(heartPoints(0.84, 0.39, 2.04, 0.12), 0.057, gold, g);
      b.rotation.y = 0.35;
      box(0.1, 0.35, 0.11, bronze, 0, 1.28, 0, g);
    } else {
      box(1.08, 0.23, 0.9, wine, 0, 1.28, 0, g);
      box(0.96, 0.035, 0.78, velvet, 0, 1.42, 0, g);
      const lid = box(1.08, 0.09, 0.92, wine, 0, 1.82, -0.43, g);
      lid.rotation.x = -0.98;
      const ring = torus(0.38, 0.045, gold, 0, 1.82, 0.04, false, g);
      ring.rotation.x = 0.1;
      const gem = mesh(
        new THREE.OctahedronGeometry(0.16, 0),
        new THREE.MeshPhysicalMaterial({
          color: "#fff5e5",
          metalness: 0.35,
          roughness: 0.09,
          clearcoat: 1,
        }),
        0,
        2.28,
        0.04,
        g,
      );
      gem.scale.set(1.2, 0.9, 0.85);
    }
    g.traverse((object) => {
      object.userData.exhibit = {
        title: exhibit.title,
        kind: exhibit.kind,
        description:
          exhibit.kind === "embrace"
            ? "Two figures lean into one another. A small tribute to the quiet comfort of being somebody’s home."
            : exhibit.kind === "hearts"
              ? "Two separate hearts, gently intertwined. Not the same story, but a beautiful one together."
              : "An open box, a little courage, and a promise that reaches into every tomorrow.",
      };
    });
    clickables.push(g);
  }

  // Rose arrangements are models, too. Petals and leaves are batched to keep
  // the romantic dressing inexpensive rather than hundreds of draw calls.
  const petals = [],
    leaves = [];
  for (const side of [-1, 1]) {
    const x = side * 5.65,
      z = 9.0;
    cylinder(0.3, 0.76, paleStone, x, 0.4, z);
    torus(0.31, 0.024, gold, x, 0.79, z, true);
    for (let i = 0; i < 11; i++) {
      const a = i * 2.4,
        r = 0.15 + (0.18 * (i % 3)) / 2,
        bx = x + Math.cos(a) * r,
        bz = z + Math.sin(a) * r,
        by = 1.17 + (i % 4) * 0.075;
      tube(
        [
          [x, 0.72, z],
          [bx, 1.0, bz],
          [bx, by, bz],
        ],
        0.009,
        new THREE.MeshStandardMaterial({ color: "#687154" }),
      );
      for (let j = 0; j < 9; j++) {
        const b = (j / 9) * Math.PI * 2;
        petals.push({
          x: bx + Math.cos(b) * 0.06,
          y: by + (j % 3) * 0.015,
          z: bz + Math.sin(b) * 0.06,
          a: b,
        });
      }
      leaves.push({ x: bx + 0.07, y: by - 0.22, z: bz, a });
    }
  }
  const dummy = new THREE.Object3D();
  const petalMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 7),
    new THREE.MeshStandardMaterial({ color: "#b66c7e", roughness: 0.77 }),
    petals.length,
  );
  petals.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0.55, p.a, 0.3);
    dummy.scale.set(0.055, 0.026, 0.085);
    dummy.updateMatrix();
    petalMesh.setMatrixAt(i, dummy.matrix);
  });
  petalMesh.castShadow = true;
  scene.add(petalMesh);
  const leafMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 8, 6),
    new THREE.MeshStandardMaterial({ color: "#737953", roughness: 0.9 }),
    leaves.length,
  );
  leaves.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0.6, p.a, 0.6);
    dummy.scale.set(0.05, 0.012, 0.13);
    dummy.updateMatrix();
    leafMesh.setMatrixAt(i, dummy.matrix);
  });
  scene.add(leafMesh);
  // Quiet wayfinding makes it clear this is not the end of the gallery.
  for (const side of [-1, 1]) {
    plaque(
      "The story continues →",
      "MORE MEMORIES, JUST BEYOND",
      side * 5.35,
      1.3,
      5.3,
      1.85,
    );
    cylinder(0.022, 1.1, bronze, side * 5.35, 0.56, 5.3);
    box(0.55, 0.035, 0.4, bronze, side * 5.35, 0.035, 5.3);
  }
  return { filmSurface, seats };
}
