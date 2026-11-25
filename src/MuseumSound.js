// Small distributed ceiling speakers, rather than a song fixed to the camera.
// This module is also imported by the 3D architecture so the audible sources
// and visible speaker models always occupy the same positions.
export function museumSpeakerPositions(depth) {
  const positions = [];
  for (let z = -1; z < depth - 1; z += 12) {
    for (const side of [-1, 1])
      positions.push({ x: side * 7.5, y: 5.1, z, channel: side < 0 ? 0 : 1 });
  }
  if (positions.at(-1).z < depth - 7) {
    for (const side of [-1, 1])
      positions.push({
        x: side * 7.5,
        y: 5.1,
        z: depth - 3,
        channel: side < 0 ? 0 : 1,
      });
  }
  return positions;
}
export const ROOM_SOUND = Object.freeze({
  volume: 0.3,
  wet: 0.12,
  decay: 1.85,
  preDelay: 0.024,
  lowPass: 10800,
});

// A short, diffuse stereo hall response with early wall reflections and a
// gently decaying tail. This simulates room acoustics; it is not an IR recording.
export function createHallImpulse(context) {
  const length = Math.ceil(context.sampleRate * (ROOM_SOUND.decay + 0.15));
  const buffer = context.createBuffer(2, length, context.sampleRate);
  let seed = 29173;
  const noise = () =>
    ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const time = i / context.sampleRate;
      const rise = Math.min(1, time / 0.018);
      data[i] =
        noise() * 0.22 * rise * Math.pow(10, (-3 * time) / ROOM_SOUND.decay);
    }
    [0.019, 0.031, 0.043, 0.067, 0.097, 0.143].forEach((time, index) => {
      const sample = Math.round((time + channel * 0.0027) * context.sampleRate);
      data[sample] += (index % 2 ? -0.14 : 0.19) / (1 + index * 0.45);
    });
  }
  return buffer;
}

export function createMuseumSound(url, depth) {
  let media = document.createElement("audio");
  let context = null,
    master = null,
    state = "idle",
    disposed = false,
    ducked = false,
    pauseTimer,
    playVersion = 0;
  const subscribers = new Set(),
    nodes = [];
  function configureMedia(element) {
    element.src = url;
    element.loop = true;
    element.preload = "auto";
    element.hidden = true;
    element.dataset.museumSoundtrack = "true";
    element.addEventListener("error", () => {
      if (!disposed) publish("error");
    });
    document.body.appendChild(element);
  }
  function publish(next) {
    if (disposed) return;
    state = next;
    media.dataset.playbackState = next;
    subscribers.forEach((listener) => listener(next));
  }
  function track(node) {
    nodes.push(node);
    return node;
  }
  configureMedia(media);
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      context = new AudioContext({ latencyHint: "playback" });
      const source = track(context.createMediaElementSource(media));
      const highPass = track(context.createBiquadFilter());
      highPass.type = "highpass";
      highPass.frequency.value = 38;
      const tone = track(context.createBiquadFilter());
      tone.type = "lowpass";
      tone.frequency.value = ROOM_SOUND.lowPass;
      tone.Q.value = 0.5;
      const stereo = track(context.createGain());
      stereo.channelCount = 2;
      stereo.channelCountMode = "explicit";
      const splitter = track(context.createChannelSplitter(2));
      source.connect(highPass);
      highPass.connect(tone);
      tone.connect(stereo);
      stereo.connect(splitter);
      const room = track(context.createGain());
      const speakers = museumSpeakerPositions(depth);
      for (const speaker of speakers) {
        const gain = track(context.createGain());
        gain.gain.value = 0.46 / Math.sqrt(speakers.length / 2);
        const panner = track(context.createPanner());
        panner.panningModel = "HRTF";
        panner.distanceModel = "inverse";
        panner.refDistance = 7;
        panner.maxDistance = 55;
        panner.rolloffFactor = 0.55;
        panner.coneInnerAngle = 210;
        panner.coneOuterAngle = 300;
        panner.coneOuterGain = 0.72;
        panner.positionX.value = speaker.x;
        panner.positionY.value = speaker.y;
        panner.positionZ.value = speaker.z;
        panner.orientationX.value = speaker.x < 0 ? 1 : -1;
        panner.orientationY.value = 0;
        panner.orientationZ.value = 0;
        splitter.connect(gain, speaker.channel);
        gain.connect(panner);
        panner.connect(room);
      }
      master = track(context.createGain());
      master.gain.value = 0;
      const dry = track(context.createGain());
      dry.gain.value = 0.91;
      const preDelay = track(context.createDelay(0.1));
      preDelay.delayTime.value = ROOM_SOUND.preDelay;
      const convolver = track(context.createConvolver());
      convolver.buffer = createHallImpulse(context);
      const damping = track(context.createBiquadFilter());
      damping.type = "lowpass";
      damping.frequency.value = 6200;
      const wet = track(context.createGain());
      wet.gain.value = ROOM_SOUND.wet;
      room.connect(dry);
      dry.connect(master);
      room.connect(preDelay);
      preDelay.connect(convolver);
      convolver.connect(damping);
      damping.connect(wet);
      wet.connect(master);
      const compressor = track(context.createDynamicsCompressor());
      compressor.threshold.value = -16;
      compressor.knee.value = 18;
      compressor.ratio.value = 2;
      compressor.attack.value = 0.015;
      compressor.release.value = 0.25;
      master.connect(compressor);
      compressor.connect(context.destination);
      media.dataset.roomAudio = "spatial";
      context.onstatechange = () => {
        if (!disposed) media.dataset.audioContext = context.state;
      };
    } else media.volume = ROOM_SOUND.volume;
  } catch {
    // Preserve normal music playback if a device does not support this graph.
    nodes.forEach((node) => {
      try {
        node.disconnect();
      } catch {}
    });
    context?.close().catch(() => {});
    context = null;
    master = null;
    media.pause();
    media.removeAttribute("src");
    media.load();
    media.remove();
    media = document.createElement("audio");
    configureMedia(media);
    media.volume = ROOM_SOUND.volume;
  }
  function smooth(parameter, value, constant = 0.07) {
    if (!context || !parameter) return;
    parameter.cancelScheduledValues(context.currentTime);
    parameter.setTargetAtTime(value, context.currentTime, constant);
  }
  function volume(playing, constant = 0.3) {
    const target = playing ? ROOM_SOUND.volume * (ducked ? 0.22 : 1) : 0;
    if (master) smooth(master.gain, target, constant);
    else media.volume = target;
  }
  function updateListener(
    position,
    forward = { x: 0, y: 0, z: -1 },
    up = { x: 0, y: 1, z: 0 },
  ) {
    if (!context || disposed) return;
    const listener = context.listener;
    if (listener.positionX) {
      for (const axis of ["x", "y", "z"]) {
        const suffix = axis.toUpperCase();
        smooth(listener["position" + suffix], position[axis]);
        smooth(listener["forward" + suffix], forward[axis]);
        smooth(listener["up" + suffix], up[axis]);
      }
    } else {
      listener.setPosition(position.x, position.y, position.z);
      listener.setOrientation(
        forward.x,
        forward.y,
        forward.z,
        up.x,
        up.y,
        up.z,
      );
    }
  }
  updateListener({ x: 0, y: 1.7, z: 22 });
  return {
    get state() {
      return state;
    },
    subscribe(listener) {
      subscribers.add(listener);
      listener(state);
      return () => subscribers.delete(listener);
    },
    async play() {
      if (disposed) return false;
      const version = ++playVersion;
      clearTimeout(pauseTimer);
      publish("starting");
      try {
        // Both calls happen synchronously inside the entrance click/submit,
        // before the heavy WebGL scene mounts, preserving user activation.
        const resume = context?.resume();
        const playback = media.play();
        await Promise.all([resume, playback]);
        if (disposed || version !== playVersion) return false;
        publish("playing");
        volume(true, 0.38);
        return true;
      } catch (error) {
        if (disposed || version !== playVersion) return false;
        publish(error.name === "NotAllowedError" ? "blocked" : "error");
        return false;
      }
    },
    pause() {
      if (disposed) return;
      ++playVersion;
      publish("muted");
      volume(false, 0.055);
      clearTimeout(pauseTimer);
      pauseTimer = setTimeout(() => media.pause(), 200);
    },
    setDucked(value) {
      ducked = value;
      volume(state === "playing", value ? 0.1 : 0.55);
    },
    updateListener,
    dispose() {
      if (disposed) return;
      disposed = true;
      ++playVersion;
      clearTimeout(pauseTimer);
      media.pause();
      media.removeAttribute("src");
      media.load();
      media.remove();
      nodes.forEach((node) => {
        try {
          node.disconnect();
        } catch {}
      });
      context?.close().catch(() => {});
      subscribers.clear();
    },
  };
}
