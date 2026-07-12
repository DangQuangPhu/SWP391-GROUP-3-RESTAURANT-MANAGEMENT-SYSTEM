// role_id=3 (Kitchen Staff) deprecated — KDS is device-based, not account-based.
// KITCHEN kept as alias so code referencing it does not break during the transition.
export const STAFF_ROLE = {
  RESTAURANT: "restaurant_staff",
  KITCHEN:    "restaurant_staff",  // Deprecated alias — maps to restaurant_staff
};

export const STAFF_ROLE_LABEL = {
  ["restaurant_staff"]: "Restaurant Staff",
};

