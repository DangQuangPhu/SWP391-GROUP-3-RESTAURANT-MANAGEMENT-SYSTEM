/**
 * Frontend-only presentation config for the reservation floor plan.
 * The backend stays authoritative for real table_id / area_id / availability.
 * Here we only map DB tables to a premium visual layout (floors, zones, x/y).
 */

export const SHAPES = {
  "round2": { shape: 'circle', r: 20, n: 2, gap: 14 },
  "round4": { shape: 'circle', r: 24, n: 4, gap: 15 },
  "booth6": { shape: 'ellipse', rx: 50, ry: 30, n: 6, gap: 16 },
  "booth8": { shape: 'ellipse', rx: 65, ry: 35, n: 8, gap: 16 },
  "vip6": { shape: 'ellipse', rx: 50, ry: 28, n: 6, gap: 16 },
  "rect2": { shape: 'rect', w: 46, h: 46, rx: 8, ry: 8, n: 2, gap: 14 },
  "rect4": { shape: 'rect', w: 66, h: 46, rx: 8, ry: 8, n: 4, gap: 14 },
  "rect6": { shape: 'rect', w: 90, h: 50, rx: 8, ry: 8, n: 6, gap: 15 },
  "rect8": { shape: 'rect', w: 110, h: 54, rx: 8, ry: 8, n: 8, gap: 16 }
};

// Visual position & styling keyed by DB table_number.
export const TABLE_LAYOUT = {
  // ---- Window Row (Ascending: 2, 4, 6, 8 seats) ----
  "WIN-A": { x: 140, y: 120, type: "round2", fill: "#dceaf5", chair: "#cfe3da" },
  "WIN-B": { x: 400, y: 120, type: "round4", fill: "#dceaf5", chair: "#cfe3da" },
  "WIN-C": { x: 880, y: 120, type: "booth6", fill: "#dceaf5", chair: "#cfe3da" },
  "WIN-D": { x: 1165, y: 120, type: "booth8", fill: "#dceaf5", chair: "#cfe3da" },

  // ---- VIP Rooms Row (6 seats) ----
  "VIP-1": { x: 140, y: 305, type: "vip6", fill: "#f6d6d6", chair: "#f1c2c2" },
  "VIP-2": { x: 140, y: 475, type: "vip6", fill: "#f6d6d6", chair: "#f1c2c2" },
  "VIP-3": { x: 140, y: 645, type: "vip6", fill: "#f6d6d6", chair: "#f1c2c2" },

  // ---- Standard Hall (4 columns x 3 rows = 12 tables of 4 seats) ----
  "S-01": { x: 350, y: 300, type: "round4" }, "S-02": { x: 490, y: 300, type: "round4" }, "S-03": { x: 630, y: 300, type: "round4" }, "S-04": { x: 770, y: 300, type: "round4" },
  "S-05": { x: 350, y: 450, type: "round4" }, "S-06": { x: 490, y: 450, type: "round4" }, "S-07": { x: 630, y: 450, type: "round4" }, "S-08": { x: 770, y: 450, type: "round4" },
  "S-09": { x: 350, y: 600, type: "round4" }, "S-10": { x: 490, y: 600, type: "round4" }, "S-11": { x: 630, y: 600, type: "round4" }, "S-12": { x: 770, y: 600, type: "round4" },

  // ---- Premium Hall (4 tables of 4 seats arranged vertically) ----
  "PRE-01": { x: 930, y: 300, type: "round4", fill: "#f7e6c2", chair: "#f0d8a8" },
  "PRE-02": { x: 930, y: 420, type: "round4", fill: "#f7e6c2", chair: "#f0d8a8" },
  "PRE-03": { x: 930, y: 540, type: "round4", fill: "#f7e6c2", chair: "#f0d8a8" },
  "PRE-04": { x: 930, y: 660, type: "round4", fill: "#f7e6c2", chair: "#f0d8a8" },

  // ---- Private Rooms (Ascending: 2, 4, 6, 8 rectangular seats) ----
  "PR-01": { x: 1165, y: 320, type: "rect2", fill: "#ece1f0", chair: "#ddc9e6" },
  "PR-02": { x: 1165, y: 460, type: "rect4", fill: "#ece1f0", chair: "#ddc9e6" },
  "PR-03": { x: 1165, y: 610, type: "rect6", fill: "#ece1f0", chair: "#ddc9e6" },
  "PR-04": { x: 1165, y: 790, type: "rect8", fill: "#ece1f0", chair: "#ddc9e6" },

  // ---- Kitchen View (Area close to kitchen, 4 tables) ----
  "K-01": { x: 330, y: 825, type: "round4" },
  "K-02": { x: 410, y: 825, type: "round4" },
  "K-03": { x: 490, y: 825, type: "round4" },
  "K-04": { x: 570, y: 825, type: "round4" }
};

// `FLOORS` is no longer used for standard zone rendering as it is baked into the SVG.
export const FLOORS = [
  { id: 1, label: "All Areas", sublabel: "Full Map", zones: [] }
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
  { id: "date_night", label: "Date Night" },
  { id: "birthday", label: "Birthday", event: true },
  { id: "anniversary", label: "Anniversary" },
  { id: "business", label: "Business Meeting" },
  { id: "family", label: "Family Gathering" },
  { id: "special", label: "Special Occasion", event: true },
  { id: "private", label: "Private Party", event: true },
  { id: "other", label: "Other" },
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

export const KITCHEN_VIEW_AREA_NAME = "Kitchen View";
export const KITCHEN_VIEW_AREA_ID = 6;
/** Fallback when settings/API capacity is unavailable (K-01 + K-02 + K-03). */
export const KITCHEN_VIEW_COUNTER_CAPACITY = 4;

/** Dining area choices in the booking form (table-based vs counter seats). */
export const BOOKING_AREAS = [
  { area_id: null, area_name: null, label: "Standard dining (choose a table)" },
  {
    area_id: KITCHEN_VIEW_AREA_ID,
    area_name: KITCHEN_VIEW_AREA_NAME,
    label: "Kitchen View (counter seats)",
  },
];
