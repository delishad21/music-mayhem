import { useState, useEffect, useRef } from "react";
import {
  Music,
  Mic2,
  Zap,
  Users,
  LogIn,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Timer,
  Trophy,
  ChevronRight,
  Hash,
  Eye,
  EyeOff,
  Play,
  SkipForward,
  Volume2,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Page =
  | "home"
  | "finish-lyrics"
  | "guess-song"
  | "guess-challenge"
  | "join-room"
  | "sign-in";

// ─── Sample game data ────────────────────────────────────────────────────────

const lyricsQuestions = [
  {
    song: "Bohemian Rhapsody",
    artist: "Queen",
    snippet: "Is this the real life? Is this just fantasy? Caught in a landslide,",
    answer: "no escape from reality",
    hint: "Ends with a phrase about reality",
  },
  {
    song: "Smells Like Teen Spirit",
    artist: "Nirvana",
    snippet: "Load up on guns, bring your friends, it's fun to lose and to pretend,",
    answer: "she's overboard and self assured",
    hint: "Describes a person's demeanor",
  },
  {
    song: "Blinding Lights",
    artist: "The Weeknd",
    snippet: "I've been tryna call, I've been on my own for long enough,",
    answer: "maybe you can show me how to love, maybe",
    hint: "A request about love",
  },
  {
    song: "Shape of You",
    artist: "Ed Sheeran",
    snippet: "The club isn't the best place to find a lover so the bar is",
    answer: "where I go",
    hint: "A place",
  },
];

const songOptions = [
  {
    clip: "🎵 Upbeat synth riff, 120 BPM, key of G",
    answer: "Levitating",
    artist: "Dua Lipa",
    options: ["Levitating", "Physical", "Don't Start Now", "Break My Heart"],
    genre: "Pop",
  },
  {
    clip: "🎵 Distorted guitar intro, slow build, minor key",
    answer: "Nothing Else Matters",
    artist: "Metallica",
    options: ["Nothing Else Matters", "Enter Sandman", "The Unforgiven", "Fade to Black"],
    genre: "Metal",
  },
  {
    clip: "🎵 Piano ballad, 4/4, gentle strings fade in",
    answer: "Someone Like You",
    artist: "Adele",
    options: ["Someone Like You", "Hello", "Rolling in the Deep", "Skyfall"],
    genre: "Soul",
  },
];

const challengeSongs = [
  { song: "Waterloo", artist: "ABBA", genre: "Pop", year: 1974, bpm: 132, points: 100 },
  { song: "Superstition", artist: "Stevie Wonder", genre: "R&B", year: 1972, bpm: 100, points: 150 },
  { song: "Hotel California", artist: "Eagles", genre: "Rock", year: 1977, bpm: 75, points: 200 },
  { song: "Crazy in Love", artist: "Beyoncé", genre: "R&B", year: 2003, bpm: 99, points: 125 },
];

// ─── Shared components ───────────────────────────────────────────────────────

function NavBar({ onBack, page }: { onBack: () => void; page: Page }) {
  const labels: Record<Page, string> = {
    home: "BeatIQ",
    "finish-lyrics": "Finish the Lyrics",
    "guess-song": "Guess the Song",
    "guess-challenge": "Song Challenge",
    "join-room": "Join a Room",
    "sign-in": "Sign In",
  };

  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
      <div className="flex items-center gap-3">
        {page !== "home" && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            <ArrowLeft size={16} />
            Back
          </button>
        )}
        {page === "home" && (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-primary flex items-center justify-center">
              <Music size={14} className="text-white" />
            </div>
            <span
              className="text-foreground font-bold text-lg tracking-tight"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              BEATIQ
            </span>
          </div>
        )}
        {page !== "home" && (
          <span
            className="text-foreground font-semibold text-base tracking-wide"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.06em" }}
          >
            {labels[page].toUpperCase()}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2" style={{ fontFamily: "'DM Mono', monospace" }}>
        <span className="text-xs text-muted-foreground">v2.4</span>
      </div>
    </nav>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${(value / max) * 100}%`, backgroundColor: color }}
      />
    </div>
  );
}

// ─── Home Page ────────────────────────────────────────────────────────────────

function HomePage({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const modes = [
    {
      page: "finish-lyrics" as Page,
      icon: Mic2,
      label: "Finish the Lyrics",
      tagline: "Complete the missing line",
      description: "A snippet plays — you type what comes next. Points for speed and accuracy.",
      accent: "var(--lyrics-color)",
      bg: "var(--lyrics-bg)",
      border: "var(--lyrics-border)",
      tag: "TYPING",
    },
    {
      page: "guess-song" as Page,
      icon: Music,
      label: "Guess the Song",
      tagline: "Name that tune",
      description: "Hear a short clip and pick the right song from four options before time runs out.",
      accent: "var(--guess-color)",
      bg: "var(--guess-bg)",
      border: "var(--guess-border)",
      tag: "MULTIPLE CHOICE",
    },
    {
      page: "guess-challenge" as Page,
      icon: Zap,
      label: "Guess the Song",
      tagline: "Challenge mode",
      description: "Speed rounds, multipliers, and a live leaderboard. Only the fastest survive.",
      accent: "var(--challenge-color)",
      bg: "var(--challenge-bg)",
      border: "var(--challenge-border)",
      tag: "CHALLENGE",
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <NavBar onBack={() => {}} page="home" />

      {/* Hero */}
      <div className="px-6 pt-14 pb-10 max-w-5xl mx-auto w-full">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="text-xs font-medium tracking-widest text-muted-foreground uppercase"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            Music Trivia Platform
          </span>
        </div>
        <h1
          className="text-5xl md:text-7xl font-extrabold text-foreground leading-none tracking-tight mb-4"
          style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          PLAY.
          <br />
          <span style={{ color: "var(--lyrics-color)" }}>LISTEN.</span>
          <br />
          <span style={{ color: "var(--guess-color)" }}>COMPETE.</span>
        </h1>
        <p
          className="text-muted-foreground text-base max-w-md leading-relaxed"
          style={{ fontFamily: "'DM Sans', sans-serif" }}
        >
          Three ways to prove your music knowledge. Solo or with friends — pick your mode and start playing.
        </p>
      </div>

      {/* Game mode cards */}
      <div className="px-6 pb-10 max-w-5xl mx-auto w-full">
        <div className="grid md:grid-cols-3 gap-4">
          {modes.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.page}
                onClick={() => onNavigate(m.page)}
                className="group text-left rounded-xl border p-6 transition-all duration-200 hover:scale-[1.02] active:scale-[0.99]"
                style={{
                  background: m.bg,
                  borderColor: m.border,
                }}
              >
                <div className="flex items-start justify-between mb-5">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: m.accent + "22", border: `1px solid ${m.accent}44` }}
                  >
                    <Icon size={18} style={{ color: m.accent }} />
                  </div>
                  <span
                    className="text-xs font-medium tracking-widest px-2 py-0.5 rounded"
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      color: m.accent,
                      background: m.accent + "18",
                    }}
                  >
                    {m.tag}
                  </span>
                </div>
                <div className="mb-1">
                  <h2
                    className="text-xl font-bold text-foreground leading-tight"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {m.label.toUpperCase()}
                  </h2>
                  <p
                    className="text-sm mt-0.5"
                    style={{ fontFamily: "'DM Sans', sans-serif", color: m.accent, fontStyle: "italic" }}
                  >
                    {m.tagline}
                  </p>
                </div>
                <p
                  className="text-sm text-muted-foreground leading-relaxed mt-3"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  {m.description}
                </p>
                <div
                  className="mt-5 flex items-center gap-1.5 text-sm font-medium transition-colors"
                  style={{ color: m.accent, fontFamily: "'DM Sans', sans-serif" }}
                >
                  Play now
                  <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="px-6 pb-14 max-w-5xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => onNavigate("join-room")}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-border text-foreground text-sm font-medium transition-all hover:border-foreground/30 hover:bg-secondary"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            <Users size={15} />
            Join a Room
          </button>
          <button
            onClick={() => onNavigate("sign-in")}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-border text-foreground text-sm font-medium transition-all hover:border-foreground/30 hover:bg-secondary"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            <LogIn size={15} />
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Finish the Lyrics ────────────────────────────────────────────────────────

function FinishLyricsPage() {
  const [qIdx, setQIdx] = useState(0);
  const [input, setInput] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const q = lyricsQuestions[qIdx];
  const accent = "var(--lyrics-color)";
  const total = lyricsQuestions.length;
  const isCorrect =
    submitted &&
    input.trim().toLowerCase().includes(q.answer.toLowerCase().split(" ")[0]);

  useEffect(() => {
    setTimeLeft(20);
    setShowHint(false);
    setInput("");
    setSubmitted(false);
  }, [qIdx]);

  useEffect(() => {
    if (submitted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setSubmitted(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [qIdx, submitted]);

  const handleSubmit = () => {
    clearInterval(timerRef.current!);
    setSubmitted(true);
    if (input.trim().toLowerCase().includes(q.answer.toLowerCase().split(" ")[0])) {
      setScore((s) => s + Math.max(10, timeLeft * 5));
    }
  };

  const next = () => {
    if (qIdx < total - 1) setQIdx((i) => i + 1);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Game header bar */}
      <div
        className="px-6 py-3 border-b flex items-center justify-between"
        style={{ borderColor: "var(--lyrics-border)" }}
      >
        <div className="flex items-center gap-4">
          <span
            className="text-xs tracking-widest text-muted-foreground uppercase"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            Q {qIdx + 1}/{total}
          </span>
          <ProgressBar value={qIdx + 1} max={total} color="var(--lyrics-color)" />
        </div>
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ fontFamily: "'DM Mono', monospace", color: timeLeft <= 5 ? "#ef4444" : "var(--lyrics-color)" }}
          >
            <Timer size={14} />
            {String(timeLeft).padStart(2, "0")}s
          </div>
          <div className="flex items-center gap-1.5 text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>
            <Trophy size={14} style={{ color: "var(--lyrics-color)" }} />
            <span className="text-foreground font-medium">{score}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-2xl mx-auto w-full">
        {/* Genre tag */}
        <div className="w-full mb-6">
          <span
            className="text-xs font-medium tracking-widest px-2.5 py-1 rounded"
            style={{
              fontFamily: "'DM Mono', monospace",
              color: "var(--lyrics-color)",
              background: "var(--lyrics-bg)",
            }}
          >
            FINISH THE LYRICS
          </span>
        </div>

        {/* Lyrics card */}
        <div
          className="w-full rounded-xl border p-7 mb-6"
          style={{ background: "var(--lyrics-bg)", borderColor: "var(--lyrics-border)" }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Volume2 size={14} style={{ color: "var(--lyrics-color)" }} />
            <span
              className="text-xs text-muted-foreground"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              {q.artist} — {q.song}
            </span>
          </div>
          <blockquote
            className="text-2xl md:text-3xl text-foreground leading-snug font-semibold"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            "{q.snippet}{" "}
            <span
              className="inline-block px-3 py-0.5 rounded align-middle"
              style={{
                background: submitted ? (isCorrect ? "#22c55e22" : "#ef444422") : "rgba(255,255,255,0.07)",
                borderBottom: `2px solid ${submitted ? (isCorrect ? "#22c55e" : "#ef4444") : "var(--lyrics-color)"}`,
                color: submitted ? (isCorrect ? "#22c55e" : "#ef4444") : "var(--lyrics-color)",
                minWidth: "6rem",
                display: "inline-block",
              }}
            >
              {submitted ? (isCorrect ? input || "—" : q.answer) : "___"}
            </span>
            "
          </blockquote>
        </div>

        {/* Input */}
        {!submitted && (
          <>
            <input
              className="w-full rounded-lg border px-4 py-3 text-base text-foreground outline-none transition-all mb-3"
              style={{
                background: "var(--input-background)",
                borderColor: "var(--lyrics-border)",
                fontFamily: "'DM Sans', sans-serif",
              }}
              placeholder="Type the next line…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && input.trim() && handleSubmit()}
              autoFocus
            />
            <div className="flex items-center justify-between w-full gap-3">
              <button
                onClick={() => setShowHint((h) => !h)}
                className="text-xs text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {showHint ? "Hide hint" : "Show hint"}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!input.trim()}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 transition-all hover:opacity-90"
                style={{
                  background: "var(--lyrics-color)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Submit
              </button>
            </div>
            {showHint && (
              <div
                className="w-full mt-3 text-sm rounded-lg px-4 py-3"
                style={{
                  background: "var(--lyrics-bg)",
                  color: "var(--lyrics-color)",
                  fontFamily: "'DM Sans', sans-serif",
                  fontStyle: "italic",
                }}
              >
                Hint: {q.hint}
              </div>
            )}
          </>
        )}

        {/* Result */}
        {submitted && (
          <div className="w-full">
            <div
              className={`flex items-center gap-2 text-sm font-medium mb-5 ${isCorrect ? "text-green-400" : "text-red-400"}`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {isCorrect ? <CheckCircle size={16} /> : <XCircle size={16} />}
              {isCorrect
                ? `Correct! +${Math.max(10, timeLeft * 5)} pts`
                : `The answer was: "${q.answer}"`}
            </div>
            {qIdx < total - 1 ? (
              <button
                onClick={next}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "var(--lyrics-color)", fontFamily: "'DM Sans', sans-serif" }}
              >
                Next question
                <ChevronRight size={14} />
              </button>
            ) : (
              <div
                className="rounded-xl border p-6 text-center"
                style={{ borderColor: "var(--lyrics-border)", background: "var(--lyrics-bg)" }}
              >
                <Trophy size={28} style={{ color: "var(--lyrics-color)", margin: "0 auto 8px" }} />
                <div
                  className="text-3xl font-extrabold text-foreground"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  FINAL SCORE: {score}
                </div>
                <p className="text-muted-foreground text-sm mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {score >= 200 ? "Incredible — you know your lyrics!" : score >= 100 ? "Solid effort!" : "Keep practising!"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Guess the Song ───────────────────────────────────────────────────────────

function GuessSongPage() {
  const [qIdx, setQIdx] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const q = songOptions[qIdx];
  const total = songOptions.length;
  const submitted = chosen !== null;

  useEffect(() => {
    setTimeLeft(15);
    setChosen(null);
  }, [qIdx]);

  useEffect(() => {
    if (submitted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setChosen("__timeout__");
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [qIdx, submitted]);

  const pick = (opt: string) => {
    clearInterval(timerRef.current!);
    setChosen(opt);
    if (opt === q.answer) setScore((s) => s + Math.max(10, timeLeft * 7));
  };

  const next = () => {
    if (qIdx < total - 1) setQIdx((i) => i + 1);
  };

  const optionStyle = (opt: string) => {
    if (!submitted) {
      return {
        background: "var(--card)",
        borderColor: "var(--guess-border)",
        color: "var(--foreground)",
      };
    }
    if (opt === q.answer) return { background: "#22c55e18", borderColor: "#22c55e", color: "#22c55e" };
    if (opt === chosen) return { background: "#ef444418", borderColor: "#ef4444", color: "#ef4444" };
    return { background: "var(--card)", borderColor: "var(--border)", color: "var(--muted-foreground)", opacity: 0.5 };
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div
        className="px-6 py-3 border-b flex items-center justify-between"
        style={{ borderColor: "var(--guess-border)" }}
      >
        <div className="flex items-center gap-4">
          <span
            className="text-xs tracking-widest text-muted-foreground uppercase"
            style={{ fontFamily: "'DM Mono', monospace" }}
          >
            Q {qIdx + 1}/{total}
          </span>
          <ProgressBar value={qIdx + 1} max={total} color="var(--guess-color)" />
        </div>
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-1.5 text-sm font-medium"
            style={{ fontFamily: "'DM Mono', monospace", color: timeLeft <= 5 ? "#ef4444" : "var(--guess-color)" }}
          >
            <Timer size={14} />
            {String(timeLeft).padStart(2, "0")}s
          </div>
          <div className="flex items-center gap-1.5 text-sm" style={{ fontFamily: "'DM Mono', monospace" }}>
            <Trophy size={14} style={{ color: "var(--guess-color)" }} />
            <span className="text-foreground font-medium">{score}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-xl mx-auto w-full">
        <div className="w-full mb-6">
          <span
            className="text-xs font-medium tracking-widest px-2.5 py-1 rounded"
            style={{
              fontFamily: "'DM Mono', monospace",
              color: "var(--guess-color)",
              background: "var(--guess-bg)",
            }}
          >
            GUESS THE SONG
          </span>
        </div>

        {/* Clip card */}
        <div
          className="w-full rounded-xl border p-6 mb-7"
          style={{ background: "var(--guess-bg)", borderColor: "var(--guess-border)" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "var(--guess-color)" }}
            >
              <Play size={14} className="text-background" />
            </div>
            <span
              className="text-xs text-muted-foreground"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              {q.genre} · Audio clip playing…
            </span>
          </div>
          {/* Fake waveform */}
          <div className="flex items-end gap-0.5 h-10">
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm transition-all"
                style={{
                  height: `${20 + Math.sin(i * 1.3) * 14 + Math.cos(i * 0.7) * 10}%`,
                  background:
                    i < (submitted ? 40 : Math.round((1 - timeLeft / 15) * 40))
                      ? "var(--guess-color)"
                      : "rgba(255,255,255,0.12)",
                }}
              />
            ))}
          </div>
          <p
            className="text-xs text-muted-foreground mt-3 italic"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            {q.clip}
          </p>
        </div>

        {/* Options */}
        <div className="w-full grid grid-cols-2 gap-3 mb-4">
          {q.options.map((opt) => (
            <button
              key={opt}
              onClick={() => !submitted && pick(opt)}
              disabled={submitted}
              className="rounded-lg border px-4 py-4 text-left transition-all duration-200 hover:scale-[1.02] disabled:cursor-default"
              style={{ ...optionStyle(opt), fontFamily: "'DM Sans', sans-serif" }}
            >
              <span className="text-sm font-semibold block">{opt}</span>
            </button>
          ))}
        </div>

        {submitted && (
          <div className="w-full">
            <div
              className={`flex items-center gap-2 text-sm font-medium mb-4 ${chosen === q.answer ? "text-green-400" : "text-red-400"}`}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
            >
              {chosen === q.answer ? <CheckCircle size={16} /> : <XCircle size={16} />}
              {chosen === q.answer
                ? `Correct! +${Math.max(10, timeLeft * 7)} pts · ${q.artist}`
                : chosen === "__timeout__"
                ? `Time's up! The answer was ${q.answer} by ${q.artist}`
                : `Incorrect. The answer was ${q.answer} by ${q.artist}`}
            </div>
            {qIdx < total - 1 ? (
              <button
                onClick={next}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-background transition-all hover:opacity-90"
                style={{ background: "var(--guess-color)", fontFamily: "'DM Sans', sans-serif" }}
              >
                Next question <ChevronRight size={14} />
              </button>
            ) : (
              <div
                className="rounded-xl border p-6 text-center"
                style={{ borderColor: "var(--guess-border)", background: "var(--guess-bg)" }}
              >
                <Trophy size={28} style={{ color: "var(--guess-color)", margin: "0 auto 8px" }} />
                <div
                  className="text-3xl font-extrabold text-foreground"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  FINAL SCORE: {score}
                </div>
                <p className="text-muted-foreground text-sm mt-1" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                  {score >= 150 ? "Sharp ears!" : score >= 70 ? "Not bad!" : "Try again?"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Challenge Mode ───────────────────────────────────────────────────────────

const leaderboard = [
  { name: "nova_k", score: 4820, streak: 12, avatar: "N" },
  { name: "dj_phantom", score: 4310, streak: 8, avatar: "D" },
  { name: "You", score: 0, streak: 0, avatar: "Y", isYou: true },
  { name: "riffmaster99", score: 3100, streak: 5, avatar: "R" },
  { name: "beatslayer", score: 2760, streak: 3, avatar: "B" },
];

function ChallengePage() {
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(8);
  const [chosen, setChosen] = useState<string | null>(null);
  const [board, setBoard] = useState(leaderboard);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const q = challengeSongs[qIdx % challengeSongs.length];
  const opts = [q.song, "Watermelon Sugar", "Good 4 U", "Peaches"];
  const submitted = chosen !== null;

  useEffect(() => {
    setTimeLeft(8);
    setChosen(null);
  }, [qIdx]);

  useEffect(() => {
    if (submitted) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          setChosen("__timeout__");
          setStreak(0);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current!);
  }, [qIdx, submitted]);

  const pick = (opt: string) => {
    clearInterval(timerRef.current!);
    setChosen(opt);
    if (opt === q.song) {
      const multiplier = streak >= 3 ? 2 : 1;
      const gained = q.points * multiplier + timeLeft * 10;
      setScore((s) => {
        const ns = s + gained;
        setBoard((prev) =>
          prev
            .map((p) => (p.isYou ? { ...p, score: ns, streak: streak + 1 } : p))
            .sort((a, b) => b.score - a.score)
        );
        return ns;
      });
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
  };

  const next = () => setQIdx((i) => i + 1);

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Challenge header */}
      <div
        className="px-6 py-3 border-b flex items-center justify-between"
        style={{ borderColor: "var(--challenge-border)" }}
      >
        <div className="flex items-center gap-3">
          <Zap size={15} style={{ color: "var(--challenge-color)" }} />
          <span
            className="text-xs tracking-widest uppercase"
            style={{ fontFamily: "'DM Mono', monospace", color: "var(--challenge-color)" }}
          >
            Challenge Mode
          </span>
          {streak >= 2 && (
            <span
              className="text-xs font-bold px-2 py-0.5 rounded"
              style={{
                fontFamily: "'DM Mono', monospace",
                background: "var(--challenge-bg)",
                color: "var(--challenge-color)",
              }}
            >
              🔥 {streak}x STREAK
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-1.5 text-sm font-bold"
            style={{
              fontFamily: "'DM Mono', monospace",
              color: timeLeft <= 3 ? "#ef4444" : "var(--challenge-color)",
            }}
          >
            <Timer size={14} />
            {String(timeLeft).padStart(2, "0")}
          </div>
          <div className="text-sm font-bold" style={{ fontFamily: "'DM Mono', monospace", color: "var(--challenge-color)" }}>
            {score} PTS
          </div>
        </div>
      </div>

      <div className="flex-1 grid md:grid-cols-[1fr_280px] gap-0">
        {/* Game area */}
        <div className="flex flex-col items-center justify-center px-6 py-12">
          {/* Song info card */}
          <div
            className="w-full max-w-md rounded-xl border p-6 mb-6"
            style={{ background: "var(--challenge-bg)", borderColor: "var(--challenge-border)" }}
          >
            <div className="flex items-center justify-between mb-4">
              <span
                className="text-xs tracking-widest text-muted-foreground uppercase"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                Clues
              </span>
              <SkipForward size={14} className="text-muted-foreground" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Genre", val: q.genre },
                { label: "Year", val: q.year },
                { label: "BPM", val: q.bpm },
                { label: "Points", val: `×${streak >= 3 ? 2 : 1} = ${q.points * (streak >= 3 ? 2 : 1)}` },
              ].map(({ label, val }) => (
                <div key={label} className="rounded-lg p-3" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <div
                    className="text-xs text-muted-foreground mb-0.5"
                    style={{ fontFamily: "'DM Mono', monospace" }}
                  >
                    {label}
                  </div>
                  <div
                    className="text-base font-bold text-foreground"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {val}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="w-full max-w-md grid grid-cols-2 gap-3 mb-4">
            {opts.map((opt) => {
              const isAnswer = opt === q.song;
              const isPicked = opt === chosen;
              let style: React.CSSProperties = {
                background: "var(--card)",
                borderColor: "var(--challenge-border)",
                color: "var(--foreground)",
                fontFamily: "'DM Sans', sans-serif",
              };
              if (submitted) {
                if (isAnswer) style = { background: "#22c55e18", borderColor: "#22c55e", color: "#22c55e", fontFamily: "'DM Sans', sans-serif" };
                else if (isPicked) style = { background: "#ef444418", borderColor: "#ef4444", color: "#ef4444", fontFamily: "'DM Sans', sans-serif" };
                else style = { ...style, opacity: 0.4 };
              }
              return (
                <button
                  key={opt}
                  onClick={() => !submitted && pick(opt)}
                  disabled={submitted}
                  className="rounded-lg border px-4 py-4 text-left transition-all duration-150 hover:scale-[1.02] disabled:cursor-default text-sm font-semibold"
                  style={style}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {submitted && (
            <div className="w-full max-w-md">
              <div
                className={`flex items-center gap-2 text-sm font-medium mb-4 ${chosen === q.song ? "text-green-400" : "text-red-400"}`}
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                {chosen === q.song ? <CheckCircle size={16} /> : <XCircle size={16} />}
                {chosen === q.song
                  ? `Correct! +${q.points * (streak >= 3 ? 2 : 1) + (timeLeft + 1) * 10} pts${streak >= 2 ? ` · ${streak}x streak!` : ""}`
                  : chosen === "__timeout__"
                  ? `Too slow! It was ${q.song} by ${q.artist}`
                  : `Wrong! It was ${q.song} by ${q.artist}`}
              </div>
              <button
                onClick={next}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-black transition-all hover:opacity-90"
                style={{ background: "var(--challenge-color)", fontFamily: "'DM Sans', sans-serif" }}
              >
                Next round <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Leaderboard sidebar */}
        <div
          className="hidden md:flex flex-col border-l px-5 py-8"
          style={{ borderColor: "var(--challenge-border)", background: "var(--card)" }}
        >
          <div className="flex items-center gap-2 mb-5">
            <Trophy size={14} style={{ color: "var(--challenge-color)" }} />
            <span
              className="text-xs tracking-widest uppercase text-muted-foreground"
              style={{ fontFamily: "'DM Mono', monospace" }}
            >
              Leaderboard
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {board.map((player, i) => (
              <div
                key={player.name}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all"
                style={{
                  background: player.isYou ? "var(--challenge-bg)" : "transparent",
                  border: player.isYou ? "1px solid var(--challenge-border)" : "1px solid transparent",
                }}
              >
                <span
                  className="text-xs w-4 text-center"
                  style={{ fontFamily: "'DM Mono', monospace", color: i === 0 ? "#f59e0b" : "var(--muted-foreground)" }}
                >
                  {i + 1}
                </span>
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    background: player.isYou ? "var(--challenge-color)" : "var(--secondary)",
                    color: player.isYou ? "#000" : "var(--foreground)",
                    fontFamily: "'Barlow Condensed', sans-serif",
                  }}
                >
                  {player.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-xs font-medium truncate"
                    style={{ fontFamily: "'DM Sans', sans-serif", color: player.isYou ? "var(--challenge-color)" : "var(--foreground)" }}
                  >
                    {player.name}
                  </div>
                  {player.streak > 0 && (
                    <div className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>
                      🔥 {player.streak}
                    </div>
                  )}
                </div>
                <span
                  className="text-xs font-bold"
                  style={{ fontFamily: "'DM Mono', monospace", color: "var(--foreground)" }}
                >
                  {player.score.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Join Room ────────────────────────────────────────────────────────────────

function JoinRoomPage() {
  const [code, setCode] = useState("");
  const [joined, setJoined] = useState(false);

  const recentRooms = [
    { code: "BEAT-4821", host: "nova_k", mode: "Guess the Song", players: 4, max: 8 },
    { code: "LYRC-3309", host: "dj_phantom", mode: "Finish the Lyrics", players: 2, max: 6 },
    { code: "CHAL-9900", host: "riffmaster99", mode: "Challenge Mode", players: 7, max: 8 },
  ];

  const modeColor = (mode: string) => {
    if (mode.includes("Lyrics")) return "var(--lyrics-color)";
    if (mode.includes("Challenge")) return "var(--challenge-color)";
    return "var(--guess-color)";
  };

  const modeBg = (mode: string) => {
    if (mode.includes("Lyrics")) return "var(--lyrics-bg)";
    if (mode.includes("Challenge")) return "var(--challenge-bg)";
    return "var(--guess-bg)";
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 max-w-lg mx-auto w-full">
        <div className="w-full mb-8">
          <span
            className="text-xs font-medium tracking-widest px-2.5 py-1 rounded"
            style={{ fontFamily: "'DM Mono', monospace", color: "var(--guess-color)", background: "var(--guess-bg)" }}
          >
            MULTIPLAYER
          </span>
          <h1
            className="text-4xl font-extrabold text-foreground mt-4 mb-1"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            JOIN A ROOM
          </h1>
          <p className="text-muted-foreground text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            Enter a room code or browse open lobbies below.
          </p>
        </div>

        {/* Code input */}
        {!joined ? (
          <>
            <div className="w-full mb-6">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Hash
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    className="w-full rounded-lg border pl-9 pr-4 py-3 text-base text-foreground outline-none transition-all uppercase tracking-widest"
                    style={{
                      background: "var(--input-background)",
                      borderColor: "var(--guess-border)",
                      fontFamily: "'DM Mono', monospace",
                    }}
                    placeholder="BEAT-0000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={9}
                  />
                </div>
                <button
                  onClick={() => code.length >= 4 && setJoined(true)}
                  disabled={code.length < 4}
                  className="px-5 py-3 rounded-lg text-sm font-semibold text-background transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: "var(--guess-color)", fontFamily: "'DM Sans', sans-serif" }}
                >
                  Join
                </button>
              </div>
            </div>

            <div className="w-full">
              <div
                className="text-xs tracking-widest uppercase text-muted-foreground mb-3"
                style={{ fontFamily: "'DM Mono', monospace" }}
              >
                Open Lobbies
              </div>
              <div className="flex flex-col gap-3">
                {recentRooms.map((r) => (
                  <button
                    key={r.code}
                    onClick={() => { setCode(r.code); setJoined(true); }}
                    className="flex items-center justify-between rounded-xl border px-5 py-4 text-left transition-all hover:scale-[1.01]"
                    style={{ background: modeBg(r.mode), borderColor: modeColor(r.mode) + "44" }}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-sm font-bold tracking-widest text-foreground"
                          style={{ fontFamily: "'DM Mono', monospace" }}
                        >
                          {r.code}
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            fontFamily: "'DM Mono', monospace",
                            color: modeColor(r.mode),
                            background: modeColor(r.mode) + "22",
                          }}
                        >
                          {r.mode}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        Hosted by {r.host}
                      </p>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-xs font-medium"
                        style={{ fontFamily: "'DM Mono', monospace", color: modeColor(r.mode) }}
                      >
                        {r.players}/{r.max}
                      </div>
                      <div className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                        players
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div
            className="w-full rounded-xl border p-7 text-center"
            style={{ background: "var(--guess-bg)", borderColor: "var(--guess-border)" }}
          >
            <div
              className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: "var(--guess-color)" }}
            >
              <Users size={20} className="text-background" />
            </div>
            <h2
              className="text-2xl font-extrabold text-foreground mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              JOINED {code}
            </h2>
            <p className="text-muted-foreground text-sm mb-5" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Waiting for the host to start the game…
            </p>
            <div className="flex items-center justify-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: "var(--guess-color)",
                    animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sign In ──────────────────────────────────────────────────────────────────

function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-background items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Music size={16} className="text-white" />
          </div>
          <span
            className="text-xl font-extrabold text-foreground tracking-tight"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            BEATIQ
          </span>
        </div>

        {/* Toggle */}
        <div
          className="flex rounded-lg p-1 mb-7"
          style={{ background: "var(--secondary)" }}
        >
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="flex-1 py-2 text-sm font-medium rounded-md transition-all"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                background: mode === m ? "var(--primary)" : "transparent",
                color: mode === m ? "#fff" : "var(--muted-foreground)",
              }}
            >
              {m === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {!submitted ? (
          <div className="flex flex-col gap-4">
            {mode === "signup" && (
              <div>
                <label
                  className="block text-xs text-muted-foreground mb-1.5"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Username
                </label>
                <input
                  className="w-full rounded-lg border px-4 py-3 text-sm text-foreground outline-none transition-all"
                  style={{
                    background: "var(--input-background)",
                    borderColor: "var(--border)",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  placeholder="nova_k"
                />
              </div>
            )}
            <div>
              <label
                className="block text-xs text-muted-foreground mb-1.5"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Email
              </label>
              <input
                className="w-full rounded-lg border px-4 py-3 text-sm text-foreground outline-none transition-all"
                style={{
                  background: "var(--input-background)",
                  borderColor: "var(--border)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
                placeholder="you@example.com"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label
                className="block text-xs text-muted-foreground mb-1.5"
                style={{ fontFamily: "'DM Sans', sans-serif" }}
              >
                Password
              </label>
              <div className="relative">
                <input
                  className="w-full rounded-lg border pl-4 pr-10 py-3 text-sm text-foreground outline-none transition-all"
                  style={{
                    background: "var(--input-background)",
                    borderColor: "var(--border)",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  placeholder="••••••••"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {mode === "signin" && (
              <div className="text-right">
                <button
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  style={{ fontFamily: "'DM Sans', sans-serif" }}
                >
                  Forgot password?
                </button>
              </div>
            )}
            <button
              onClick={() => email && password && setSubmitted(true)}
              disabled={!email || !password}
              className="w-full py-3 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 mt-1"
              style={{ background: "var(--primary)", fontFamily: "'DM Sans', sans-serif" }}
            >
              {mode === "signin" ? "Sign In" : "Create Account"}
            </button>

            <div className="relative flex items-center gap-3 my-1">
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
              <span className="text-xs text-muted-foreground" style={{ fontFamily: "'DM Sans', sans-serif" }}>
                or
              </span>
              <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            </div>

            <button
              className="w-full py-3 rounded-lg border text-sm font-medium text-foreground transition-all hover:bg-secondary flex items-center justify-center gap-2"
              style={{ borderColor: "var(--border)", fontFamily: "'DM Sans', sans-serif" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </div>
        ) : (
          <div
            className="rounded-xl border p-7 text-center"
            style={{ background: "rgba(124,58,237,0.08)", borderColor: "rgba(124,58,237,0.3)" }}
          >
            <CheckCircle size={32} className="mx-auto mb-3" style={{ color: "var(--primary)" }} />
            <h2
              className="text-2xl font-extrabold text-foreground mb-1"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              {mode === "signin" ? "WELCOME BACK" : "ACCOUNT CREATED"}
            </h2>
            <p className="text-muted-foreground text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {mode === "signin" ? "You're signed in. Ready to play?" : "Your account is ready. Let's go!"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App shell ────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage] = useState<Page>("home");

  const navigate = (p: Page) => setPage(p);
  const goHome = () => setPage("home");

  const inner = () => {
    switch (page) {
      case "home":          return <HomePage onNavigate={navigate} />;
      case "finish-lyrics": return <FinishLyricsPage />;
      case "guess-song":    return <GuessSongPage />;
      case "guess-challenge": return <ChallengePage />;
      case "join-room":     return <JoinRoomPage />;
      case "sign-in":       return <SignInPage />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(0.8); }
        }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.15); }
      `}</style>

      {page !== "home" && (
        <NavBar onBack={goHome} page={page} />
      )}

      {inner()}
    </div>
  );
}
