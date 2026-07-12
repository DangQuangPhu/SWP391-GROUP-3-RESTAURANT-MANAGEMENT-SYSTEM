/**
 * CinematicIntro — Apple "Hello" cinematic preloader for Phūrai.
 *
 * Animation technique (dual-mode):
 *
 * MODE A — True SVG stroke draw-on (when PATHS_READY = true in introPaths.js)
 *   Each word rendered as motion.path with pathLength: 0 → 1.
 *   Activate by running: node scripts/generate-intro-paths.mjs
 *
 * MODE B — clipPath rect mask reveal (current default)
 *   Reveals text left→right via animated <rect> clipping path.
 *   Identical visual result, no path data required.
 *
 * Both modes share the same timing, easing and arc curtain logic.
 *
 * Sequence (total ≈ 4.7s):
 *   0.0s  → "Hello"   draws (0.6s)  + hold 180ms
 *   0.78s → "Welcome" draws (0.75s) + hold 180ms
 *   1.71s → "To"      draws (0.38s) + hold 180ms
 *   2.27s → "Phūrai"  clipPath      + gold flourish stroke + hold 280ms
 *   3.40s → Black arc rise (0.85s)
 *   4.25s → Home page revealed
 */

import { useState, useEffect, useCallback } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import { INTRO_PATHS, PATHS_READY } from "@/features/home/data/introPaths.js";
import "@/features/home/styles/CinematicIntro.css";

/* ── timing constants ─────────────────────────────────────── */
const WORDS = [
  { key: "hello",   text: "Hello",   drawDuration: 0.6,  holdMs: 180 },
  { key: "welcome", text: "Welcome", drawDuration: 0.75, holdMs: 180 },
  { key: "to",      text: "To",      drawDuration: 0.38, holdMs: 180 },
];
const NAME_DRAW    = 0.85;
const NAME_HOLD_MS = 280;
const ARC_DUR      = 0.85;
const EXIT_DELAY   = 180;
const EXIT_DUR_MS  = 320;

/* ── easing ───────────────────────────────────────────────── */
// Ink-write easing: quick start, smooth deceleration
const INK_EASE = [0.22, 0.61, 0.36, 1];

/* ── arc path generator ───────────────────────────────────── */
function makeArc(p) {
  const edge = 115 - p * 150;
  const ctrl = edge + 30;
  return `M 0 ${edge} Q 50 ${ctrl} 100 ${edge} L 100 115 L 0 115 Z`;
}

/* ── clipPath counter (SSR-safe) ──────────────────────────── */
let _clipId = 0;
const nextClipId = () => `phurai-ci-${++_clipId}`;

/* ── SVG canvas for clipPath mode ─────────────────────────── */
const VW = 700;
const VH = 130;

/* ──────────────────────────────────────────────────────────
   WordReveal — renders one word.
   • MODE A: true SVG stroke pathLength animation
   • MODE B: clipPath rect mask reveal (fallback)
   ────────────────────────────────────────────────────────── */
function WordReveal({ wordKey, text, drawDuration, onDone }) {
  const pathData = PATHS_READY ? INTRO_PATHS[wordKey] : null;

  // MODE A — true path draw-on
  if (pathData?.d) {
    return (
      <svg
        className="phurai-intro__word-svg"
        viewBox={pathData.viewBox}
        preserveAspectRatio="xMidYMid meet"
        aria-label={text}
        role="img"
      >
        <motion.path
          d={pathData.d}
          fill="none"
          stroke="#111111"
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: drawDuration, ease: INK_EASE }}
          onAnimationComplete={onDone}
        />
      </svg>
    );
  }

  // MODE B — clipPath mask reveal
  const clipId = nextClipId();
  return (
    <svg
      className="phurai-intro__word-svg"
      viewBox={`0 0 ${VW} ${VH}`}
      aria-label={text}
      role="img"
    >
      <defs>
        <clipPath id={clipId}>
          <motion.rect
            x="0" y="0"
            height={VH}
            initial={{ width: 0 }}
            animate={{ width: VW }}
            transition={{ duration: drawDuration, ease: INK_EASE }}
            onAnimationComplete={onDone}
          />
        </clipPath>
      </defs>
      <text
        clipPath={`url(#${clipId})`}
        x={VW / 2}
        y="100"
        textAnchor="middle"
        fontSize="116"
        fontFamily="'Dancing Script', cursive"
        fontWeight="700"
        fill="#111111"
      >
        {text}
      </text>
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────
   NameReveal — "Phūrai" with clipPath + gold flourish stroke
   (Imperial Script is web-only → clipPath mode always used)
   ────────────────────────────────────────────────────────── */
const FLOURISH_D = `M 100,108 C 170,122 280,128 350,126 C 420,124 520,116 600,106`;

function NameReveal({ onDone }) {
  const clipId = nextClipId();

  return (
    <svg
      className="phurai-intro__name-svg"
      viewBox={`0 0 ${VW} 145`}
      preserveAspectRatio="xMidYMid meet"
      aria-label="Phūrai"
      role="img"
    >
      <defs>
        <clipPath id={clipId}>
          <motion.rect
            x="0" y="0"
            height="115"
            initial={{ width: 0 }}
            animate={{ width: VW }}
            transition={{ duration: NAME_DRAW, ease: INK_EASE }}
          />
        </clipPath>
      </defs>

      {/* Restaurant name in logo font */}
      <text
        clipPath={`url(#${clipId})`}
        x={VW / 2}
        y="97"
        textAnchor="middle"
        fontSize="128"
        fontFamily="var(--font-script, 'Imperial Script', cursive)"
        fontWeight="normal"
        fill="#111111"
        letterSpacing="2"
      >
        Phūrai
      </text>

      {/* Gold flourish underline — true pathLength stroke draw */}
      <motion.path
        d={FLOURISH_D}
        fill="none"
        stroke="#9f8655"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 0.65 }}
        transition={{
          pathLength: { duration: NAME_DRAW * 1.1, ease: INK_EASE },
          opacity:    { duration: 0.3, delay: 0.1 },
        }}
        onAnimationComplete={onDone}
      />
    </svg>
  );
}

/* ──────────────────────────────────────────────────────────
   CinematicIntro — orchestrator
   ────────────────────────────────────────────────────────── */
export default function CinematicIntro({ onDone }) {
  const [wordIdx, setWordIdx] = useState(0);
  const [phase, setPhase]     = useState("words"); // words | name | arc | exit

  const progress = useMotionValue(0);
  const arcPath  = useTransform(progress, makeArc);

  const handleWordDone = useCallback(() => {
    const { holdMs } = WORDS[wordIdx];
    setTimeout(() => {
      if (wordIdx < WORDS.length - 1) {
        setWordIdx(i => i + 1);
      } else {
        setPhase("name");
      }
    }, holdMs);
  }, [wordIdx]);

  const handleNameDone = useCallback(() => {
    setTimeout(() => setPhase("arc"), NAME_HOLD_MS);
  }, []);

  useEffect(() => {
    if (phase !== "arc") return;
    const ctrl = animate(progress, 1, {
      duration: ARC_DUR,
      ease: [0.76, 0, 0.24, 1],
      onComplete: () => {
        setTimeout(() => {
          setPhase("exit");
          setTimeout(() => onDone?.(), EXIT_DUR_MS);
        }, EXIT_DELAY);
      },
    });
    return () => ctrl.stop();
  }, [phase, progress, onDone]);

  const showOverlay = phase !== "exit";

  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div
          key="cinematic-overlay"
          className="phurai-intro__overlay"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: EXIT_DUR_MS / 1000, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="phurai-intro__center">
            <AnimatePresence mode="wait">
              {phase === "words" && (
                <motion.div
                  key={`word-${wordIdx}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  <WordReveal
                    wordKey={WORDS[wordIdx].key}
                    text={WORDS[wordIdx].text}
                    drawDuration={WORDS[wordIdx].drawDuration}
                    onDone={handleWordDone}
                  />
                </motion.div>
              )}

              {phase === "name" && (
                <motion.div
                  key="name"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                >
                  <NameReveal onDone={handleNameDone} />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {phase === "name" && (
                <motion.p
                  key="sub"
                  className="phurai-intro__sub"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.45, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  RESTAURANT & BAR
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Black arc curtain — always true pathLength via MotionValue */}
          <svg
            className="phurai-intro__arc"
            viewBox="0 0 100 115"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <motion.path d={arcPath} fill="#0d0d0d" />
          </svg>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
