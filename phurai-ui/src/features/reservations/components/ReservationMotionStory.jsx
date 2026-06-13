import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const STEPS = [
  {
    index: "01",
    title: "Choose your date",
    desc: "Pick the perfect evening for your visit and the moment you would like to arrive.",
  },
  {
    index: "02",
    title: "Select your seat",
    desc: "Explore our interactive floor plan across two beautifully designed levels.",
  },
  {
    index: "03",
    title: "Pick your atmosphere",
    desc: "Standard, VIP, a private event room, or the rooftop terrace under the stars.",
  },
  {
    index: "04",
    title: "Reserve the table that fits your evening",
    desc: "Confirm your details and we will prepare everything for an unforgettable night.",
  },
];

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/* Lightweight premium floor-plan renderer driven by scroll progress (0..1). */
function drawFloorPlan(canvas, progress) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
    canvas.width = w * dpr;
    canvas.height = h * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Backdrop wash.
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#16110d");
  bg.addColorStop(1, "#221a13");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const gold = "#9f8655";

  // Floor 1 plate appears 0 -> 0.4
  const f1 = Math.min(1, progress / 0.4);
  if (f1 > 0) {
    ctx.save();
    ctx.globalAlpha = f1;
    ctx.strokeStyle = "rgba(216,191,143,0.5)";
    ctx.lineWidth = 1.5;
    const pw = w * 0.5 * f1;
    const ph = h * 0.42 * f1;
    ctx.strokeRect(cx - pw / 2, cy - ph / 2, pw, ph);

    // Tables (dots)
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    const cols = 4;
    const rows = 3;
    for (let i = 0; i < cols; i += 1) {
      for (let j = 0; j < rows; j += 1) {
        const tx = cx - pw / 2 + (pw / (cols + 1)) * (i + 1);
        const ty = cy - ph / 2 + (ph / (rows + 1)) * (j + 1);
        ctx.beginPath();
        ctx.arc(tx, ty, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // VIP / private highlight 0.4 -> 0.7
  const vip = Math.max(0, Math.min(1, (progress - 0.4) / 0.3));
  if (vip > 0) {
    ctx.save();
    ctx.globalAlpha = vip;
    ctx.strokeStyle = gold;
    ctx.lineWidth = 2;
    const vw = w * 0.2;
    const vh = h * 0.22;
    ctx.strokeRect(cx + w * 0.16, cy - vh / 2, vw, vh);
    ctx.fillStyle = "rgba(159,134,85,0.18)";
    ctx.fillRect(cx + w * 0.16, cy - vh / 2, vw, vh);
    ctx.restore();
  }

  // Floor 2 rooftop 0.7 -> 1
  const f2 = Math.max(0, Math.min(1, (progress - 0.7) / 0.3));
  if (f2 > 0) {
    ctx.save();
    ctx.globalAlpha = f2;
    ctx.strokeStyle = "rgba(216,191,143,0.7)";
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1.5;
    const rw = w * 0.46;
    const rh = h * 0.2;
    ctx.strokeRect(cx - rw / 2, cy - h * 0.34, rw, rh);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(216,191,143,0.9)";
    ctx.font = "12px Georgia, serif";
    ctx.fillText("ROOFTOP TERRACE", cx - rw / 2 + 10, cy - h * 0.34 + 20);
    ctx.restore();
  }
}

function ReservationMotionStory() {
  const trackRef = useRef(null);
  const stageRef = useRef(null);
  const canvasRef = useRef(null);
  const stepRefs = useRef([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const steps = stepRefs.current;

    const setActiveStep = (progress) => {
      const idx = Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length));
      steps.forEach((el, i) => {
        if (!el) return;
        el.classList.toggle("rzv-story__step--active", i === idx);
      });
    };

    if (prefersReducedMotion()) {
      // Show all steps + final plan, no scrub.
      steps.forEach((el) => el?.classList.add("rzv-story__step--active"));
      if (canvas) drawFloorPlan(canvas, 1);
      return undefined;
    }

    if (canvas) drawFloorPlan(canvas, 0);
    setActiveStep(0);

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: trackRef.current,
        start: "top top",
        end: "bottom bottom",
        pin: stageRef.current,
        scrub: true,
        onUpdate: (self) => {
          if (canvas) drawFloorPlan(canvas, self.progress);
          setActiveStep(self.progress);
        },
      });
    }, trackRef);

    const onResize = () => {
      if (canvas) drawFloorPlan(canvas, ScrollTrigger.getAll()[0]?.progress || 0);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      ctx.revert();
    };
  }, []);

  return (
    <section className="rzv-story" ref={trackRef}>
      <div className="rzv-story__track">
        <div className="rzv-story__stage" ref={stageRef}>
          <canvas className="rzv-story__canvas" ref={canvasRef} />
          <div className="rzv-story__steps">
            {STEPS.map((step, i) => (
              <div
                key={step.index}
                className="rzv-story__step"
                ref={(el) => {
                  stepRefs.current[i] = el;
                }}
              >
                <div className="rzv-story__index">{step.index}</div>
                <h2 className="rzv-story__headline rzv-serif">{step.title}</h2>
                <p className="rzv-story__desc">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ReservationMotionStory;
