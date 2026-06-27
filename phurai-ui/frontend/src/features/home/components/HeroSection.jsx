import { useEffect, useRef, useState } from 'react';
import { Link } from "react-router-dom";
import { homeImages } from "../data/homeAssets.js";
import { useScrollReveal } from "@/hooks/useScrollReveal";

function HeroSection({ isRevealReady = true, isVideoPlaying = true }) {
  const revealRef = useScrollReveal({ enabled: isRevealReady });
  const videoRef = useRef(null);

  // Track if this is a new session on mount (before hasSeenIntro is set to true)
  const isNewSession = useRef(!sessionStorage.getItem('hasSeenIntro'));

  // A state to control when the video source is loaded and allowed to play
  const [allowVideo, setAllowVideo] = useState(!isNewSession.current);

  useEffect(() => {
    if (isNewSession.current) {
      // For new sessions, delay loading/playing the video by 4.3 seconds
      const timer = setTimeout(() => {
        setAllowVideo(true);
      }, 3520);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (allowVideo && isVideoPlaying) {
      if (!video.src) {
        video.src = homeImages.heroVideo;
      }
      video.play().catch(e => console.log("Video playback failed/prevented:", e));
    } else {
      video.pause();
    }
  }, [allowVideo, isVideoPlaying]);

  return (
    <section className="phurai-hero" aria-label="Welcome">
      <video
        ref={videoRef}
        className="phurai-hero__bg"
        muted
        loop
        playsInline
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