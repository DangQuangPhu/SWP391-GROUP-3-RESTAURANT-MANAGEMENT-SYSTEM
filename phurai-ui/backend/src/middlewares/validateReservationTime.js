import { z } from 'zod';

const reservationTimeSchema = z.object({
  reservation_start_at: z.string().datetime({ message: "Invalid ISO datetime string for start time" }),
  reservation_end_at: z.string().datetime({ message: "Invalid ISO datetime string for end time" })
});

export const validateReservationTime = (req, res, next) => {
  try {
    // Basic structural validation
    const parsed = reservationTimeSchema.parse({
      reservation_start_at: req.body.reservation_start_at,
      reservation_end_at: req.body.reservation_end_at
    });

    const startTime = new Date(parsed.reservation_start_at);
    const endTime = new Date(parsed.reservation_end_at);

    // Defense in Depth: end time must be strictly greater than start time
    if (endTime.getTime() <= startTime.getTime()) {
      return res.status(400).json({
        success: false,
        message: "Invalid reservation duration: end time must be after start time."
      });
    }

    // Verify Timezone/Bypass Logic: Extract local HH:MM to compare against hard close limit (22:00)
    // We strictly use the local representation of the time or normalize it to the restaurant's timezone.
    // Assuming the restaurant is in a specific timezone, but for now we enforce UTC/Local constraints 
    // by extracting the exact hour and minutes passed.
    
    // A robust way is to just enforce that the end time does not exceed 22:00 (or 00:00).
    const endHour = endTime.getHours();
    const endMinutes = endTime.getMinutes();

    const endMinutesSinceMidnight = endHour * 60 + endMinutes;
    const closeMinutesSinceMidnight = 22 * 60; // 22:00

    // If close time is 22:00, no reservation can end after 22:00.
    // If it spans past midnight, endHour would be 23 or 0.
    // For 22:00 close limit:
    if (endMinutesSinceMidnight > closeMinutesSinceMidnight) {
       return res.status(400).json({
         success: false,
         message: "Reservation end time exceeds restaurant closing hours (22:00)."
       });
    }

    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Safe, sanitized error messages without leaking SQL or stack traces
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: error.errors.map(e => ({ path: e.path, message: e.message }))
      });
    }
    return res.status(400).json({
      success: false,
      message: "Bad Request"
    });
  }
};
