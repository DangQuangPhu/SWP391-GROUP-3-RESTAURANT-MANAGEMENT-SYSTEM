import { useEffect, useRef, useState } from "react";
import Icon from "@/components/staff/StaffIcons.jsx";
import { formatVND } from "@/utils/formatCurrency.js";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function useCountUp(target, active) {
  const [val, setVal] = useState(active ? 0 : target);
  const raf = useRef(0);
  useEffect(() => {
    if (!active || typeof target !== "number") {
      setVal(target);
      return undefined;
    }
    if (prefersReducedMotion()) {
      setVal(target);
      return undefined;
    }
    const start = performance.now();
    const dur = 900;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, active]);
  return val;
}

function KpiCard({ card, index = 0 }) {
  const isNumeric = card.format === "currency" || card.format === "number";
  const animated = useCountUp(isNumeric ? card.value : card.value, isNumeric);

  let display;
  if (card.format === "currency") display = formatVND(Math.round(animated));
  else if (card.format === "number") display = Math.round(animated).toLocaleString("en-US");
  else display = card.value;

  return (
    <article
      className={`sfx-kpi sfx-kpi--${card.accent}`}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <div className="sfx-kpi__top">
        <span className="sfx-kpi__icon">
          <Icon name={card.icon} size={18} />
        </span>
        {card.trend ? (
          <span className={`sfx-kpi__trend sfx-kpi__trend--${card.trend.dir}`}>
            {card.trend.dir !== "flat" ? (
              <Icon name={card.trend.dir === "up" ? "arrowUp" : "arrowDown"} size={13} />
            ) : null}
            {card.trend.text}
          </span>
        ) : null}
      </div>
      <p className="sfx-kpi__value">
        {display}
        {card.suffix ? <span className="sfx-kpi__suffix">{card.suffix}</span> : null}
      </p>
      <p className="sfx-kpi__label">{card.label}</p>
    </article>
  );
}

export default KpiCard;
