# Our Museum

A private, multiplayer 3D photo museum. Built with React, Three.js, Express, and Socket.IO.

## Run locally

```sh
npm install
npm run dev
```

Open **http://localhost:3000**. The server binds to `0.0.0.0`, so other devices on the same network can use your computer’s LAN address. In Arena, share the live preview URL instead. API requests, uploads, and multiplayer connections all use the same origin.

## The experience

- An interactive, double-height classical museum inspired by historic European galleries: fluted stone columns, upper-level balustrades, a coffered ceiling, luminous brass chandeliers, marble trim, a detailed oak floor, gilt photo frames, curved velvet seating, and original romantic sculptures. Physically based materials, environment reflections, exhibit spotlights, warm ceiling lights, cool daylight fill, soft shadows, and contact shading give the room depth. Repeated architecture is instanced, and the room renders on demand when idle to save power.
- A three-step builder: choose 6–45 photos, name your museum, add your dedication, and optionally upload a film, soundtrack, and question.
- The first photo is the centrepiece. Photos can be promoted or removed before publishing. Every wall frame is centred in a full architectural alcove on a shared column grid, with a consistent hanging centreline. Portrait, square, wide, and panoramic images fit inside their mounts without cropping or stretching; the screen-back exhibits use the same fitting rules.
- Private invitation links and up to four simultaneous guests, with names, colored avatars, live movement, and chat.
- Paired gestures: hold hands, kiss, and kneel with an open ring box. Guests are brought together for the gesture.
- A spacious, 12.5-metre circular love rotunda at the centre of the hall: two freestanding screens facing curved rose-velvet seating, a warm suspended halo, brass heart floor inlay, and modeled rose arrangements. Four separated seating positions face the screens.
- Original, inspectable sculptural exhibits: embracing ivory figures, intertwined bronze hearts, and a ring in an open velvet box. Tap a sculpture for its exhibit label.
- The cinema is not the end of the museum: a central passage and wide side aisles lead to the photo wing beyond. The reverse sides of the screens are photo exhibits, too.
- Synchronized film play/pause, including a video texture on the physical gallery screen. Browser autoplay rules may require each guest to press play once.
- A separate question screen opposite the seats. Saying yes sends falling hearts to every connected guest.
- A personal soundtrack starts from the entrance click, before the 3D room mounts, and loops on each device. Web Audio places stereo speaker pairs at the same positions as the visible gallery speakers, updates the listener as guests walk, turn, and sit, and adds subtle simulated hall reverb, early reflections, distance attenuation, gentle fades, and film-audio ducking. Browsers that block playback get a one-tap retry; devices without Web Audio retain ordinary music playback. Music and its audio graph are cleaned up when leaving.
- Desktop keyboard controls, click-to-walk, drag-to-look, and touch direction buttons.
- A demo and a device-local “My museums” collection.

### Controls

Use **WASD / arrow keys** to walk. Drag the scene to look around, click the floor to walk to a point, or click a framed photo to inspect it. Click a curved bench or use **Take a seat** to settle into the circular salon, facing both screens. Use the toolbar for chat, gestures, music, and invitations. Click the left physical screen for your film, or the right one for your question. Both are also accessible from the upper-right **The love rotunda** shortcut. Walk through the centre or either side aisle to continue to the photo exhibits beyond the screens. Click a sculpture to read its museum label.

### Supported uploads

Photos: JPG, PNG, WebP, GIF. Film: MP4 or WebM. Audio: MP3, M4A, WAV, OGG. Up to 50 MB per file. Browser codec support still applies; MP4 (H.264) and MP3 are the most portable choices. HEIC should be exported as JPG first.

## Production

```sh
npm ci
npm run build
npm start
```

`PORT` defaults to `3000`. The production server serves the built app, API, media, and WebSockets together.

**Hosting requirements:** use a long-running Node.js host with WebSocket support and a persistent volume mounted at `museum-data/`. Standard Vercel serverless functions are not a drop-in host for this Socket.IO server. Museums and media are stored on disk; active guests and chat are held in memory. Use one server instance. A horizontally scaled deployment would need shared storage and a Socket.IO adapter.

## Tests

```sh
npm test             # starts an isolated server and tests API + real Socket.IO clients
npm run test:browser # with npm run dev already running on port 3000
```

The API suite covers invalid collections, image uploads, persisted museum retrieval, four-guest limits, distinct avatars, live movement, chat, proposal placements, shared hearts, film state, and departures. The browser smoke test covers automatic entrance playback with an uploaded WAV, the spatial audio graph, mute/resume/cleanup, removal of the old side collection button, creation, joining, chat, screening questions, hearts, seating, invitations, physical 3D film/question screen picking, sculpture inspection, photo inspection, saved museums, and mobile overflow. Floor-plan tests verify four distinct, screen-facing seats and continuous centre/side aisles into the far photo wing. Photo-layout tests cover every collection size from 6 to 45 and multiple source aspect ratios. Audio tests cover speaker coverage, stereo reverb decay, blocked-autoplay recovery, ducking, and cleanup. It uses an npm-packaged Chromium so it does not need a separate browser download. Screenshots are written to ignored `.arena/`.

## Privacy and scope

Museum links are unguessable bearer links, **not account-authenticated access**: anyone with the link can visit, subject to the four-person room limit. Do not put highly sensitive content in a shared museum. “My museums” is stored in the current browser, not an account. Closing the tab disconnects a guest; chat is not persisted. Keep `museum-data/` private and backed up on your host. For a public service, add authentication, retention/deletion controls, upload quotas, abuse protection, and object storage.

## Sample photography

Demo images are for the sample experience, not user-uploaded content. Original sources:

- [Chloe Ely Photography — beach engagement](https://chloeelyphotography.com/beach-engagement-photographer-uk-sunset)
- [Emily Alyssa — Amalfi Coast film photographs](https://emilyalyssa.com/amalfi-coast-photos-italy/)
- [Pexels — sunset embrace](https://www.pexels.com/photo/romantic-beach-sunset-embrace-of-couple-32084986/)
- [Flytographer — Amalfi Coast](https://www.flytographer.com/destinations/amalfi-coast/)
- [Pexels — couple at sunset](https://www.pexels.com/photo/romantic-couple-embracing-at-sunset-beach-30716714/)
