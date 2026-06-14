/* Sidebar navigation for the /staff portal (Restaurant & Kitchen staff). */

export const NAV_GROUPS = [
  {
    group: "Front of House",
    items: [
      {
        id: "reservation-queue",
        label: "Reservation Queue",
        view: "reservation-queue",
        icon: "calendar",
        implemented: true,
      },
    ],
  },
];

export const VIEW_SUBTITLE = {
  "reservation-queue": "Review and action pending online bookings",
};
