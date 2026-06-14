import { TABLE_STATUS_META } from "../../data/managerDashboardMockData.js";

export const STATUS_KEYS = Object.keys(TABLE_STATUS_META);

export const STATUS_SLUG_TO_API = {
  available: "Available",
  reserved: "Reserved",
  occupied: "Occupied",
  cleaning: "Cleaning",
  inactive: "Inactive",
};

export const EMPTY_NEW_TABLE = {
  table_number: "",
  area_id: "",
  capacity: 2,
  status: "available",
};
