import express from "express";
import http from "node:http";
import { Server } from "socket.io";
import multer from "multer";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { visitorAppearance, GESTURE_DURATION } from "./src/visitorConfig.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const dataDir = path.resolve("museum-data");
fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
app.use(express.json({ limit: "1mb" }));
app.use(
  "/uploads",
  express.static(path.join(dataDir, "uploads"), {
    setHeaders: (res) => res.set("X-Content-Type-Options", "nosniff"),
  }),
);
const allowed = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
]);
const extensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/wav": ".wav",
  "audio/ogg": ".ogg",
};
const upload = multer({
  storage: multer.diskStorage({
    destination: path.join(dataDir, "uploads"),
    filename: (req, file, cb) =>
      cb(null, crypto.randomUUID() + extensions[file.mimetype]),
  }),
  limits: { fileSize: 50 * 1024 * 1024, files: 47 },
  fileFilter: (req, file, cb) => cb(null, allowed.has(file.mimetype)),
});
app.post("/api/upload", upload.array("files", 47), (req, res) =>
  res.json({
    files: req.files.map((f) => ({
      url: "/uploads/" + f.filename,
      type: f.mimetype,
      name: f.originalname,
    })),
  }),
);
function readMuseum(id) {
  if (!/^[a-f0-9]{16}$/.test(id)) return null;
  try {
    return JSON.parse(
      fs.readFileSync(path.join(dataDir, id + ".json"), "utf8"),
    );
  } catch {
    return null;
  }
}
app.post("/api/museums", (req, res) => {
  const b = req.body;
  if (
    !Array.isArray(b.photos) ||
    b.photos.length < 6 ||
    b.photos.length > 45 ||
    !b.photos.every(
      (p) => typeof p === "string" && /^\/(uploads|photos)\/[\w.-]+$/.test(p),
    )
  )
    return res.status(400).json({ error: "Choose between 6 and 45 photos." });
  const safeMedia = (p) =>
    typeof p === "string" && /^\/uploads\/[\w.-]+$/.test(p) ? p : "";
  const museum = {
    id: crypto.randomBytes(8).toString("hex"),
    title: String(b.title || "Our little world").slice(0, 80),
    dedication: String(b.dedication || "").slice(0, 800),
    question: String(b.question || "").slice(0, 180),
    photos: b.photos,
    video: safeMedia(b.video),
    song: safeMedia(b.song),
    created: Date.now(),
  };
  fs.writeFileSync(
    path.join(dataDir, museum.id + ".json"),
    JSON.stringify(museum),
  );
  res.json(museum);
});
app.get("/api/museums/:id", (req, res) => {
  const m = readMuseum(req.params.id);
  m
    ? res.json(m)
    : res.status(404).json({ error: "This museum could not be found." });
});
const rooms = new Map();
const colors = ["#a0ad87", "#d5a28c", "#a4b6c2", "#c6afd0"];
io.on("connection", (socket) => {
  socket.on("join", ({ id, name, avatar }, ack) => {
    if (socket.data.room) return;
    if (!readMuseum(id)) return ack?.({ error: "Museum not found." });
    const room = rooms.get(id) || new Map();
    if (room.size >= 4)
      return ack?.({
        error: "This little world is full. Four guests can visit at a time.",
      });
    const usedColors = [...room.values()].map((p) => p.color);
    const person = {
      id: socket.id,
      name: String(name || "Guest").slice(0, 24),
      ...visitorAppearance(
        avatar,
        colors.find((c) => !usedColors.includes(c)) || colors[0],
      ),
      x:
        [0, 1.1, -1.1, 2.2].find(
          (x) =>
            ![...room.values()].some(
              (p) => Math.hypot(p.x - x, p.z - 22) < 0.8,
            ),
        ) ?? -2.2,
      z: 22,
      rotation: 0,
      pose: "standing",
    };
    room.set(socket.id, person);
    rooms.set(id, room);
    socket.data.room = id;
    socket.join(id);
    ack?.({ id: socket.id, people: [...room.values()] });
    io.to(id).emit("people", [...room.values()]);
  });
  socket.on("move", (p) => {
    const room = rooms.get(socket.data.room),
      person = room?.get(socket.id);
    if (
      !person ||
      person.lockedUntil > Date.now() ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.z)
    )
      return;
    Object.assign(person, {
      x: Math.max(-30, Math.min(30, p.x)),
      z: Math.max(-6, Math.min(100, p.z)),
      rotation: Number(p.rotation) || 0,
      pose: p.pose === "sitting" ? "sitting" : "standing",
    });
    socket.to(socket.data.room).emit("move", person);
  });
  socket.on("chat", (text) => {
    const person = rooms.get(socket.data.room)?.get(socket.id);
    if (person && typeof text === "string" && text.trim())
      io.to(socket.data.room).emit("chat", {
        id: crypto.randomUUID(),
        name: person.name,
        text: text.trim().slice(0, 300),
        time: Date.now(),
      });
  });
  socket.on("action", (a) => {
    const room = rooms.get(socket.data.room),
      person = room?.get(socket.id);
    if (
      !person ||
      !a ||
      !["hands", "kiss", "propose", "yes", "video"].includes(a.type)
    )
      return;
    const target = room.get(a.target),
      placements = {};
    if (
      GESTURE_DURATION[a.type] &&
      (!target ||
        target.id === person.id ||
        [...room.values()].some((p) => p.lockedUntil > Date.now()))
    )
      return;
    if (
      target &&
      target.id !== person.id &&
      ["hands", "kiss", "propose"].includes(a.type)
    ) {
      const x = Math.max(-6, Math.min(6, target.x)),
        z = Math.max(-4, Math.min(85, target.z));
      if (a.type === "hands") {
        Object.assign(target, { x, z, rotation: 0, pose: "standing" });
        Object.assign(person, {
          x: x + 0.67,
          z,
          rotation: 0,
          pose: "standing",
        });
      } else {
        Object.assign(target, { x, z, rotation: Math.PI, pose: "standing" });
        Object.assign(person, {
          x,
          z: z + (a.type === "kiss" ? 0.65 : 1),
          rotation: 0,
          pose: "standing",
        });
      }
      person.lockedUntil = target.lockedUntil =
        Date.now() + GESTURE_DURATION[a.type];
      person.partnerId = target.id;
      target.partnerId = person.id;
      placements[target.id] = { ...target };
      placements[person.id] = { ...person };
      io.to(socket.data.room).emit("people", [...room.values()]);
    }
    io.to(socket.data.room).emit("action", {
      type: a.type,
      name: person.name,
      actor: socket.id,
      target: target?.id || null,
      placements,
      playing: !!a.playing,
      time: Math.max(0, Number(a.time) || 0),
    });
  });
  socket.on("disconnect", () => {
    const id = socket.data.room,
      room = rooms.get(id);
    if (room) {
      room.delete(socket.id);
      for (const person of room.values())
        if (person.partnerId === socket.id) {
          person.lockedUntil = 0;
          person.partnerId = null;
        }
      io.to(id).emit("interaction-end", { id: socket.id });
      if (!room.size) rooms.delete(id);
      else io.to(id).emit("people", [...room.values()]);
    }
  });
});
// API misses must not fall through to Vite / the production SPA's HTML page.
app.use("/api", (req, res) =>
  res.status(404).json({ error: "This museum API route could not be found." }),
);
app.use((err, req, res, next) =>
  res.status(400).json({
    error:
      err.code === "LIMIT_FILE_SIZE"
        ? "Each file must be smaller than 50 MB."
        : "The upload could not be completed.",
  }),
);
if (process.env.NODE_ENV === "production") {
  app.use(express.static("dist"));
  app.get("*", (req, res) => res.sendFile(path.resolve("dist/index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true, allowedHosts: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
server.listen(process.env.PORT || 3000, "0.0.0.0", () =>
  console.log("Our Museum is open on port " + (process.env.PORT || 3000)),
);
