/**
 * intro-paths.js — Dancing Script Bold SVG Path Data
 *
 * This file contains pre-generated SVG path data for the CinematicIntro
 * animation words (Hello, Welcome, To).
 *
 * HOW TO REGENERATE (requires internet connection):
 * ─────────────────────────────────────────────────
 *   1. npm install opentype.js --save-dev
 *   2. Download Dancing Script Bold TTF:
 *      curl -L "https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSo3ROp6hNX6plRP.ttf" \
 *           -o /tmp/dancing-script-700.ttf
 *   3. node scripts/generate-intro-paths.mjs
 *
 * CURRENT STATE: paths are empty → CinematicIntro uses clipPath fallback.
 * The animation will work correctly with the clipPath reveal technique
 * until this file is populated with real path data.
 *
 * Once populated, set PATHS_READY = true below to activate stroke animation.
 */

export const PATHS_READY = false;

export const INTRO_PATHS = {
  // When PATHS_READY = true, each entry should have:
  // {
  //   d: "M ... Z",            (SVG path data from opentype.js)
  //   viewBox: "x y w h",      (bounding box with 20px padding)
  //   width: number,
  //   height: number,
  // }
  hello:   null,
  welcome: null,
  to:      null,
};

export default INTRO_PATHS;
