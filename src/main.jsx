import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  Plus,
  X,
  Check,
  Heart,
  Users,
  Image as ImageIcon,
  Play,
  Volume2,
  VolumeX,
  MessageCircle,
  Send,
  Link,
  Copy,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Upload,
  Film,
  Music2,
  LockKeyhole,
  Sparkles,
  Footprints,
  Armchair,
  Hand,
  Gem,
  Maximize2,
  Menu,
  LoaderCircle,
  Trash2,
  Move,
  MousePointer2,
  DoorOpen,
  Camera,
} from "lucide-react";
import { io } from "socket.io-client";
import "@fontsource/cormorant-garamond/latin-400.css";
import "@fontsource/cormorant-garamond/latin-500.css";
import "@fontsource/cormorant-garamond/latin-500-italic.css";
import "@fontsource/cormorant-garamond/latin-600.css";
import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import MuseumScene from "./MuseumScene";
import { requestJson } from "./api.js";
import { createMuseumSound } from "./MuseumSound";
import { galleryDepth } from "./galleryLayout";
import {
  VISITOR_OUTFITS,
  visitorAppearance,
  GESTURE_DURATION,
} from "./visitorConfig";
import "./styles.css";

const DEMO_PHOTOS = Array.from(
  { length: 6 },
  (_, i) => `/photos/0${i + 1}.jpg`,
);
const DEMO = {
  id: "demo",
  title: "A gallery of us",
  dedication:
    "For the big adventures and the quiet, ordinary days. For every version of us, and all the memories we haven’t made yet. This little world is for you.",
  question: "Shall we keep making memories together?",
  photos: DEMO_PHOTOS,
  video: "",
  song: "",
};
function Logo({ onClick, light = false }) {
  return (
    <button
      className={"brand " + (light ? "light" : "")}
      onClick={onClick}
      aria-label="Our Museum home"
    >
      <svg viewBox="0 0 34 37" fill="none" aria-hidden="true">
        <path
          d="M3 12 17 4l14 8H3ZM3 32h28M5 35h24M7 15v14m7-14v14m6-14v14m7-14v14"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="M16 8h2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span>
        our museum<span className="brand-dot">®</span>
      </span>
    </button>
  );
}
function Modal({ children, onClose, className = "", label }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const close = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const els = [
          ...ref.current.querySelectorAll(
            "button,input,textarea,select,a[href]",
          ),
        ].filter((el) => !el.disabled);
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector("input,button")?.focus();
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = "";
      prev?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={ref}
        className={"modal " + className}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <button
          className="icon-button close-modal"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>
        {children}
      </section>
    </div>
  );
}
function AvatarPicker({ value, onChange }) {
  return (
    <div className="avatar-picker">
      <div
        className="character-preview"
        style={{ "--shirt": value.color }}
        data-hair={value.hair}
        aria-label="Your character preview"
      >
        <i className="preview-hair" />
        <i className="preview-face" />
        <i className="preview-shirt" />
        <i className="preview-legs" />
      </div>
      <div className="avatar-options">
        <span className="field-label">Your character</span>
        <div
          className="outfit-options"
          role="group"
          aria-label="Character outfit"
        >
          {VISITOR_OUTFITS.map((outfit) => (
            <button
              type="button"
              key={outfit.color}
              style={{ background: outfit.color }}
              aria-label={outfit.name + " outfit"}
              aria-pressed={value.color === outfit.color}
              onClick={() => onChange({ ...value, color: outfit.color })}
            >
              {value.color === outfit.color && <Check size={12} />}
            </button>
          ))}
        </div>
        <div className="hair-options" role="group" aria-label="Character hair">
          {["short", "long"].map((hair) => (
            <button
              type="button"
              key={hair}
              aria-pressed={value.hair === hair}
              onClick={() => onChange({ ...value, hair })}
            >
              {hair === "short" ? "Short hair" : "Long hair"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
function App() {
  const [view, setView] = useState("home"),
    [museum, setMuseum] = useState(DEMO),
    [builder, setBuilder] = useState(false),
    [collection, setCollection] = useState(false),
    [join, setJoin] = useState(null),
    [name, setName] = useState(""),
    [visitorAvatar, setVisitorAvatar] = useState(() => {
      try {
        return visitorAppearance(
          JSON.parse(localStorage.getItem("museum-visitor") || "null"),
        );
      } catch {
        return visitorAppearance(null);
      }
    }),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState("");
  const [saved, setSaved] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("our-museums") || "[]");
    } catch {
      return [];
    }
  });
  const toastTimer = useRef();
  const soundtrackRef = useRef(null);
  useEffect(() => () => soundtrackRef.current?.dispose(), []);
  const notify = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  };
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("room");
    if (id) openMuseum(id);
  }, []);
  async function openMuseum(id) {
    setLoading(true);
    setError("");
    try {
      const data = await requestJson("/api/museums/" + encodeURIComponent(id));
      setJoin(data);
      setCollection(false);
    } catch (e) {
      notify(e.message || "Could not open this museum. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  function enter(data, guestName, appearance = visitorAvatar) {
    soundtrackRef.current?.dispose();
    soundtrackRef.current = data.song
      ? createMuseumSound(data.song, galleryDepth(data.photos.length))
      : null;
    soundtrackRef.current?.play();
    localStorage.setItem("museum-visitor", JSON.stringify(appearance));
    setMuseum({
      ...data,
      guestName: guestName || "You",
      visitorAvatar: appearance,
    });
    setView("gallery");
    setJoin(null);
    if (data.id !== "demo") history.replaceState({}, "", "?room=" + data.id);
    window.scrollTo(0, 0);
  }
  function home() {
    soundtrackRef.current?.dispose();
    soundtrackRef.current = null;
    setView("home");
    history.replaceState({}, "", location.pathname);
  }
  function remember(m) {
    const next = [
      { id: m.id, title: m.title, cover: m.photos[0], created: m.created },
      ...saved.filter((s) => s.id !== m.id),
    ].slice(0, 30);
    setSaved(next);
    localStorage.setItem("our-museums", JSON.stringify(next));
  }
  return (
    <>
      {view === "home" ? (
        <Landing
          onCreate={() => setBuilder(true)}
          onDemo={() => enter(DEMO)}
          paused={builder || collection || !!join}
          onCollection={() => setCollection(true)}
          loading={loading}
        />
      ) : (
        <Gallery
          museum={museum}
          soundtrack={soundtrackRef.current}
          onHome={home}
          notify={notify}
          onSave={remember}
        />
      )}
      {builder && (
        <Builder
          onClose={() => setBuilder(false)}
          onCreated={(m) => {
            remember(m);
            setBuilder(false);
            setJoin(m);
          }}
          notify={notify}
        />
      )}
      {collection && (
        <Modal
          onClose={() => setCollection(false)}
          label="Your museums"
          className="collection-modal"
        >
          <span className="eyebrow">YOUR PRIVATE COLLECTION</span>
          <h2>Places you’ve made.</h2>
          <p className="muted">
            A little collection of your favorite people and moments.
          </p>
          {saved.length ? (
            <div className="saved-list">
              {saved.map((m) => (
                <button
                  className="saved-museum"
                  key={m.id}
                  onClick={() => openMuseum(m.id)}
                  disabled={loading}
                >
                  <img src={m.cover} alt="Museum cover" />
                  <span>
                    <strong>{m.title}</strong>
                    <small>Private museum · Open your doors</small>
                  </span>
                  <ArrowUpRight size={22} />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <ImageIcon size={32} strokeWidth={1} />
              <h3>Your story starts here.</h3>
              <p>
                You haven’t created a museum on this device yet.
                <br />
                Let’s give your memories a home.
              </p>
            </div>
          )}
          <button
            className="button primary"
            onClick={() => {
              setCollection(false);
              setBuilder(true);
            }}
          >
            <Plus size={17} /> Create a museum
          </button>
        </Modal>
      )}
      {join && (
        <Modal
          onClose={() => {
            setJoin(null);
            history.replaceState({}, "", location.pathname);
          }}
          label="Enter museum"
          className="join-modal"
        >
          <div className="join-cover">
            <img src={join.photos[0]} alt="The museum’s centrepiece" />
            <span>
              <LockKeyhole size={13} /> A PRIVATE LITTLE WORLD
            </span>
          </div>
          <span className="eyebrow">YOU’RE INVITED</span>
          <h2>{join.title}</h2>
          <p className="muted">
            Leave the outside world at the door.
            <br />
            What should we call you in here?
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) enter(join, name.trim(), visitorAvatar);
            }}
          >
            <label className="field-label" htmlFor="guest-name">
              Your name
            </label>
            <input
              id="guest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="A name your people know"
              required
              autoComplete="given-name"
            />
            <AvatarPicker value={visitorAvatar} onChange={setVisitorAvatar} />
            <button className="button primary full" type="submit">
              Step inside <ArrowRight size={18} />
            </button>
          </form>
          <small className="privacy-note">
            <Users size={14} /> A space for up to four, including you.
          </small>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <span className="toast-dot" />
          {toast}
          <button
            onClick={() => setToast("")}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
    </>
  );
}
function Landing({ onCreate, onDemo, onCollection, loading, paused }) {
  const [mobileNav, setMobileNav] = useState(false);
  return (
    <div className="landing">
      <header className="site-header">
        <Logo onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
        <nav className={mobileNav ? "open" : ""}>
          <a href="#experience" onClick={() => setMobileNav(false)}>
            The experience
          </a>
          <a href="#how-it-works" onClick={() => setMobileNav(false)}>
            How it works
          </a>
          <button onClick={onCollection}>
            My museums <span className="nav-small-arrow">↗</span>
          </button>
        </nav>
        <div className="header-actions">
          <button className="button primary header-create" onClick={onCreate}>
            Create a museum <Plus size={16} />
          </button>
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileNav(!mobileNav)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>
        </div>
      </header>
      <main>
        <section className="hero-section" id="experience">
          <div className="hero-copy">
            <div className="eyebrow">
              <span className="tiny-star">✳</span> FOR THE ART THAT IS YOUR LIFE
            </div>
            <h1>
              A little world.
              <br />
              All about
              <br />
              <em>you two.</em>
              <span className="hand-heart">
                <Heart size={37} strokeWidth={1.1} />
                <span>made with love</span>
              </span>
            </h1>
            <p>
              Your photos. Your people. Your own quiet museum.
              <br className="desktop-br" /> A place to wander, remember, and be
              <br className="desktop-br" /> a little closer — wherever you are.
            </p>
            <div className="hero-actions">
              <button className="button primary large" onClick={onCreate}>
                Create your museum <ArrowUpRight size={19} />
              </button>
              <button className="text-button" onClick={onDemo}>
                Take a little tour{" "}
                <span className="play-circle">
                  <Play size={11} fill="currentColor" />
                </span>
              </button>
            </div>
            <div className="hero-proof">
              <div className="mini-frames">
                <img src="/photos/01.jpg" alt="A memory at sunset" />
                <img src="/photos/02.jpg" alt="Memories of the coast" />
                <img src="/photos/03.jpg" alt="A favorite place" />
              </div>
              <span>
                Not another photo album.
                <br />
                <strong>A place you can be together.</strong>
              </span>
            </div>
          </div>
          <div className="hero-visual">
            <div className="gallery-preview">
              <MuseumScene photos={DEMO_PHOTOS} hero paused={paused} />
              <div className="preview-top">
                <span className="preview-tag">
                  <span /> A GALLERY OF US
                </span>
                <span className="preview-corner">EST. WITH LOVE</span>
              </div>
              <div className="gallery-vignette" />
              <div className="preview-bottom">
                <div className="preview-label">
                  <span className="live-dot" /> A little closer, even from far
                  away.
                </div>
                <button
                  onClick={onDemo}
                  className="preview-enter"
                  aria-label="Explore the demo museum"
                >
                  <ArrowUpRight size={24} />
                </button>
              </div>
              <span className="preview-drag">
                <Move size={12} /> A REAL, WALKABLE 3D SPACE
              </span>
            </div>
            <div className="floating-note">
              <span className="note-icon">
                <Heart size={16} strokeWidth={1.5} />
              </span>
              <span>
                Some memories deserve
                <br />
                <strong>more than a camera roll.</strong>
              </span>
              <svg viewBox="0 0 55 36" className="note-arrow" fill="none">
                <path
                  d="M3 28C34 41 46 17 39 5m0 0-4 13M39 5l12 8"
                  stroke="currentColor"
                  strokeWidth="1.2"
                />
              </svg>
            </div>
            <div className="visual-caption">
              <span>01 — YOUR STORY, ON DISPLAY</span>
              <span>BUILT FOR TWO. ROOM FOR FOUR.</span>
            </div>
          </div>
        </section>
        <section className="feature-ribbon" aria-label="Museum features">
          <div>
            <ImageIcon size={21} strokeWidth={1.3} />
            <span>
              <strong>Made from your memories</strong>
              <small>6–45 photos, beautifully framed</small>
            </span>
          </div>
          <div>
            <Users size={22} strokeWidth={1.3} />
            <span>
              <strong>Different places. Together.</strong>
              <small>Explore live with up to 4 people</small>
            </span>
          </div>
          <div>
            <Film size={22} strokeWidth={1.3} />
            <span>
              <strong>A moment worth staying for</strong>
              <small>Your film. Your song. Your question.</small>
            </span>
          </div>
          <div>
            <LockKeyhole size={21} strokeWidth={1.3} />
            <span>
              <strong>Just for your people</strong>
              <small>Private, and shared by invitation</small>
            </span>
          </div>
        </section>
        <section className="closer-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">MORE THAN A PLACE TO LOOK</span>
              <h2>
                A place to <em>feel.</em>
              </h2>
            </div>
            <p>
              Because the best part of a memory
              <br />
              is who you share it with.
            </p>
          </div>
          <div className="experience-grid">
            <button className="experience-card memories-card" onClick={onDemo}>
              <div className="card-image">
                <img
                  src="/photos/01.jpg"
                  alt="A couple sharing a quiet moment by the sea"
                />
                <span className="image-badge">
                  <ImageIcon size={13} /> YOUR MOMENTS, MADE TIMELESS
                </span>
              </div>
              <div className="card-copy">
                <span className="card-number">01</span>
                <div>
                  <h3>Every photo has a home.</h3>
                  <p>Framed, lit, and given the space it deserves.</p>
                </div>
                <ArrowUpRight size={21} />
              </div>
            </button>
            <button className="experience-card together-card" onClick={onDemo}>
              <div className="together-visual">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <div className="hand-medallion">
                  <Hand size={42} strokeWidth={0.9} />
                  <Heart size={18} className="little-heart" fill="#bd7c66" />
                </div>
                <span className="floating-word word-one">hold my hand?</span>
                <span className="floating-word word-two">always. ♡</span>
                <div className="online-pill">
                  <span className="live-dot" /> TOGETHER, IN REAL TIME
                </div>
              </div>
              <div className="card-copy">
                <span className="card-number">02</span>
                <div>
                  <h3>Small gestures. Big feelings.</h3>
                  <p>Hold hands, steal a kiss, or ask forever.</p>
                </div>
                <ArrowUpRight size={21} />
              </div>
            </button>
            <button className="experience-card film-card" onClick={onDemo}>
              <div className="film-visual">
                <div className="mini-screen">
                  <div className="screen-still">
                    <img src="/photos/04.jpg" alt="A sunset to remember" />
                    <span className="screen-play">
                      <Play size={16} fill="currentColor" />
                    </span>
                  </div>
                  <span>OUR FAVORITE FILM: US.</span>
                </div>
                <div className="mini-bench" />
                <span className="film-sparkle">✧</span>
              </div>
              <div className="card-copy">
                <span className="card-number">03</span>
                <div>
                  <h3>Stay for the happy ending.</h3>
                  <p>Sit down. Press play. Make a new memory.</p>
                </div>
                <ArrowUpRight size={21} />
              </div>
            </button>
          </div>
        </section>
        <section className="how-section" id="how-it-works">
          <div className="how-intro">
            <span className="eyebrow">
              A FEW MINUTES. A FOREVER KIND OF FEELING.
            </span>
            <h2>
              Your story.
              <br />
              <em>Your museum.</em>
            </h2>
            <button className="text-button" onClick={onCreate}>
              Let’s make something personal <ArrowUpRight size={18} />
            </button>
          </div>
          <div className="how-steps">
            {[
              [
                "01",
                "Bring your memories.",
                "Choose 6–45 photos. Add a dedication, a short film, or the song that takes you back.",
              ],
              [
                "02",
                "Make it yours.",
                "Your first photo becomes the centrepiece. Add a special question, if there’s something on your heart.",
              ],
              [
                "03",
                "Open the doors.",
                "Share your private link. Walk in together from your own devices, and let the world wait.",
              ],
            ].map(([n, t, d]) => (
              <div className="how-step" key={n}>
                <span>{n}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="closing-note">
          <span>♡</span>
          <h2>
            For the moments you’d
            <br />
            live <em>all over again.</em>
          </h2>
          <button className="button primary large" onClick={onCreate}>
            Build your little world <ArrowUpRight size={19} />
          </button>
          <small>No downloads. Just a link, and your favorite people.</small>
        </section>
      </main>
      <footer>
        <Logo onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
        <span>A little internet. A lot of feeling.</span>
        <span>
          MADE FOR YOUR KIND OF FOREVER <Heart size={12} />
        </span>
      </footer>
      {loading && (
        <div className="loading-overlay">
          <LoaderCircle className="spin" /> Opening the doors…
        </div>
      )}
    </div>
  );
}
function Builder({ onClose, onCreated, notify }) {
  const [step, setStep] = useState(0),
    [photos, setPhotos] = useState([]),
    [title, setTitle] = useState("Our little world"),
    [dedication, setDedication] = useState(""),
    [question, setQuestion] = useState(""),
    [video, setVideo] = useState(null),
    [song, setSong] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = useRef(),
    objectUrls = useRef([]);
  useEffect(() => () => objectUrls.current.forEach(URL.revokeObjectURL), []);
  function addPhotos(files) {
    const valid = [...files].filter(
      (f) =>
        ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
          f.type,
        ) && f.size <= 50 * 1024 * 1024,
    );
    if (valid.length < files.length)
      setError("Choose JPG, PNG, WebP, or GIF images under 50 MB.");
    else setError("");
    setPhotos((prev) =>
      [
        ...prev,
        ...valid.map((file) => {
          const url = URL.createObjectURL(file);
          objectUrls.current.push(url);
          return { url, file, name: file.name };
        }),
      ].slice(0, 45),
    );
  }
  function mediaFile(file, type) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError("Please choose a file smaller than 50 MB.");
      return;
    }
    if (
      !(
        type === "video"
          ? ["video/mp4", "video/webm"]
          : ["audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg"]
      ).includes(file.type)
    ) {
      setError(
        "That format is not supported. Please use " +
          (type === "video" ? "MP4 or WebM." : "MP3, M4A, WAV, or OGG."),
      );
      return;
    }
    setError("");
    type === "video" ? setVideo(file) : setSong(file);
  }
  async function publish() {
    setBusy(true);
    setError("");
    try {
      const originals = photos.filter((p) => p.file),
        form = new FormData();
      originals.forEach((p) => form.append("files", p.file));
      if (video) form.append("files", video);
      if (song) form.append("files", song);
      let uploaded = [];
      if ([...form.keys()].length) {
        const d = await requestJson(
          "/api/upload",
          { method: "POST", body: form },
          "upload",
        );
        uploaded = d.files;
        if (
          uploaded.length !==
          originals.length + (video ? 1 : 0) + (song ? 1 : 0)
        )
          throw new Error(
            "Some files were not supported. Please choose another format.",
          );
      }
      let i = 0;
      const urls = photos.map((p) => (p.file ? uploaded[i++].url : p.url));
      const videoUrl = video ? uploaded[i++].url : "",
        songUrl = song ? uploaded[i++].url : "";
      const m = await requestJson("/api/museums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: urls,
          title,
          dedication,
          question,
          video: videoUrl,
          song: songUrl,
        }),
      });
      onCreated(m);
    } catch (e) {
      setError(
        e.message ||
          "Something went wrong. Your memories are still here — please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      onClose={() => !busy && onClose()}
      label="Create your museum"
      className="builder-modal"
    >
      <div className="builder-sidebar">
        <Logo />
        <div className="builder-sidebar-copy">
          <span className="eyebrow">LET’S MAKE IT PERSONAL</span>
          <h2>
            A home for
            <br />
            your{" "}
            <em>
              favorite
              <br />
              moments.
            </em>
          </h2>
          <p>
            Just a few little details.
            <br />
            We’ll take care of the frames.
          </p>
        </div>
        <div className="builder-steps">
          {["Your memories", "Your words", "The finishing touches"].map(
            (s, i) => (
              <button
                key={s}
                className={i === step ? "active" : i < step ? "complete" : ""}
                disabled={i > step || busy}
                onClick={() => setStep(i)}
              >
                <span>{i < step ? <Check size={13} /> : `0${i + 1}`}</span>
                {s}
              </button>
            ),
          )}
        </div>
        <div className="builder-privacy">
          <LockKeyhole size={14} /> Only the people with your link.
        </div>
      </div>
      <div className="builder-main">
        <span className="eyebrow">STEP 0{step + 1} OF 03</span>
        {step === 0 ? (
          <>
            <h2>Start with the memories.</h2>
            <p className="muted">
              Choose 6–45 photos. Your first becomes the centrepiece.
              <br />
              Tap any photo’s star to make it the one.
            </p>
            <input
              type="file"
              ref={input}
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                addPhotos(e.target.files);
                e.target.value = "";
              }}
            />
            <button
              className="upload-zone"
              onClick={() => input.current.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                addPhotos(e.dataTransfer.files);
              }}
            >
              <span className="upload-icon">
                <ImageIcon size={24} strokeWidth={1.3} />
                <Plus size={12} />
              </span>
              <strong>Drop your favorite moments here</strong>
              <span>
                or <u>browse your photos</u>
              </span>
              <small>JPG, PNG, WebP, GIF · Up to 50 MB each</small>
            </button>
            {photos.length > 0 && (
              <>
                <div className="photo-grid-label">
                  <span>{photos.length} / 45 PHOTOS</span>
                  <button onClick={() => setPhotos([])}>Clear all</button>
                </div>
                <div className="photo-upload-grid">
                  {photos.map((p, i) => (
                    <div
                      key={p.url + i}
                      className={i === 0 ? "centrepiece" : ""}
                    >
                      <img src={p.url} alt={p.name || `Memory ${i + 1}`} />
                      <button
                        className="photo-star"
                        title="Make centrepiece"
                        aria-label={`Make photo ${i + 1} the centrepiece`}
                        onClick={() =>
                          setPhotos([p, ...photos.filter((_, j) => j !== i)])
                        }
                      >
                        <Sparkles size={12} />
                        {i === 0 && " Centrepiece"}
                      </button>
                      <button
                        className="photo-delete"
                        aria-label={`Remove photo ${i + 1}`}
                        onClick={() =>
                          setPhotos(photos.filter((_, j) => j !== i))
                        }
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
            <div className="sample-option">
              <span>Just looking around?</span>
              <button
                onClick={() => {
                  setPhotos(
                    DEMO_PHOTOS.map((url, i) => ({
                      url,
                      name: `Sample memory ${i + 1}`,
                    })),
                  );
                  setError("");
                }}
              >
                Try our sample memories <ArrowUpRight size={13} />
              </button>
            </div>
          </>
        ) : step === 1 ? (
          <>
            <h2>A few words, from you.</h2>
            <p className="muted">
              A name for your little world, and a dedication to greet
              <br />
              your people at the entrance.
            </p>
            <label className="field-label" htmlFor="museum-title">
              Your museum’s name <span>REQUIRED</span>
            </label>
            <input
              id="museum-title"
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Our little world"
            />
            <label
              className="field-label dedication-label"
              htmlFor="dedication"
            >
              The dedication <span>OPTIONAL</span>
            </label>
            <textarea
              id="dedication"
              maxLength={800}
              value={dedication}
              onChange={(e) => setDedication(e.target.value)}
              rows={5}
              placeholder="For the big adventures and the quiet, ordinary days. For every version of us…"
            />
            <div className="char-count">{dedication.length} / 800</div>
            <div className="dedication-preview">
              <span>AT THE ENTRANCE</span>
              <h3>{title || "Our little world"}</h3>
              <p>
                “
                {dedication ||
                  "Your words will hang here. Something only you could say."}
                ”
              </p>
              <Heart size={15} strokeWidth={1} />
            </div>
          </>
        ) : (
          <>
            <h2>Make a moment of it.</h2>
            <p className="muted">
              A few optional touches to make it feel even more like you.
              <br />
              Beautiful with them. Just as special without.
            </p>
            <label className={"media-upload " + (video ? "has-file" : "")}>
              <span className="media-icon">
                <Film size={21} strokeWidth={1.4} />
              </span>
              <span>
                <strong>
                  {video ? video.name : "A film for the gallery screen"}
                </strong>
                <small>
                  {video
                    ? "Ready for your private screening"
                    : "A short video, a favorite memory · MP4 or WebM"}
                </small>
              </span>
              {video ? <Check size={18} /> : <Plus size={18} />}
              <input
                type="file"
                accept="video/mp4,video/webm"
                onChange={(e) => mediaFile(e.target.files[0], "video")}
              />
            </label>
            {video && (
              <button className="remove-media" onClick={() => setVideo(null)}>
                Remove film
              </button>
            )}
            <label className={"media-upload " + (song ? "has-file" : "")}>
              <span className="media-icon">
                <Music2 size={21} strokeWidth={1.4} />
              </span>
              <span>
                <strong>
                  {song ? song.name : "The soundtrack to your story"}
                </strong>
                <small>
                  {song
                    ? "On repeat, as you wander"
                    : "Your song, softly on repeat · MP3, M4A, WAV, OGG"}
                </small>
              </span>
              {song ? <Check size={18} /> : <Plus size={18} />}
              <input
                type="file"
                accept="audio/mpeg,audio/mp4,audio/wav,audio/ogg"
                onChange={(e) => mediaFile(e.target.files[0], "song")}
              />
            </label>
            {song && (
              <button className="remove-media" onClick={() => setSong(null)}>
                Remove song
              </button>
            )}
            <label className="field-label dedication-label" htmlFor="question">
              <span className="question-label">
                <Heart size={16} /> Something you’d like to ask?
              </span>
              <span>OPTIONAL</span>
            </label>
            <input
              id="question"
              value={question}
              maxLength={180}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Will you keep making memories with me?"
            />
            <p className="field-hint">
              It will appear on the gallery screen. A yes makes hearts fall for
              everyone.
            </p>
            <div className="ready-note">
              <Sparkles size={18} />
              <div>
                <strong>
                  {photos.length} memories. One very special place.
                </strong>
                <span>
                  Your museum will be ready the moment you open its doors.
                </span>
              </div>
            </div>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="builder-bottom">
          {step > 0 ? (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <small>
              <LockKeyhole size={12} /> Private by design.
            </small>
          )}
          <button
            className="button primary"
            disabled={
              busy ||
              (step === 0 && photos.length < 6) ||
              (step === 1 && !title.trim())
            }
            onClick={() => (step < 2 ? setStep(step + 1) : publish())}
          >
            {busy ? (
              <>
                <LoaderCircle size={16} className="spin" /> Framing your
                memories…
              </>
            ) : step === 2 ? (
              <>
                Open the doors <ArrowUpRight size={17} />
              </>
            ) : (
              <>
                Continue <ArrowRight size={17} />
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
function Gallery({
  museum: initialMuseum,
  soundtrack,
  onHome,
  notify,
  onSave,
}) {
  const [museum, setMuseum] = useState(initialMuseum),
    [people, setPeople] = useState([]),
    [myId, setMyId] = useState("local"),
    [status, setStatus] = useState(
      initialMuseum.id === "demo" ? "demo" : "connecting",
    ),
    [invite, setInvite] = useState(false),
    [copied, setCopied] = useState(false),
    [creating, setCreating] = useState(false),
    [chatOpen, setChatOpen] = useState(false),
    [messages, setMessages] = useState([]),
    [chat, setChat] = useState(""),
    [unread, setUnread] = useState(0),
    [seat, setSeat] = useState(false),
    [cameraMode, setCameraMode] = useState("first"),
    [partnerPicker, setPartnerPicker] = useState(null),
    [audioStatus, setAudioStatus] = useState(soundtrack?.state || "idle"),
    [photo, setPhoto] = useState(null),
    [screen, setScreen] = useState(false),
    [screenMode, setScreenMode] = useState("both"),
    [exhibit, setExhibit] = useState(null),
    [help, setHelp] = useState(false),
    [hearts, setHearts] = useState(0),
    [action, setAction] = useState(null),
    [gesture, setGesture] = useState(null),
    [movement, setMovement] = useState({}),
    [connectionError, setConnectionError] = useState("");
  const socket = useRef(),
    video = useRef(),
    chatEnd = useRef(),
    chatOpenRef = useRef(false),
    timers = useRef([]);
  const music = audioStatus === "playing" || audioStatus === "starting";
  chatOpenRef.current = chatOpen;
  const localPerson = {
      id: myId,
      name: museum.guestName || "You",
      ...visitorAppearance(museum.visitorAvatar),
      ...people.find((person) => person.id === myId),
    },
    visitors = people.length ? people : [localPerson];
  useEffect(() => {
    if (museum.id === "demo") return;
    const s = io({ reconnectionAttempts: 5 });
    socket.current = s;
    s.on("connect", () => {
      setStatus("connecting");
      s.emit(
        "join",
        {
          id: museum.id,
          name: museum.guestName || "Guest",
          avatar: museum.visitorAvatar,
        },
        (result) => {
          if (result.error) {
            setConnectionError(result.error);
            setStatus("error");
            return;
          }
          setMyId(result.id);
          setPeople(result.people);
          setStatus("live");
          setConnectionError("");
        },
      );
    });
    s.on("people", setPeople);
    s.on("interaction-end", ({ id }) => {
      setAction((old) =>
        old && (old.actor === id || old.target === id) ? null : old,
      );
      setGesture((old) =>
        old && (old.actor === id || old.target === id) ? null : old,
      );
    });
    s.on("move", (p) =>
      setPeople((prev) => prev.map((old) => (old.id === p.id ? p : old))),
    );
    s.on("chat", (msg) => {
      setMessages((prev) => [...prev.slice(-99), msg]);
      if (!chatOpenRef.current) setUnread((n) => n + 1);
    });
    s.on("action", performAction);
    s.on("disconnect", () => setStatus("reconnecting"));
    s.on("connect_error", () =>
      setConnectionError(
        "Connection interrupted. We’re trying to get you back together.",
      ),
    );
    return () => {
      s.disconnect();
      socket.current = null;
    };
  }, [museum.id]);
  useEffect(() => {
    const listener = (event) => {
      setScreenMode(
        ["film", "question"].includes(event.detail?.kind)
          ? event.detail.kind
          : "both",
      );
      setScreen(true);
    };
    const exhibitListener = (event) => setExhibit(event.detail);
    window.addEventListener("museum-exhibit", exhibitListener);
    window.addEventListener("museum-screen", listener);
    return () => {
      window.removeEventListener("museum-screen", listener);
      window.removeEventListener("museum-exhibit", exhibitListener);
      timers.current.forEach(clearTimeout);
    };
  }, []);
  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);
  useEffect(() => {
    if (!soundtrack) return;
    const unsubscribe = soundtrack.subscribe((status) => {
      setAudioStatus(status);
      if (status === "error")
        notify(
          "This soundtrack could not be played. Please try an MP3 or WAV file.",
        );
    });
    const unlock = (event) => {
      if (event.target?.closest?.("[data-sound-control]")) return;
      if (soundtrack.state === "blocked") soundtrack.play();
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      unsubscribe();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      soundtrack.dispose();
    };
  }, [soundtrack]);
  useEffect(() => {
    if (photo === null) return;
    const key = (e) => {
      if (e.key === "ArrowRight")
        setPhoto((p) => (p + 1) % museum.photos.length);
      if (e.key === "ArrowLeft")
        setPhoto((p) => (p - 1 + museum.photos.length) % museum.photos.length);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [photo, museum.photos]);
  function performAction(a) {
    if (a.placements?.[socket.current?.id]) setSeat(false);
    if (a.type === "yes") {
      setHearts((n) => n + 1);
      notify(`${a.name || "Someone"} said yes. Here’s to your next chapter. ♡`);
      return;
    }
    if (a.type === "video") {
      setScreenMode("film");
      soundtrack?.setDucked(a.playing);
      setAction({ ...a, started: performance.now() });
      setScreen(true);
      timers.current.push(
        setTimeout(() => {
          if (video.current) {
            video.current.dataset.remoteUntil = performance.now() + 800;
            video.current.currentTime = a.time || 0;
            if (a.playing)
              video.current
                .play()
                .catch(() => notify("Press play to join the screening."));
            else video.current.pause();
          }
        }, 150),
      );
      return;
    }
    setAction({ ...a, started: performance.now() });
    const verbs = {
      hands: "reaches for your hand",
      kiss: "sends a little kiss",
      propose:
        "goes down on one knee. A little question, a forever kind of feeling.",
    };
    setGesture({ ...a, text: `${a.name} ${verbs[a.type]}` });
    if (a.type === "kiss") setHearts((n) => n + 1);
    timers.current.push(
      setTimeout(() => setGesture(null), GESTURE_DURATION[a.type] || 6500),
    );
  }
  function sendAction(type, target) {
    const a = { type, target, actor: myId, name: museum.guestName || "You" };
    if (socket.current?.connected) socket.current.emit("action", a);
    else performAction(a);
  }
  function interact(type) {
    const others = people.filter((p) => p.id !== myId);
    if (!others.length) {
      notify(
        "Invite someone to join your character, then share a little gesture together.",
      );
      setInvite(true);
      return;
    }
    setSeat(false);
    if (others.length > 1) {
      setPartnerPicker(type);
      return;
    }
    sendAction(type, others[0].id);
  }
  async function createInvite() {
    if (museum.id !== "demo") return museum;
    setCreating(true);
    try {
      const data = await requestJson("/api/museums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEMO),
      });
      const m = {
        ...data,
        guestName: museum.guestName || "You",
        visitorAvatar: museum.visitorAvatar,
      };
      setMuseum(m);
      onSave(m);
      history.replaceState({}, "", "?room=" + m.id);
      return m;
    } catch (e) {
      notify(e.message || "Couldn’t create your room. Try again.");
      return null;
    } finally {
      setCreating(false);
    }
  }
  async function copyInvite() {
    const m = await createInvite();
    if (!m) return;
    try {
      await navigator.clipboard.writeText(location.origin + "/?room=" + m.id);
      setCopied(true);
      timers.current.push(setTimeout(() => setCopied(false), 3000));
    } catch {
      notify("Select and copy the invitation link below.");
    }
  }
  function sendChat(e) {
    e.preventDefault();
    if (!chat.trim()) return;
    if (socket.current?.connected) socket.current.emit("chat", chat);
    else if (museum.id === "demo")
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), name: museum.guestName || "You", text: chat },
      ]);
    else {
      notify("You’re offline. Your message hasn’t been sent.");
      return;
    }
    setChat("");
  }
  const blockMove =
    photo !== null || invite || screen || help || !!exhibit || !!partnerPicker;
  useEffect(() => {
    const key = (e) => {
      if (
        e.key.toLowerCase() === "v" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        !blockMove &&
        !["INPUT", "TEXTAREA"].includes(e.target.tagName)
      ) {
        e.preventDefault();
        setCameraMode((mode) => (mode === "third" ? "first" : "third"));
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [blockMove]);
  return (
    <div className="gallery-app">
      <MuseumScene
        photos={museum.photos}
        title={museum.title}
        dedication={museum.dedication}
        question={museum.question}
        people={people}
        myId={myId}
        localPerson={localPerson}
        cameraMode={cameraMode}
        onMove={(p) => !blockMove && socket.current?.emit("move", p)}
        onListen={(position, forward, up) =>
          soundtrack?.updateListener(position, forward, up)
        }
        onPhoto={setPhoto}
        onSeat={() => setSeat((s) => !s)}
        action={action}
        movement={blockMove ? {} : movement}
        paused={blockMove}
        videoUrl={museum.video}
        seat={seat}
      />
      <div className="gallery-shade" />
      <header className="gallery-header">
        <Logo onClick={onHome} />
        <div className="room-title">
          <span>{museum.title}</span>
          <small>
            <span
              className={"live-dot " + (status !== "live" ? "muted-dot" : "")}
            />
            {status === "demo"
              ? "A LITTLE LOOK AROUND"
              : status === "live"
                ? "HERE, TOGETHER"
                : status.toUpperCase()}
          </small>
        </div>
        <div className="room-header-right">
          <div
            className="visitor-avatars"
            title={visitors.map((p) => p.name).join(", ")}
          >
            {visitors.map((p) => (
              <span key={p.id} style={{ background: p.color }}>
                {p.name[0].toUpperCase()}
              </span>
            ))}
          </div>
          <span className="visitor-count">
            {visitors.length}
            <span> / 4</span>
          </span>
          <button className="button primary" onClick={() => setInvite(true)}>
            <Plus size={15} /> Invite your people
          </button>
          <button
            className="icon-button"
            aria-label="Leave museum"
            title="Leave museum"
            onClick={onHome}
          >
            <DoorOpen size={20} />
          </button>
        </div>
      </header>
      <div className="gallery-intro">
        <span className="eyebrow">A MUSEUM OF LOVE & LITTLE MOMENTS</span>
        <h2>
          Every chapter.
          <br />
          <em>Always, together.</em>
        </h2>
        <div className="room-tip">
          <MousePointer2 size={13} /> Click a photo to take a closer look.
        </div>
      </div>
      {connectionError && (
        <div className="connection-error" role="alert">
          {connectionError}
          <button onClick={onHome}>
            Leave museum <ArrowRight size={14} />
          </button>
        </div>
      )}
      <button
        className="screen-shortcut"
        aria-label="The gallery screens"
        onClick={() => {
          setScreenMode("both");
          setScreen(true);
        }}
      >
        <Film size={17} />
        <span>
          The love rotunda<small>Two screens. A place for us.</small>
        </span>
        <ArrowUpRight size={17} />
      </button>
      <button
        className="camera-control"
        onClick={() =>
          setCameraMode((mode) => (mode === "third" ? "first" : "third"))
        }
        aria-label={
          cameraMode === "third"
            ? "Switch to first-person view"
            : "Show my character"
        }
        title="Press V to switch views"
      >
        <Camera size={16} />
        <span>
          {cameraMode === "third" ? "Your character" : "First-person view"}
        </span>
        <kbd>V</kbd>
      </button>
      <div className="gallery-hints">
        <span>
          <kbd>W</kbd>
          <kbd>A</kbd>
          <kbd>S</kbd>
          <kbd>D</kbd> to wander
        </span>
        <span>
          <MousePointer2 size={13} /> Drag to look around
        </span>
        <button onClick={() => setHelp(true)}>A little help?</button>
      </div>
      <div className="mobile-movement" aria-label="Movement controls">
        {[
          ["up", "↑"],
          ["left", "←"],
          ["down", "↓"],
          ["right", "→"],
        ].map(([dir, arrow]) => (
          <button
            key={dir}
            className={"move-" + dir}
            aria-label={"Move " + dir}
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              setMovement((m) => ({ ...m, [dir]: true }));
            }}
            onPointerUp={() => setMovement((m) => ({ ...m, [dir]: false }))}
            onPointerCancel={() => setMovement({})}
          >
            {arrow}
          </button>
        ))}
      </div>
      <div className="gallery-toolbar">
        <button
          className={chatOpen ? "active" : ""}
          onClick={() => {
            setChatOpen(!chatOpen);
            setUnread(0);
          }}
        >
          <span className="toolbar-icon">
            <MessageCircle size={20} />
            {unread > 0 && <i>{unread}</i>}
          </span>
          <span>Say something</span>
        </button>
        <span className="toolbar-divider" />
        <button className={seat ? "active" : ""} onClick={() => setSeat(!seat)}>
          <Armchair size={21} />
          <span>{seat ? "Stand up" : "Take a seat"}</span>
        </button>
        <button disabled={!!gesture} onClick={() => interact("hands")}>
          <Hand size={21} />
          <span>Hold hands</span>
        </button>
        <button disabled={!!gesture} onClick={() => interact("kiss")}>
          <Heart size={21} />
          <span>A little kiss</span>
        </button>
        <button disabled={!!gesture} onClick={() => interact("propose")}>
          <Gem size={21} />
          <span>Ask forever</span>
        </button>
        <span className="toolbar-divider" />
        <button
          className={music ? "active" : ""}
          data-sound-control="true"
          title={
            audioStatus === "blocked"
              ? "Tap to start your museum soundtrack"
              : "Music from the gallery speakers · spatial sound & soft room reverb"
          }
          onClick={() =>
            soundtrack
              ? music
                ? soundtrack.pause()
                : soundtrack.play()
              : notify(
                  "Every story has a soundtrack. Add your own song when you create a museum.",
                )
          }
          aria-label={music ? "Mute music" : "Play music"}
        >
          {music ? <Volume2 size={21} /> : <VolumeX size={21} />}
          <span>
            {audioStatus === "blocked"
              ? "Start music"
              : music
                ? "Sound on"
                : "Sound off"}
          </span>
        </button>
      </div>
      {chatOpen && (
        <aside className="chat-panel">
          <div className="chat-header">
            <span>
              <MessageCircle size={17} /> A quiet conversation
            </span>
            <button
              className="icon-button"
              onClick={() => setChatOpen(false)}
              aria-label="Close chat"
            >
              <X size={17} />
            </button>
          </div>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <Heart size={22} strokeWidth={1} />
                <p>A little hello goes a long way.</p>
                <small>
                  Messages are shared with everyone here.
                  <br />
                  They disappear when you leave.
                </small>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={
                    "chat-message " + (m.name === museum.guestName ? "own" : "")
                  }
                >
                  <strong>{m.name}</strong>
                  <p>{m.text}</p>
                </div>
              ))
            )}
            <div ref={chatEnd} />
          </div>
          <form onSubmit={sendChat}>
            <input
              placeholder="Something on your mind?"
              value={chat}
              maxLength={300}
              onChange={(e) => setChat(e.target.value)}
              aria-label="Chat message"
            />
            <button
              type="submit"
              disabled={!chat.trim()}
              aria-label="Send message"
            >
              <Send size={17} />
            </button>
          </form>
        </aside>
      )}
      {gesture && (
        <div className="gesture-note">
          <span>
            {gesture.type === "propose" ? (
              <Gem size={28} />
            ) : gesture.type === "kiss" ? (
              <Heart size={28} />
            ) : (
              <Hand size={28} />
            )}
          </span>
          <p>{gesture.text}</p>
          {gesture.type === "propose" && gesture.target === myId && (
            <button
              className="button primary"
              onClick={() => {
                sendAction("yes");
                setGesture(null);
              }}
            >
              A thousand times, yes. <Heart size={15} />
            </button>
          )}
          <button
            className="icon-button gesture-close"
            onClick={() => setGesture(null)}
            aria-label="Dismiss gesture"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {hearts > 0 && <HeartRain key={hearts} />}
      {partnerPicker && (
        <Modal
          label="Choose your partner"
          className="partner-modal"
          onClose={() => setPartnerPicker(null)}
        >
          <span className="eyebrow">A LITTLE CLOSER</span>
          <h2>Who’s your person?</h2>
          <p className="muted">
            Choose the character you’d like to share this moment with.
          </p>
          <div className="partner-list">
            {people
              .filter((person) => person.id !== myId)
              .map((person) => (
                <button
                  key={person.id}
                  onClick={() => {
                    sendAction(partnerPicker, person.id);
                    setPartnerPicker(null);
                  }}
                >
                  <span style={{ background: person.color }}>
                    {person.name[0]}
                  </span>
                  <strong>{person.name}</strong>
                  <ArrowRight size={17} />
                </button>
              ))}
          </div>
        </Modal>
      )}
      {invite && (
        <Modal
          label="Invite your people"
          className="invite-modal"
          onClose={() => setInvite(false)}
        >
          <div className="round-modal-icon">
            <Users size={27} strokeWidth={1.2} />
          </div>
          <span className="eyebrow">BETTER, TOGETHER</span>
          <h2>Save them a place.</h2>
          <p className="muted">
            Send a little invitation. Up to four of you can
            <br />
            wander these halls, from wherever you are.
          </p>
          <div className="invitation-preview">
            <img src={museum.photos[0]} alt="Your invitation" />
            <div>
              <small>YOU’RE INVITED TO</small>
              <h3>{museum.title}</h3>
              <span>A private little world, just for us.</span>
            </div>
          </div>
          {museum.id !== "demo" && (
            <div className="copy-field">
              <Link size={15} />
              <input
                readOnly
                value={location.origin + "/?room=" + museum.id}
                aria-label="Museum invitation link"
                onFocus={(e) => e.target.select()}
              />
            </div>
          )}
          <button
            className="button primary full"
            disabled={creating}
            onClick={copyInvite}
          >
            {creating ? (
              <>
                <LoaderCircle size={17} className="spin" /> Opening your shared
                room…
              </>
            ) : copied ? (
              <>
                <CheckCheck size={17} /> Invitation copied
              </>
            ) : (
              <>
                <Copy size={16} />{" "}
                {museum.id === "demo"
                  ? "Create a shared demo & copy link"
                  : "Copy your invitation"}
              </>
            )}
          </button>
          <small className="privacy-note">
            <LockKeyhole size={13} /> Anyone with this link can enter. Share it
            with care.
          </small>
        </Modal>
      )}
      {photo !== null && (
        <Modal
          label={`Memory ${photo + 1}`}
          className="photo-modal"
          onClose={() => setPhoto(null)}
        >
          <div className="photo-viewer">
            <img src={museum.photos[photo]} alt={`Your memory ${photo + 1}`} />
          </div>
          <div className="photo-viewer-footer">
            <div>
              <span className="eyebrow">
                {photo === 0 ? "THE CENTREPIECE" : "A MOMENT TO KEEP"}
              </span>
              <h3>
                {photo === 0
                  ? "Where it all begins."
                  : "Some things stay with you."}
              </h3>
            </div>
            <div>
              <button
                className="icon-button"
                aria-label="Previous photo"
                onClick={() =>
                  setPhoto(
                    (photo - 1 + museum.photos.length) % museum.photos.length,
                  )
                }
              >
                <ChevronLeft size={21} />
              </button>
              <span>
                {String(photo + 1).padStart(2, "0")} /{" "}
                {String(museum.photos.length).padStart(2, "0")}
              </span>
              <button
                className="icon-button"
                aria-label="Next photo"
                onClick={() => setPhoto((photo + 1) % museum.photos.length)}
              >
                <ChevronRight size={21} />
              </button>
            </div>
          </div>
        </Modal>
      )}
      {screen && (
        <Modal
          label="The gallery screens"
          className="screen-modal"
          onClose={() => {
            setScreen(false);
            soundtrack?.setDucked(false);
          }}
        >
          <span className="eyebrow">AT THE HEART OF YOUR MUSEUM</span>
          <h2>A place for us.</h2>
          <div className="screen-tabs" aria-label="Choose a gallery screen">
            {[
              ["both", "Both screens"],
              ["film", "01 · Our film"],
              ["question", "02 · Our question"],
            ].map(([mode, label]) => (
              <button
                key={mode}
                aria-pressed={screenMode === mode}
                className={screenMode === mode ? "active" : ""}
                onClick={() => {
                  setScreenMode(mode);
                  if (mode === "question") soundtrack?.setDucked(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          {screenMode !== "question" && (
            <div className="screen-film">
              {museum.video ? (
                <video
                  ref={video}
                  src={museum.video}
                  controls
                  playsInline
                  onPlay={() => {
                    soundtrack?.setDucked(true);
                    if (
                      performance.now() >
                        Number(video.current?.dataset.remoteUntil || 0) &&
                      Math.abs(
                        performance.now() -
                          (video.current?.dataset.lastEvent || 0),
                      ) > 500
                    ) {
                      video.current.dataset.lastEvent = performance.now();
                      socket.current?.emit("action", {
                        type: "video",
                        playing: true,
                        time: video.current.currentTime,
                      });
                    }
                  }}
                  onEnded={() => soundtrack?.setDucked(false)}
                  onPause={() => {
                    soundtrack?.setDucked(false);
                    if (
                      performance.now() >
                      Number(video.current?.dataset.remoteUntil || 0)
                    )
                      socket.current?.emit("action", {
                        type: "video",
                        playing: false,
                        time: video.current?.currentTime || 0,
                      });
                  }}
                />
              ) : (
                <div className="empty-screen">
                  <Film size={36} strokeWidth={1} />
                  <span>Every love story is a film.</span>
                  <p>
                    Add a short video when you create your museum.
                    <br />
                    Then take a seat and watch it together.
                  </p>
                </div>
              )}
            </div>
          )}
          {screenMode !== "film" &&
            (museum.question ? (
              <div className="screen-question">
                <span className="eyebrow">ONE LITTLE QUESTION</span>
                <h3>{museum.question}</h3>
                <button
                  className="button primary"
                  onClick={() => sendAction("yes")}
                >
                  Yes. Always yes. <Heart size={16} />
                </button>
              </div>
            ) : (
              <p className="screen-no-question">
                Your next chapter is yours to write. Add a question when you
                create your museum. ♡
              </p>
            ))}
          <p className="rotunda-note">
            <Heart size={12} /> This is just the middle of your story. Walk
            around the screens to find more memories.
          </p>
        </Modal>
      )}
      {exhibit && (
        <Modal
          label={exhibit.title}
          className="exhibit-modal"
          onClose={() => setExhibit(null)}
        >
          <div className="round-modal-icon">
            {exhibit.kind === "ring" ? (
              <Gem size={30} strokeWidth={1} />
            ) : (
              <Heart size={30} strokeWidth={1} />
            )}
          </div>
          <span className="eyebrow">THE PERMANENT COLLECTION · SCULPTURE</span>
          <h2>{exhibit.title}</h2>
          <p className="exhibit-description">{exhibit.description}</p>
          <p className="exhibit-material">
            {exhibit.kind === "embrace"
              ? "Ivory stone · An original sculptural study"
              : exhibit.kind === "hearts"
                ? "Warm bronze & brass · Two lives, intertwined"
                : "Velvet, brass & a little forever"}
          </p>
          <button
            className="button primary full"
            onClick={() => setExhibit(null)}
          >
            Keep wandering <ArrowRight size={17} />
          </button>
        </Modal>
      )}
      {help && (
        <Modal
          onClose={() => setHelp(false)}
          label="How to explore"
          className="help-modal"
        >
          <span className="eyebrow">MAKE YOURSELF AT HOME</span>
          <h2>A little room to wander.</h2>
          <div className="help-list">
            <p>
              <Footprints size={22} />
              <span>
                <strong>Find your own pace.</strong>Use WASD or the arrow keys
                to walk. On your phone, use the direction buttons. You can also
                click the floor.
              </span>
            </p>
            <p>
              <MousePointer2 size={22} />
              <span>
                <strong>A new perspective.</strong>Click and drag to look
                around. Tap any framed photo to see the whole memory.
              </span>
            </p>
            <p>
              <Armchair size={22} />
              <span>
                <strong>Stay a little longer.</strong>Tap a bench or “Take a
                seat.” The circular love rotunda has a film screen and a
                separate question screen facing the curved seating. Keep walking
                around them to the photo gallery beyond.
              </span>
            </p>
            <p>
              <Heart size={22} />
              <span>
                <strong>Better with someone.</strong>Invite your people, chat,
                hold hands, or make a little grand gesture. Up to four guests
                can join.
              </span>
            </p>
          </div>
          <button
            className="button primary full"
            onClick={() => setHelp(false)}
          >
            I’ll take my time <ArrowRight size={17} />
          </button>
        </Modal>
      )}
    </div>
  );
}
function HeartRain() {
  const [visible, setVisible] = useState(true);
  const [pieces] = useState(() =>
    Array.from({ length: 48 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 2.7,
      duration: 3.6 + Math.random() * 3,
      size: 13 + Math.random() * 27,
      rotate: Math.random() * 60 - 30,
      color: ["#b86e64", "#d6a99b", "#e5b7a3", "#a27968"][i % 4],
    })),
  );
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 10000);
    return () => clearTimeout(t);
  }, []);
  return (
    visible && (
      <div
        className="heart-rain"
        aria-label="Hearts falling for everyone in the room"
      >
        {pieces.map((p, i) => (
          <Heart
            key={i}
            fill={p.color}
            strokeWidth={0}
            style={{
              left: p.left + "%",
              width: p.size,
              height: p.size,
              color: p.color,
              animationDelay: p.delay + "s",
              animationDuration: p.duration + "s",
              "--rotation": p.rotate + "deg",
            }}
          />
        ))}
      </div>
    )
  );
}

createRoot(document.getElementById("root")).render(<App />);
