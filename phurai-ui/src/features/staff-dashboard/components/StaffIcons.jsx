/* Inline stroke icons for the staff portal (aligned with manager portal set). */

const PATHS = {
  calendar:
    "M7 3v3M17 3v3M3.5 9h17M5 5h14a1.5 1.5 0 011.5 1.5v13A1.5 1.5 0 0119 21H5a1.5 1.5 0 01-1.5-1.5v-13A1.5 1.5 0 015 5z",
  check: "M5 13l4 4L19 7",
  close: "M6 6l12 12M18 6L6 18",
  logout: "M15 12H3m0 0l4-4m-4 4l4 4M9 4h8a2 2 0 012 2v12a2 2 0 01-2 2H9",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  menu: "M4 6h16M4 12h16M4 18h16",
  table:
    "M4 7h16M4 7v10M20 7v10M4 17h16M9 7v10M15 7v10",
  spark: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18",
  refresh: "M4 4v5h5M20 20v-5h-5M20 9A8 8 0 006.3 6.3M4 15a8 8 0 0013.7 2.7",
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
