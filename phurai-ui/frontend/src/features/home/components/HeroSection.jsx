import { useEffect, useRef, useState } from 'react';
import { Link } from "react-router-dom";
import { homeImages } from "../data/homeAssets.js";
import { useScrollReveal } from "@/hooks/useScrollReveal";

/**
 * HeroSection
 *
 * Video strategy:
 *   - src is SET IMMEDIATELY so browser preloads while intro overlay is on top.
 *   - .play() is only called once intro finishes (isVideoPlaying = true).
 *   - This eliminates the gray-flash: by the time the overlay lifts, video
 *     has already buffered its first frame.
 *   - The hero section has a black background-color as a further safety net.
 */
function HeroSection({ isRevealReady = true, isVideoPlaying = true }) {
  const revealRef = useScrollReveal({ enabled: isRevealReady });
  const videoRef  = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Always set src immediately so it preloads in the background.
    // The intro overlay (z-index: 2000) hides it while it buffers.
    if (!video.src && homeImages.heroVideo) {
      video.src = homeImages.heroVideo;
      video.load(); // explicitly trigger preload
    }

    if (isVideoPlaying) {
      video.play().catch(e => console.log('Video autoplay prevented:', e));
    } else {
      video.pause();
    }
  }, [isVideoPlaying]);

  return (
    <section className="phurai-hero" aria-label="Welcome">
      <video
        ref={videoRef}
        className="phurai-hero__bg"
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      />

      <div className="phurai-hero__overlay" aria-hidden="true" />

      <div className="phurai-hero__content home-reveal-parent" ref={revealRef}>
        <div className="phurai-hero__badge home-reveal-child">
          <span className="phurai-hero__badge-line" />
          <p>AWARD-WINNING CUISINE SINCE 2015</p>
          <span className="phurai-hero__badge-line" />
        </div>

        <h1 className="phurai-hero__title home-reveal-child home-reveal-child--delay-1">
          Taste the
          <br />
          <em>Extraordinary</em>
        </h1>

        <p className="phurai-hero__subtitle home-reveal-child home-reveal-child--delay-2">
          Experience the perfect blend of local flavors and international culinary artistry.
          <br />
          Every dish tells a story of passion, precision, and premium ingredients.
        </p>

        <div className="phurai-hero__actions home-reveal-child home-reveal-child--delay-3">
          <Link to="/menus" className="phurai-btn-primary">
            EXPLORE MENU
          </Link>
          <Link to="/reservations" className="phurai-btn-ghost">
            RESERVE TABLE
          </Link>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;