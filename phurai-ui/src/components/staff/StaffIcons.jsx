/* Lightweight inline stroke-icon set for the staff portal.
   Keeps the dashboard dependency-free and consistent in weight. */

const PATHS = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  clock: "M12 7v5l3 2 M12 21a9 9 0 100-18 9 9 0 000 18z",
  calendar:
    "M7 3v3M17 3v3M3.5 9h17M5 5h14a1.5 1.5 0 011.5 1.5v13A1.5 1.5 0 0119 21H5a1.5 1.5 0 01-1.5-1.5v-13A1.5 1.5 0 015 5z",
  check: "M5 13l4 4L19 7",
  table:
    "M4 7h16M4 7v10M20 7v10M4 17h16M9 7v10M15 7v10",
  dish: "M3 11h18M12 3a7 7 0 017 7H5a7 7 0 017-7zM8 17v3M16 17v3M6 21h12",
  receipt:
    "M6 2h12v20l-2-1.5L14 22l-2-1.5L10 22l-2-1.5L6 22zM9 7h6M9 11h6M9 15h4",
  fire: "M12 3c1 3-2 4-2 7a2 2 0 104 0c0-1 1-1.5 1-3 2 2 3 4 3 6a6 6 0 11-12 0c0-4 4-5 6-10z",
  star: "M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 17l-5.3 2.8 1-5.8L3.5 9.7l5.9-.9z",
  tag: "M3 11l8-8 10 10-8 8zM7.5 7.5h.01",
  heart: "M12 20s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.4-7 10-7 10z",
  wallet:
    "M3 7h15a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7zm0 0V6a2 2 0 012-2h11M17 13h.01",
  users:
    "M16 19v-2a3 3 0 00-3-3H6a3 3 0 00-3 3v2M9.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM21 19v-2a3 3 0 00-2.2-2.9M16 4.1A3.5 3.5 0 0116 11",
  report:
    "M5 3h9l5 5v13a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v5h5M8 13h8M8 17h5",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  settings:
    "M12 9a3 3 0 100 6 3 3 0 000-6zM19.4 13a7.6 7.6 0 000-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 00-1.7-1l-.3-2.6h-4l-.3 2.6a7.6 7.6 0 00-1.7 1l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 000 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 001.7 1l.3 2.6h4l.3-2.6a7.6 7.6 0 001.7-1l2.3 1 2-3.4z",
  logout: "M15 12H3m0 0l4-4m-4 4l4 4M9 4h8a2 2 0 012 2v12a2 2 0 01-2 2H9",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  plus: "M12 5v14M5 12h14",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6L6 18",
  chevron: "M9 6l6 6-6 6",
  download: "M12 3v12m0 0l-4-4m4 4l4-4M5 21h14",
  edit: "M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3zM13.5 6.5l3 3",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z",
  arrowUp: "M12 19V5M5 12l7-7 7 7",
  arrowDown: "M12 5v14M5 12l7 7 7-7",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18",
};

function Icon({ name, size = 18, strokeWidth = 1.7, className = "" }) {
  const d = PATHS[name];
  if (!d) return null;
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {d.split("M").filter(Boolean).map((seg, i) => (
        <path key={i} d={`M${seg}`} />
      ))}
    </svg>
  );
}

export default Icon;
