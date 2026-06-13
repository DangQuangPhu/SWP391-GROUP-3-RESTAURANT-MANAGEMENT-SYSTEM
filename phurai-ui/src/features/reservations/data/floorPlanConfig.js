/**
 * Frontend-only presentation config for the reservation floor plan.
 * The backend stays authoritative for real table_id / area_id / availability.
 * Here we only map DB tables to a premium visual layout (floors, zones, x/y).
 */

// Visual position (percentage of the floor canvas) keyed by DB table_number.
export const TABLE_LAYOUT = {
  // Floor 1 — Main Dining (center)
  T01: { x: 22, y: 34 },
  T02: { x: 40, y: 30 },
  T03: { x: 34, y: 58 },
  T04: { x: 54, y: 56 },
  // Floor 1 — VIP Lounge (right)
  V01: { x: 78, y: 30 },
  V02: { x: 84, y: 56 },
  // Floor 1 — Window / Bar (left strip)
  B01: { x: 9, y: 70 },
  // Floor 1 — Private Room (top right)
  P01: { x: 80, y: 84 },
  // Floor 2 — Rooftop Terrace
  G01: { x: 34, y: 42 },
  G02: { x: 62, y: 48 },
};

// Soft zone cards drawn behind the table nodes (percentages: x/y/w/h).
export const FLOORS = [
  {
    id: 1,
    label: "Floor 1",
    sublabel: "Indoor Fine Dining",
    zones: [
      { id: "main", label: "Main Dining", desc: "Center area · 1–6 guests", x: 16, y: 18, w: 50, h: 56 },
      { id: "vip", label: "VIP Lounge", desc: "Premium booths · 2–10 guests", x: 70, y: 18, w: 26, h: 50 },
      { id: "window", label: "Window / Bar", desc: "Calm seating · couples", x: 4, y: 58, w: 22, h: 32 },
      { id: "private", label: "Private Event Room", desc: "Celebrations · 6–12 guests", x: 68, y: 72, w: 28, h: 22 },
    ],
  },
  {
    id: 2,
    label: "Floor 2",
    sublabel: "Rooftop / Outdoor",
    zones: [
      { id: "terrace", label: "Rooftop Terrace", desc: "Open-air garden view · 2–8 guests", x: 18, y: 24, w: 64, h: 52 },
    ],
  },
];

// DB area_name -> premium label + floor (display only; DB names untouched).
export const AREA_DISPLAY = {
  "Main Dining": { floor: 1, displayName: "Floor 1 · Standard · Center Area" },
  "VIP Lounge": { floor: 1, displayName: "Floor 1 · VIP Lounge" },
  "Wine Bar": { floor: 1, displayName: "Floor 1 · Window / Bar Area" },
  "Private Room A": { floor: 1, displayName: "Floor 1 · Private Event Room" },
  "Garden Terrace": { floor: 2, displayName: "Floor 2 · Rooftop / Outdoor" },
};

// Maps a UI area preference -> DB area_type used by the backend availability filter.
export const AREA_PREFERENCES = [
  { id: "any", label: "Any Area", areaType: null },
  { id: "standard", label: "Standard", areaType: "Regular" },
  { id: "vip", label: "VIP", areaType: "VIP" },
  { id: "private", label: "Private Room", areaType: "Private" },
  { id: "rooftop", label: "Rooftop / Outdoor", areaType: "Outdoor" },
  { id: "bar", label: "Window / Bar", areaType: "Bar" },
];

export const DINING_PURPOSES = [
  { id: "casual", label: "Casual Dinner" },
  { id: "birthday", label: "Birthday Celebration", event: true },
  { id: "anniversary", label: "Anniversary" },
  { id: "business", label: "Business Dinner" },
  { id: "family", label: "Family Gathering" },
  { id: "private", label: "Private Party", event: true },
  { id: "rooftop", label: "Rooftop Gathering" },
  { id: "corporate", label: "Corporate Dinner", event: true },
];

export const GUEST_OPTIONS = [1, 2, 4, 6, 8, 10, 12];

export const HOLD_DURATION_OPTIONS = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 45, label: "45 minutes" },
  { value: 60, label: "1 hour" },
];

/**
 * Generate 30-minute time slots inside opening hours.
 * Last start respects the chosen duration so the booking ends before close.
 */
export function buildTimeSlots(openTime = "10:00", closeTime = "22:00", durationMinutes = 120) {
  const toMin = (t) => {
    const [h, m] = String(t).split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const open = toMin(openTime);
  const close = toMin(closeTime);
  const lastStart = close - durationMinutes;
  const slots = [];
  for (let min = open; min <= lastStart; min += 30) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const label = `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
    slots.push({ value, label });
  }
  return slots;
}

/**
 * Promotions are a presentation-only perk for signed-in members. There is no
 * promotion column in the database, so an applied promotion is shown in the
 * summary / success panel for the guest's reference and is NOT sent to the
 * backend (keeps the SQL schema and booking logic untouched).
 */
export const PROMOTIONS = [
  {
    id: "member-10",
    label: "Member · 10% Dining Credit",
    desc: "10% back as Phūrai dining credit on your next visit.",
  },
  {
    id: "welcome-drink",
    label: "Complimentary Welcome Drink",
    desc: "A signature welcome cocktail or mocktail for your table.",
  },
  {
    id: "birthday-dessert",
    label: "Birthday Dessert on the House",
    desc: "A celebratory dessert prepared by our pastry chef.",
  },
];

// Suggested area chips shown for event-style dining purposes.
export const EVENT_AREA_HINTS = {
  birthday: ["VIP", "Private Room", "Rooftop / Outdoor"],
  private: ["Private Room", "VIP", "Rooftop / Outdoor"],
  corporate: ["Private Room", "VIP"],
};
