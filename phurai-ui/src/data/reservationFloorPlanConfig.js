/**
 * Frontend-only visual layout for the reservation floor plan.
 *
 * The database has NO floor / zone / x / y / shape columns, so every visual
 * detail lives here. The backend stays authoritative for the real data:
 *   table_id, table_number, area_id, capacity, table_status, availability.
 *
 * Tables are matched to this config by DB `table_number` (T01, V01, …).
 * `displayLabel` is purely cosmetic — reservations always submit real table_id.
 *
 * All coordinates are in SVG user units inside a 1200 x 760 viewBox.
 */

export const FLOOR_VIEWBOX = { width: 1200, height: 760 };

export const FLOOR_PLANS = [
  {
    id: 1,
    label: "Floor 1",
    sublabel: "Indoor Dining",
    viewBox: "0 0 1200 760",
    boundary: { x: 24, y: 24, w: 1152, h: 712 },
    boundaryType: "wall",
    // Visual-only entrance hint on the lower-left wall.
    entrance: { x: 24, y: 612, w: 8, h: 84, label: "ENTRANCE" },
    zones: [
      { id: "window", label: "Window Area", x: 48, y: 60, w: 290, h: 300, variant: "room" },
      { id: "bar", label: "Wine Bar", x: 48, y: 384, w: 290, h: 150, variant: "bar" },
      { id: "reception", label: "Reception", x: 48, y: 558, w: 290, h: 150, variant: "service" },
      { id: "main", label: "Main Dining", x: 362, y: 60, w: 468, h: 520, variant: "room" },
      { id: "kitchen", label: "Kitchen / Service", x: 362, y: 604, w: 468, h: 104, variant: "service" },
      { id: "vip", label: "VIP Lounge", x: 854, y: 60, w: 298, h: 320, variant: "vip" },
      { id: "private", label: "Private Room", x: 854, y: 404, w: 298, h: 304, variant: "private" },
    ],
    // Subtle window line drawn along the top of the Window Area zone.
    windows: [{ x1: 60, y1: 60, x2: 326, y2: 60 }],
  },
  {
    id: 2,
    label: "Floor 2",
    sublabel: "Rooftop Terrace",
    viewBox: "0 0 1200 760",
    boundary: { x: 24, y: 24, w: 1152, h: 712 },
    boundaryType: "open",
    zones: [
      { id: "terrace", label: "Rooftop Terrace", x: 60, y: 70, w: 620, h: 600, variant: "open" },
      { id: "balcony", label: "Balcony View", x: 720, y: 70, w: 420, h: 300, variant: "open" },
      { id: "event", label: "Event Corner", x: 720, y: 404, w: 420, h: 266, variant: "service" },
    ],
    // Open-air decorations (purely visual).
    railings: [{ x1: 24, y1: 44, x2: 1176, y2: 44 }],
    plants: [
      { x: 96, y: 120 },
      { x: 96, y: 620 },
      { x: 640, y: 120 },
      { x: 640, y: 620 },
      { x: 760, y: 120 },
    ],
  },
];

/**
 * Visual presentation per DB table_number.
 * shape ∈ round | rect | long | vip | vip-long | bar | private
 */
export const TABLE_VISUALS = {
  // ---- Floor 1 ----
  T01: { displayLabel: "101", floor: 1, zone: "Window Area", x: 193, y: 206, shape: "round" },
  T02: { displayLabel: "102", floor: 1, zone: "Main Dining", x: 482, y: 184, shape: "rect" },
  T03: { displayLabel: "103", floor: 1, zone: "Main Dining", x: 712, y: 184, shape: "rect" },
  T04: { displayLabel: "104", floor: 1, zone: "Main Dining", x: 596, y: 430, shape: "long" },
  V01: { displayLabel: "VIP-101", floor: 1, zone: "VIP Lounge", x: 1003, y: 160, shape: "vip" },
  V02: { displayLabel: "VIP-102", floor: 1, zone: "VIP Lounge", x: 1003, y: 312, shape: "vip-long" },
  B01: { displayLabel: "BAR-101", floor: 1, zone: "Wine Bar", x: 193, y: 452, shape: "bar" },
  P01: { displayLabel: "PR-101", floor: 1, zone: "Private Room", x: 1003, y: 556, shape: "private" },
  // ---- Floor 2 ----
  G01: { displayLabel: "201", floor: 2, zone: "Rooftop Terrace", x: 370, y: 360, shape: "round" },
  G02: { displayLabel: "202", floor: 2, zone: "Balcony View", x: 930, y: 220, shape: "round" },
};

/** Fallback visual used if a DB table has no entry above (keeps it selectable). */
export function getTableVisual(tableNumber) {
  return TABLE_VISUALS[tableNumber] || null;
}

/** Premium status labels + the CSS state key used by the map and legend. */
export const TABLE_STATE_META = {
  available: { label: "Available", selectable: true },
  suggested: { label: "Suggested", selectable: true },
  selected: { label: "Selected", selectable: true },
  reserved: { label: "Reserved", selectable: false },
  occupied: { label: "Occupied", selectable: false },
  cleaning: { label: "Cleaning", selectable: false },
  inactive: { label: "Inactive", selectable: false },
  toosmall: { label: "Too small", selectable: false },
};

/** Order shown in the legend. */
export const LEGEND_ORDER = [
  "available",
  "suggested",
  "selected",
  "reserved",
  "occupied",
  "cleaning",
  "toosmall",
];

/**
 * Derive the visual state of a table from authoritative backend flags.
 * Backend is the single source of truth for availability.
 */
export function resolveTableState(table, isSelected) {
  if (isSelected) return "selected";
  if (table.is_too_small && table.is_bookable) return "toosmall";
  if (!table.is_bookable) {
    switch (table.availability_at_slot) {
      case "Occupied":
        return "occupied";
      case "Cleaning":
        return "cleaning";
      case "Inactive":
        return "inactive";
      // "Reserved" (static status) and "Booked" (overlapping reservation) both read as reserved.
      default:
        return "reserved";
    }
  }
  if (table.is_suggested) return "suggested";
  return "available";
}
