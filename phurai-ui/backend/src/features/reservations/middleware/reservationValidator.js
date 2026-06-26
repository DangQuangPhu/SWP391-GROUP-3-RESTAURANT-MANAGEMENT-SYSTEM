import { z } from 'zod';

export const reservationTimelineSchema = z.object({
  // ECC-VAL: Strict regex to reject 'Z' or '+/-' offsets. Forces local restaurant time only.
  reservation_start_at: z.string().regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, 
    "Invalid start format. Must be YYYY-MM-DDTHH:mm:ss strictly in local time."
  ),
  reservation_end_at: z.string().regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, 
    "Invalid end format. Must be YYYY-MM-DDTHH:mm:ss strictly in local time."
  ),
}).superRefine((data, ctx) => {
  const start = new Date(data.reservation_start_at);
  const end = new Date(data.reservation_end_at);

  // Constraint 1: End Time > Start Time
  if (end <= start) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "reservation_end_at must be strictly greater than reservation_start_at",
      path: ["reservation_end_at"]
    });
  }

  // Constraint 2: Cap at Midnight (24:00 local time)
  if (end.getHours() === 0 && end.getMinutes() > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Reservation usage cannot exceed restaurant operating hours",
      path: ["reservation_end_at"]
    });
  }
});

export const validateReservationPayload = (req, res, next) => {
  try {
    req.body = reservationTimelineSchema.parse(req.body);
    next();
  } catch (error) {
    // Defense in Depth: Distinguish between Zod validation errors and internal system crashes
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: "Payload validation failed",
        errors: error.errors.map(e => ({ path: e.path, message: e.message })) // Sanitized
      });
    }
    
    // Fallback for non-Zod errors to prevent stack trace leakage
    return res.status(500).json({
      success: false,
      message: "Internal server validation error"
    });
  }
};
