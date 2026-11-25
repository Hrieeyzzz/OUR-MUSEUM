import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildGrandGallery } from "./GrandGallery";
import { buildLoveRotunda } from "./LoveRotunda";
import { LOVE_ROTUNDA, galleryDepth, constrainLoveWalk } from "./galleryLayout";
import { PHOTO_BAYS, photoPlacements, fitPhotoToMount } from "./photoLayout";

const clamp = THREE.MathUtils.clamp;
function labelTexture(
  text,
  sub = "",
  color = "#4d493e",
  width = 1024,
  height = 256,
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const c = canvas.getContext("2d");
  c.fillStyle = "#eeeadf";
  c.fillRect(0, 0, width, height);
  c.fillStyle = color;
  c.textAlign = "center";
  let fontSize = 38,
    lines = [];
  function wrap() {
    c.font = `${fontSize}px Georgia`;
    lines = [];
    let line = "";
    for (const char of text) {
      if (char === "\n") {
        lines.push(line.trim());
        line = "";
        continue;
      }
      if (c.measureText(line + char).width > width - 100) {
        const space = line.lastIndexOf(" ");
        if (space > 0) {
          lines.push(line.slice(0, space));
          line = line.slice(space + 1);
        } else {
          lines.push(line);
          line = "";
        }
      }
      line += char;
    }
    if (line) lines.push(line.trim());
  }
  wrap();
  while (lines.length * fontSize * 1.3 > height - 110 && fontSize > 14) {
    fontSize -= 2;
    wrap();
  }
  const lineHeight = fontSize * 1.3;
  lines.forEach((l, i) =>
    c.fillText(
      l,
      width / 2,
      (height - 35) / 2 -
        ((lines.length - 1) * lineHeight) / 2 +
        i * lineHeight,
    ),
  );
  if (sub) {
    c.font = "17px Arial";
    c.fillStyle = "#8c8778";
    c.fillText(sub, width / 2, height - 28);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function avatar(color, name) {
  const g = new THREE.Group(),
    clothes = new THREE.MeshStandardMaterial({ color }),
    skin = new THREE.MeshStandardMaterial({ color: "#d7b599" });
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.22, 0.45, 5, 10),
    clothes,
  );
  body.position.y = 1;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), skin);
  head.position.y = 1.59;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.194, 16, 12, 0, Math.PI * 2, 0, 1.5),
    new THREE.MeshStandardMaterial({ color: "#594434" }),
  );
  hair.position.y = 1.62;
  g.add(hair);
  const limbs = [];
  for (const x of [-0.13, 0.13]) {
    const leg = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.075, 0.44, 3, 8),
      new THREE.MeshStandardMaterial({ color: "#615e52" }),
    );
    leg.position.set(x, 0.4, 0);
    g.add(leg);
    limbs.push(leg);
  }
  for (const x of [-0.33, 0.33]) {
    const arm = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.065, 0.42, 3, 8),
      clothes,
    );
    arm.position.set(x, 1, 0);
    g.add(arm);
    limbs.push(arm);
  }
  const tag = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: labelTexture(name, "", "#464e3b", 512, 128),
      depthTest: false,
    }),
  );
  tag.scale.set(1.05, 0.26, 1);
  tag.position.y = 2.1;
  g.add(tag);
  g.userData = { limbs, body, head, hair, tag };
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}
export default function MuseumScene({
  photos,
  hero = false,
  dedication = "",
  title = "Our little world",
  question = "",
  people = [],
  myId,
  onMove,
  onListen,
  onPhoto,
  onSeat,
  action,
  movement,
  paused = false,
  videoUrl = "",
  seat = false,
}) {
  const host = useRef(null),
    api = useRef({}),
    props = useRef({});
  const [failed, setFailed] = useState(false);
  props.current = {
    people,
    myId,
    onMove,
    onListen,
    onPhoto,
    onSeat,
    action,
    movement,
    paused,
    seat,
  };
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer;
    let needsRender = true;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#95836a");
    scene.fog = new THREE.Fog("#b3a084", 45, 120);
    const environmentScene = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(environmentScene, 0.04);
    scene.environment = environment.texture;
    scene.environmentIntensity = 0.36;
    environmentScene.dispose();
    pmrem.dispose();
    const camera = new THREE.PerspectiveCamera(hero ? 59 : 65, 1, 0.1, 130);
    const depth = galleryDepth(photos.length);
    camera.position.set(
      ...(hero
        ? [7.2, 5.5, 23.8]
        : [LOVE_ROTUNDA.spawn.x, 1.7, LOVE_ROTUNDA.spawn.z]),
    );
    camera.lookAt(
      hero
        ? new THREE.Vector3(-0.3, 2.9, 6.5)
        : new THREE.Vector3(0, 1.7, 6.25),
    );
    const { floor, wall, stone, walnut, gold, textures } = buildGrandGallery(
      scene,
      {
        depth,
        hero,
        renderer,
        onTextureLoad: () => {
          needsRender = true;
        },
      },
    );
    function box(w, h, d, mat, x, y, z, parent = scene) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }
    const hemi = new THREE.HemisphereLight("#e4ebf0", "#756048", 1.25);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight("#fff0d9", 1.65);
    sun.position.set(-5, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -14,
      right: 14,
      top: 14,
      bottom: -14,
      far: 45,
    });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 4;
    scene.add(sun);
    const bounce = new THREE.DirectionalLight("#c6d4df", 0.55);
    bounce.position.set(7, 7, 1);
    scene.add(bounce);
    const loader = new THREE.TextureLoader(),
      clickables = [];
    function picture(url, index, x, z, rot = 0, central = false) {
      const g = new THREE.Group();
      g.position.set(x, PHOTO_BAYS.centerY, z);
      g.rotation.y = rot;
      scene.add(g);
      const w = central ? 3.65 : PHOTO_BAYS.frameWidth,
        h = central ? 3.1 : PHOTO_BAYS.frameHeight;
      box(w + 0.3, h + 0.3, 0.15, walnut, 0, 0, -0.015, g);
      const frameBar = (extra, thickness, depth, material, front) => {
        const fw = w + extra,
          fh = h + extra;
        box(
          fw,
          thickness,
          depth,
          material,
          0,
          fh / 2 - thickness / 2,
          front,
          g,
        );
        box(
          fw,
          thickness,
          depth,
          material,
          0,
          -fh / 2 + thickness / 2,
          front,
          g,
        );
        box(
          thickness,
          fh,
          depth,
          material,
          -fw / 2 + thickness / 2,
          0,
          front,
          g,
        );
        box(
          thickness,
          fh,
          depth,
          material,
          fw / 2 - thickness / 2,
          0,
          front,
          g,
        );
      };
      frameBar(0.3, 0.085, 0.16, gold, 0.045);
      frameBar(0.12, 0.06, 0.19, walnut, 0.06);
      frameBar(0.02, 0.045, 0.2, gold, 0.075);
      box(
        w - 0.09,
        h - 0.09,
        0.12,
        new THREE.MeshStandardMaterial({ color: "#e8deca", roughness: 0.95 }),
        0,
        0,
        0.005,
        g,
      );
      const pwidth = w - 0.38,
        pheight = h - 0.38;
      const texture = loader.load(url, (t) => {
        needsRender = true;
        const fit = fitPhotoToMount(
          t.image.width,
          t.image.height,
          pwidth,
          pheight,
        );
        img.scale.set(fit.width / pwidth, fit.height / pheight, 1);
      });
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      textures.push(texture);
      const img = new THREE.Mesh(
        new THREE.PlaneGeometry(pwidth, pheight),
        new THREE.MeshStandardMaterial({
          map: texture,
          roughness: 0.66,
          envMapIntensity: 0.15,
        }),
      );
      img.position.z = 0.072;
      img.userData.photo = index;
      g.add(img);
      clickables.push(img);
      const caption = new THREE.Mesh(
        new THREE.PlaneGeometry(central ? 1.6 : 1.2, 0.24),
        new THREE.MeshBasicMaterial({
          map: labelTexture(
            central
              ? "Where it all begins"
              : `A moment to keep · ${String(index + 1).padStart(2, "0")}`,
            "",
            "#5c5548",
          ),
        }),
      );
      caption.position.set(0, -h / 2 - 0.35, 0.04);
      g.add(caption);
      // Slim brass picture lights.
      box(0.7, 0.055, 0.07, gold, 0, h / 2 + 0.36, 0.26, g);
      box(0.035, 0.17, 0.23, gold, 0, h / 2 + 0.43, 0.15, g);
      const spot = new THREE.SpotLight("#ffe8c4", 24, 7, 0.72, 0.85, 2);
      spot.position.set(0, h / 2 + 0.48, 0.7);
      const target = new THREE.Object3D();
      target.position.set(0, -0.2, 0);
      g.add(target);
      spot.target = target;
      if (index < 5) g.add(spot);
      return g;
    }
    photoPlacements(photos.length, depth).forEach(
      ({ index, x, z, rotation, central }) =>
        picture(photos[index], index, x, z, rotation, central),
    );
    function plant(x, z) {
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.43, 0.31, 0.76, 24),
        new THREE.MeshStandardMaterial({ color: "#c1ac8d", roughness: 0.9 }),
      );
      pot.position.set(x, 0.38, z);
      pot.castShadow = true;
      scene.add(pot);
      const leafMat = new THREE.MeshStandardMaterial({
        color: "#657152",
        roughness: 0.9,
        side: THREE.DoubleSide,
      });
      const stemMat = new THREE.MeshStandardMaterial({ color: "#6f6446" });
      for (let n = 0; n < 9; n++) {
        const a = n * 2.4,
          h = 1.2 + Math.random() * 1.2,
          dx = Math.cos(a) * 0.45,
          dz = Math.sin(a) * 0.45;
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.014, 0.022, h, 5),
          stemMat,
        );
        stem.position.set(x + dx * 0.5, 0.65 + h / 2, z + dz * 0.5);
        stem.rotation.z = -dx * 0.4;
        scene.add(stem);
        for (let j = 0; j < 4; j++) {
          const leaf = new THREE.Mesh(
            new THREE.SphereGeometry(1, 10, 8),
            leafMat,
          );
          leaf.scale.set(0.19, 0.38, 0.045);
          leaf.position.set(
            x + dx + Math.cos(j * 2) * 0.16,
            0.9 + h - j * 0.27,
            z + dz,
          );
          leaf.rotation.set(0.4, a + j, 0.6);
          leaf.castShadow = true;
          scene.add(leaf);
        }
      }
    }
    plant(-7.7, -4.7);
    plant(7.8, -4.7);
    // The entrance dedication stays in the arrival wing, before the rotunda.
    const panel = box(2.9, 2.05, 0.12, stone, -5.3, 2, 24.2);
    panel.rotation.y = 0.28;
    const plaque = new THREE.Mesh(
      new THREE.PlaneGeometry(2.7, 1.8),
      new THREE.MeshBasicMaterial({
        map: labelTexture(
          dedication ||
            "For the big adventures, the quiet ordinary days, and every chapter still to come.",
          title.toUpperCase(),
          "#79554e",
          1024,
          640,
        ),
      }),
    );
    plaque.position.set(-5.28, 2, 24.29);
    plaque.rotation.y = 0.28;
    scene.add(plaque);
    const { filmSurface, seats } = buildLoveRotunda(scene, {
      photos,
      question,
      stone,
      gold,
      walnut,
      clickables,
      textures,
      invalidate: () => {
        needsRender = true;
      },
    });
    let selectedSeat = null;
    let galleryVideo = null,
      galleryVideoTexture = null;
    if (!hero && videoUrl) {
      galleryVideo = document.createElement("video");
      galleryVideo.src = videoUrl;
      galleryVideo.muted = true;
      galleryVideo.playsInline = true;
      galleryVideo.preload = "auto";
      galleryVideoTexture = new THREE.VideoTexture(galleryVideo);
      galleryVideoTexture.colorSpace = THREE.SRGBColorSpace;
      galleryVideo.addEventListener("loadeddata", () => {
        filmSurface.material.map = galleryVideoTexture;
        filmSurface.material.needsUpdate = true;
        needsRender = true;
      });
    }
    const avatars = new Map(),
      keys = new Set(),
      euler = new THREE.Euler(0, 0, 0, "YXZ");
    let yaw = 0,
      pitch = 0.1,
      pointer = null,
      last = performance.now(),
      lastNetwork = 0,
      raf,
      walkTime = 0;
    let walkTarget = null,
      wasSeated = false,
      lastAction = null,
      lastRender = 0,
      lastShadow = 0;
    const keyDown = (e) => {
      if (
        props.current.paused ||
        ["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)
      )
        return;
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)
      )
        e.preventDefault();
      keys.add(e.key.toLowerCase());
    };
    const keyUp = (e) => keys.delete(e.key.toLowerCase());
    const blur = () => keys.clear();
    const down = (e) => {
      pointer = { x: e.clientX, y: e.clientY, ox: e.clientX, oy: e.clientY };
      if (!hero) renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e) => {
      if (!pointer || hero) return;
      yaw -= (e.clientX - pointer.x) * 0.004;
      pitch = clamp(pitch - (e.clientY - pointer.y) * 0.004, -0.75, 0.75);
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    };
    const up = (e) => {
      if (!pointer || hero) {
        pointer = null;
        return;
      }
      if (
        Math.abs(e.clientX - pointer.ox) + Math.abs(e.clientY - pointer.oy) <
        7
      ) {
        const rect = el.getBoundingClientRect();
        const ray = new THREE.Raycaster();
        ray.setFromCamera(
          new THREE.Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            -((e.clientY - rect.top) / rect.height) * 2 + 1,
          ),
          camera,
        );
        const hits = ray.intersectObjects([...clickables, floor]);
        if (hits.length) {
          const hit = hits[0];
          if (hit.object.userData.photo !== undefined)
            props.current.onPhoto?.(hit.object.userData.photo);
          else if (hit.object.userData.exhibit) {
            window.dispatchEvent(
              new CustomEvent("museum-exhibit", {
                detail: hit.object.userData.exhibit,
              }),
            );
          } else if (hit.object.userData.bench) {
            selectedSeat = hit.object.userData.seat;
            props.current.onSeat?.();
          } else if (hit.object.userData.screen)
            window.dispatchEvent(
              new CustomEvent("museum-screen", {
                detail: { kind: hit.object.userData.screen },
              }),
            );
          else if (hit.object.userData.floor) walkTarget = hit.point;
        }
      }
      pointer = null;
    };
    if (!hero) {
      window.addEventListener("keydown", keyDown);
      window.addEventListener("keyup", keyUp);
      window.addEventListener("blur", blur);
    }
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", up);
    const observer = new ResizeObserver(() => {
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height);
      needsRender = true;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    });
    observer.observe(el);
    let inView = true;
    const visibilityObserver = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
    });
    visibilityObserver.observe(el);
    let lastPeople = props.current.people;
    const listenerDirection = new THREE.Vector3();
    const listenerUp = new THREE.Vector3();
    const lastCameraPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
    const lastCameraRotation = new THREE.Quaternion();
    function animate(now) {
      raf = requestAnimationFrame(animate);
      if (
        document.hidden ||
        (hero && (!inView || props.current.paused)) ||
        now - lastRender < (hero ? 42 : 25)
      )
        return;
      lastRender = now;
      if (lastPeople !== props.current.people) {
        lastPeople = props.current.people;
        needsRender = true;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (hero) {
        camera.position.set(7.2, 5.5, 23.8);
        camera.lookAt(-0.3, 2.9, 6.5);
      } else {
        const p = props.current;
        if (p.paused) {
          keys.clear();
          walkTarget = null;
        }
        let placementApplied = false;
        if (p.action && p.action !== lastAction) {
          lastAction = p.action;
          needsRender = true;
          if (galleryVideo && p.action.type === "video") {
            galleryVideo.currentTime = p.action.time || 0;
            if (p.action.playing) galleryVideo.play().catch(() => {});
            else galleryVideo.pause();
          }
          const placement = p.action.placements?.[p.myId];
          if (placement) {
            placementApplied = true;
            camera.position.x = placement.x;
            camera.position.z = placement.z;
            yaw = placement.rotation;
            walkTarget = null;
          }
        }
        if (p.seat && !wasSeated) {
          const guestIndex = Math.max(
            0,
            p.people.findIndex((person) => person.id === p.myId),
          );
          selectedSeat ||= seats[guestIndex % seats.length];
          camera.position.set(selectedSeat.x, 1.3, selectedSeat.z);
          yaw = selectedSeat.yaw;
          pitch = selectedSeat.pitch;
          walkTarget = null;
        }
        if (!p.seat && wasSeated) {
          if (!placementApplied)
            camera.position.set(selectedSeat.x, 1.7, selectedSeat.z - 1.05);
          selectedSeat = null;
        }
        wasSeated = p.seat;
        let dx = 0,
          dz = 0;
        if (!p.seat && !p.paused) {
          const input = p.movement || {};
          if (keys.has("w") || keys.has("arrowup") || input.up) dz -= 1;
          if (keys.has("s") || keys.has("arrowdown") || input.down) dz += 1;
          if (keys.has("a") || keys.has("arrowleft") || input.left) dx -= 1;
          if (keys.has("d") || keys.has("arrowright") || input.right) dx += 1;
          if (dx || dz) {
            walkTarget = null;
            const len = Math.hypot(dx, dz);
            dx /= len;
            dz /= len;
            const wx = dx * Math.cos(yaw) + dz * Math.sin(yaw);
            dz = -dx * Math.sin(yaw) + dz * Math.cos(yaw);
            dx = wx;
          } else if (walkTarget) {
            const x = walkTarget.x - camera.position.x,
              z = walkTarget.z - camera.position.z,
              length = Math.hypot(x, z);
            if (length < 0.2) walkTarget = null;
            else {
              dx = x / length;
              dz = z / length;
            }
          }
          let x = clamp(camera.position.x + dx * dt * 3.3, -8.3, 8.3),
            z = clamp(camera.position.z + dz * dt * 3.3, -5, depth - 0.5);
          const columnPositions = [-8.2, -3.15, 3.15, 8.2].map((cx) => [
            cx,
            -5.45,
          ]);
          for (
            let cz = PHOTO_BAYS.firstColumn;
            cz < depth;
            cz += PHOTO_BAYS.spacing
          ) {
            columnPositions.push([-7.85, cz], [7.85, cz]);
          }
          for (const [cx, cz] of columnPositions) {
            if (Math.hypot(x - cx, z - cz) < 0.65) {
              const distance = Math.max(0.001, Math.hypot(x - cx, z - cz));
              x = cx + ((x - cx) / distance) * 0.66;
              z = cz + ((z - cz) / distance) * 0.66;
            }
          }
          const constrained = constrainLoveWalk(
            { x: camera.position.x, z: camera.position.z },
            { x, z },
          );
          x = constrained.x;
          z = constrained.z;
          camera.position.x = x;
          camera.position.z = z;
          if (dx || dz) walkTime += dt * 9;
          camera.position.y =
            p.action?.type === "propose" &&
            p.action.actor === p.myId &&
            now - p.action.started < 6000
              ? 1.03
              : 1.7 + (dx || dz ? Math.sin(walkTime) * 0.018 : 0);
        }
        euler.set(pitch, yaw, 0);
        camera.quaternion.setFromEuler(euler);
        if (now - lastNetwork > 70) {
          camera.getWorldDirection(listenerDirection);
          listenerUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
          p.onListen?.(camera.position, listenerDirection, listenerUp);
          p.onMove?.({
            x: camera.position.x,
            z: camera.position.z,
            rotation: yaw,
            pose: p.seat ? "sitting" : "standing",
          });
          lastNetwork = now;
        }
        const activeIds = new Set();
        p.people
          .filter((person) => person.id !== p.myId)
          .forEach((person) => {
            activeIds.add(person.id);
            let model = avatars.get(person.id);
            if (!model) {
              model = avatar(person.color, person.name);
              scene.add(model);
              avatars.set(person.id, model);
              model.position.set(person.x, 0, person.z);
            }
            model.position.x = THREE.MathUtils.lerp(
              model.position.x,
              person.x,
              0.13,
            );
            model.position.z = THREE.MathUtils.lerp(
              model.position.z,
              person.z,
              0.13,
            );
            model.rotation.y = person.rotation;
            const a = p.action,
              performing =
                a &&
                now - a.started < 6000 &&
                (a.actor === person.id || a.target === person.id);
            model.position.y =
              person.pose === "sitting"
                ? 0
                : performing && a.type === "propose" && a.actor === person.id
                  ? -0.5
                  : 0;
            model.userData.limbs[2].rotation.z =
              performing && a.type === "hands" ? -0.8 : 0;
            model.userData.limbs[3].rotation.z =
              performing && ["propose", "kiss"].includes(a.type) ? 0.95 : 0;
            model.userData.limbs[0].rotation.x =
              performing && a.type === "propose"
                ? -1.3
                : person.pose === "sitting"
                  ? -1.4
                  : 0;
            if (performing && a.type === "kiss") model.rotation.x = -0.14;
            else model.rotation.x = 0;
            if (performing && a.type === "propose" && !model.userData.ring) {
              const ring = box(
                0.17,
                0.12,
                0.17,
                new THREE.MeshStandardMaterial({ color: "#713d35" }),
                -0.3,
                1.15,
                -0.3,
                model,
              );
              const lid = box(
                0.17,
                0.025,
                0.17,
                new THREE.MeshStandardMaterial({ color: "#713d35" }),
                0,
                0.13,
                -0.075,
                ring,
              );
              lid.rotation.x = -0.85;
              const band = new THREE.Mesh(
                new THREE.TorusGeometry(0.03, 0.008, 8, 20),
                gold,
              );
              band.position.y = 0.09;
              ring.add(band);
              const gem = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.025),
                new THREE.MeshStandardMaterial({
                  color: "#ffffff",
                  metalness: 0.8,
                  roughness: 0.1,
                }),
              );
              gem.position.y = 0.1;
              ring.add(gem);
              model.userData.ring = ring;
            }
            if (model.userData.ring)
              model.userData.ring.visible = performing && a.type === "propose";
          });
        avatars.forEach((m, id) => {
          if (!activeIds.has(id)) {
            scene.remove(m);
            avatars.delete(id);
          }
        });
      }
      if (!hero && props.current.people.length > 1 && now - lastShadow > 250) {
        renderer.shadowMap.needsUpdate = true;
        lastShadow = now;
      }
      const cameraChanged =
        lastCameraPosition.distanceToSquared(camera.position) > 0.000001 ||
        1 - Math.abs(lastCameraRotation.dot(camera.quaternion)) > 0.000001;
      const animated =
        props.current.people.length > 1 ||
        (galleryVideo && !galleryVideo.paused);
      if (!props.current.paused && (needsRender || cameraChanged || animated)) {
        renderer.render(scene, camera);
        needsRender = false;
        lastCameraPosition.copy(camera.position);
        lastCameraRotation.copy(camera.quaternion);
      }
    }
    raf = requestAnimationFrame(animate);
    api.current = { camera };
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      visibilityObserver.disconnect();
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", blur);
      renderer.domElement.removeEventListener("pointerdown", down);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointercancel", up);
      scene.traverse((o) => {
        o.geometry?.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          m?.map?.dispose();
          m?.dispose();
        });
      });
      textures.forEach((t) => t.dispose());
      if (galleryVideo) {
        galleryVideo.pause();
        galleryVideo.removeAttribute("src");
        galleryVideo.load();
      }
      galleryVideoTexture?.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [photos, hero, title, dedication, question, videoUrl]);
  return (
    <div className={"museum-canvas " + (hero ? "hero-canvas" : "")} ref={host}>
      {failed && (
        <div className="canvas-fallback">
          <img src={photos[0]} alt="Your museum centrepiece" />
          <p>
            Your device doesn’t support the 3D view. Your memories are still
            here.
          </p>
        </div>
      )}
    </div>
  );
}
