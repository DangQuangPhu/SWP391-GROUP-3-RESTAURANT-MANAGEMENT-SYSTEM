import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function LandingPage() {
  const containerRef = useRef(null);
  const heroTextRef = useRef(null);
  const maskContainerRef = useRef(null);
  const maskVideoRef = useRef(null);
  const cardsContainerRef = useRef(null);
  const card1Ref = useRef(null);
  const card2Ref = useRef(null);
  const card3Ref = useRef(null);

  useEffect(() => {
    let ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: "top top",
          end: "+=300%",
          pin: true,
          scrub: 1,
        },
      });

      // 1. Text Gradient & Fade-Up
      tl.fromTo(
        heroTextRef.current,
        { y: 100, opacity: 0, scale: 0.9 },
        { y: 0, opacity: 1, scale: 1, duration: 1, ease: "power2.out" }
      );

      // 2. Scale & Masking (The Deep Dive)
      tl.to(
        heroTextRef.current,
        { y: -100, opacity: 0, duration: 1, ease: "power2.in" },
        "+=0.5"
      );

      tl.fromTo(
        maskContainerRef.current,
        { width: "20vw", height: "20vh", borderRadius: "24px" },
        { width: "100vw", height: "100vh", borderRadius: "0px", duration: 2, ease: "power2.inOut" },
        "<" // run at the same time as the text fade out
      );

      // 3. Scrubbing Sequence: 3 core feature cards slide in
      tl.fromTo(
        [card1Ref.current, card2Ref.current, card3Ref.current],
        { y: "100vh", opacity: 0 },
        { y: "0", opacity: 1, duration: 1.5, stagger: 0.2, ease: "power3.out" }
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div style={{ backgroundColor: "#000", minHeight: "100vh", color: "#fff", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div ref={containerRef} style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
        
        {/* The Text */}
        <h1 
          ref={heroTextRef}
          style={{
            position: "absolute",
            zIndex: 10,
            fontSize: "clamp(3rem, 8vw, 6rem)",
            fontWeight: 800,
            textAlign: "center",
            lineHeight: 1.1,
            letterSpacing: "-0.04em",
            margin: 0,
            background: "linear-gradient(180deg, #FFFFFF 0%, #A1A1A6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            willChange: "transform, opacity"
          }}
        >
          The future of<br/>restaurant management
        </h1>

        {/* The Masking Dashboard Element */}
        <div 
          ref={maskContainerRef}
          style={{
            position: "absolute",
            zIndex: 5,
            width: "20vw",
            height: "20vh",
            backgroundColor: "#111",
            borderRadius: "24px",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 0 40px rgba(0,0,0,0.5)",
            willChange: "width, height, border-radius"
          }}
        >
          {/* Internal Dashboard Mockup Content */}
          <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "radial-gradient(circle at 50% 0%, rgba(50,50,50,0.4) 0%, rgba(0,0,0,1) 100%)" }} />
          
          <div 
            ref={cardsContainerRef}
            style={{
              position: "absolute",
              bottom: "10vh",
              display: "flex",
              gap: "2rem",
              width: "100%",
              justifyContent: "center",
              padding: "0 2rem",
              zIndex: 20
            }}
          >
            {[
              { ref: card1Ref, title: "Orders", desc: "Real-time kitchen syncing", icon: "🍽️" },
              { ref: card2Ref, title: "Inventory", desc: "Automated stock alerts", icon: "📦" },
              { ref: card3Ref, title: "Analytics", desc: "Deep revenue insights", icon: "📈" }
            ].map((card, idx) => (
              <div 
                key={idx}
                ref={card.ref}
                style={{
                  background: "rgba(255,255,255,0.05)",
                  backdropFilter: "blur(20px)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "20px",
                  padding: "2rem",
                  width: "280px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                  willChange: "transform, opacity"
                }}
              >
                <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>{card.icon}</div>
                <h3 style={{ margin: "0 0 0.5rem 0", fontSize: "1.5rem", fontWeight: 600 }}>{card.title}</h3>
                <p style={{ margin: 0, color: "#A1A1A6", fontSize: "1rem", lineHeight: 1.4 }}>{card.desc}</p>
              </div>
            ))}
          </div>

        </div>
      </div>
      
      {/* Spacer to allow scrolling past the pinned section */}
      <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
        <h2 style={{ fontSize: "3rem", fontWeight: 700, color: "#fff", marginBottom: "1rem" }}>Phūrai Premium</h2>
        <p style={{ color: "#A1A1A6", fontSize: "1.2rem" }}>Experience the art of dining management.</p>
      </div>
    </div>
  );
}
