import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/styles/reservation.css";
import ReservationHero from "@/components/reservation/ReservationHero";
import ReservationDetailsPanel from "@/components/reservation/ReservationDetailsPanel";
import TableBoard from "@/components/reservation/choose-table/TableBoard";
import ReservationSummary from "@/components/reservation/ReservationSummary";
import ReservationSuccessPanel from "@/components/reservation/ReservationSuccessPanel";
import PreorderModal from "@/components/reservation/PreorderModal";
import PromotionModal from "@/components/reservation/PromotionModal";
import {
  AREA_PREFERENCES,
  DINING_PURPOSES,
  buildTimeSlots,
} from "@/data/floorPlanConfig";
import {
  getReservationSettings,
  getAvailability,
  createReservation,
  savePreorder,
} from "@/services/reservationApi";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s().-]{7,}$/;

function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const INITIAL_FORM = {
  date: "",
  time: "",
  guestCount: 2,
  holdDurationMinutes: 30,
  diningPurpose: "casual",
  fullName: "",
  email: "",
  phone: "",
  specialRequest: "",
  eventTitle: "",
  cakeRequest: "",
  decoration: "",
  equipment: "",
};

const STEPS = [
  { id: "details", label: "Details" },
  { id: "tables", label: "Table" },
  { id: "success", label: "Confirmed" },
];

function ReservationPage({
  isAuthenticated = false,
  currentUser = null,
  onNavigate,
  onRequireAuth,
}) {
  const membershipTier = currentUser?.membershipTier || "Bronze";
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [tables, setTables] = useState([]);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successReservation, setSuccessReservation] = useState(null);

  // --- guided step machine ---
  const [step, setStep] = useState("details"); // details | tables | success
  const [detailsReviewing, setDetailsReviewing] = useState(false);
  const [exiting, setExiting] = useState(false);

  // --- soft add-ons (presentation only) ---
  const [preorderItems, setPreorderItems] = useState([]);
  const [promotion, setPromotion] = useState(null);
  const [preorderOpen, setPreorderOpen] = useState(false);
  const [promotionOpen, setPromotionOpen] = useState(false);

  const bookingRef = useRef(null);
  const tablesRef = useRef(null);

  const setField = useCallback((name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  /* Load settings once. */
  useEffect(() => {
    let active = true;
    getReservationSettings()
      .then((res) => {
        if (active && res?.settings) setSettings(res.settings);
      })
      .catch(() => {
        if (active) {
          setSettings({
            open_time: "10:00",
            close_time: "22:00",
            max_guests: 12,
            cancel_deadline_h: 2,
          });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  /* Auto-fill contact details from profile for logged-in users. */
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      setForm((prev) => ({
        ...prev,
        fullName: prev.fullName || currentUser.fullName || "",
        email: prev.email || currentUser.email || "",
        phone: prev.phone || currentUser.phone || currentUser.phoneNumber || "",
      }));
    }
  }, [isAuthenticated, currentUser]);

  const timeSlots = useMemo(() => {
    if (!settings) return [];
    let slots = buildTimeSlots(settings.open_time, settings.close_time, 120);
    if (form.date === todayString()) {
      const now = new Date();
      slots = slots.filter((slot) => {
        const [y, m, d] = form.date.split("-").map(Number);
        const [hh, mm] = slot.value.split(":").map(Number);
        const slotTime = new Date(y, m - 1, d, hh, mm);
        return slotTime > now;
      });
    }
    return slots;
  }, [settings, form.date]);

  /* Fetch availability whenever the key selection changes (debounced). */
  useEffect(() => {
    if (!form.date || !form.time) {
      setTables([]);
      return undefined;
    }

    let active = true;
    setLoadingAvailability(true);
    const handle = setTimeout(() => {
      getAvailability({
        date: form.date,
        time: form.time,
        durationMinutes: 120,
        guestCount: form.guestCount,
        areaType: null,
        eventType: form.diningPurpose,
      })
        .then((res) => {
          if (!active) return;
          const nextTables = res?.tables || [];
          setTables(nextTables);
          setSelectedTableId((prev) => {
            if (!prev) return null;
            const t = nextTables.find((x) => x.table_id === prev);
            return (t && t.is_bookable && !t.is_too_small) ? prev : null;
          });
        })
        .catch((err) => {
          if (active) setError(err?.message || "Could not load availability.");
        })
        .finally(() => {
          if (active) setLoadingAvailability(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [form.date, form.time, form.guestCount, form.diningPurpose]);

  const selectedTables = useMemo(
    () => tables.filter((t) => t.table_id === selectedTableId),
    [tables, selectedTableId]
  );

  const handleSelectTable = useCallback((tableId) => {
    setError("");
    setSelectedTableId(tableId);
  }, []);

  const totalCapacity = useMemo(
    () => selectedTables.reduce((sum, t) => sum + Number(t.capacity), 0),
    [selectedTables]
  );

  /* --- validation --- */
  const missing = useMemo(() => {
    const out = [];
    if (!form.date) out.push("date");
    if (!form.time) out.push("time");
    if (!form.guestCount || form.guestCount < 1) out.push("guests");
    if (!form.fullName.trim()) out.push("full name");
    if (!EMAIL_RE.test(form.email.trim())) out.push("a valid email");
    if (!PHONE_RE.test(form.phone.trim())) out.push("a valid phone");
    return out;
  }, [form]);

  const detailsValid = missing.length === 0;

  const canSubmit = useMemo(() => {
    if (!detailsValid) return false;
    if (!selectedTableId) return false;
    if (totalCapacity < form.guestCount) return false;
    return true;
  }, [detailsValid, selectedTableId, totalCapacity, form.guestCount]);

  const summaryVisible = step === "tables" && selectedTableId !== null;

  const scrollToBooking = () => {
    bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /* --- step transitions --- */
  const transitionTo = useCallback((next, mid) => {
    setExiting(true);
    setTimeout(() => {
      mid?.();
      setStep(next);
      setExiting(false);
      requestAnimationFrame(() => {
        bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }, 360);
  }, []);

  const handleDone = () => setDetailsReviewing(true);
  const handleCancelReview = () => setDetailsReviewing(false);
  const handleConfirmDetails = () => {
    if (form.date === todayString() && form.time) {
      const now = new Date();
      const [y, m, d] = form.date.split("-").map(Number);
      const [hh, mm] = form.time.split(":").map(Number);
      const slotTime = new Date(y, m - 1, d, hh, mm);
      if (slotTime <= now) {
        alert("The selected time has already passed. Please choose another time.");
        return;
      }
    }
    transitionTo("tables");
  };
  const handleEditDetails = () => transitionTo("details", () => setDetailsReviewing(false));

  /* --- promotion --- */
  const handleOpenPromotion = () => setPromotionOpen(true);
  const handleApplyPromotion = (promo) => setPromotion(promo);
  const handleClearPromotion = () => setPromotion(null);
  const handleSignUp = () => {
    setPromotionOpen(false);
    onRequireAuth?.();
  };

  /* --- preorder --- */
  const handleApplyPreorder = (items) => setPreorderItems(items);

  const buildSpecialRequest = () => {
    const purpose = DINING_PURPOSES.find((p) => p.id === form.diningPurpose);
    const parts = [`[Dining Purpose: ${purpose?.label || "Casual Dinner"}]`];
    if (purpose?.event) {
      if (form.eventTitle.trim()) parts.push(`[Event Title: ${form.eventTitle.trim()}]`);
      if (form.cakeRequest.trim()) parts.push(`[Cake Request: ${form.cakeRequest.trim()}]`);
      if (form.decoration.trim()) parts.push(`[Decoration: ${form.decoration.trim()}]`);
      if (form.equipment.trim()) parts.push(`[Equipment: ${form.equipment.trim()}]`);
    }
    if (promotion) parts.push(`[Promotion: ${promotion.label}]`);
    if (!isAuthenticated) {
      parts.push(`[Guest Name: ${form.fullName.trim()}]`);
      parts.push(`[Guest Email: ${form.email.trim()}]`);
      parts.push(`[Guest Phone: ${form.phone.trim()}]`);
    }
    if (form.specialRequest.trim()) parts.push(form.specialRequest.trim());
    parts.push(`[Hold: ${form.holdDurationMinutes}m]`);
    return parts.join("\n").slice(0, 1000);
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    if (!selectedTableId) {
      setError("Please select a table before continuing.");
      return;
    }
    setError("");
    setSubmitting(true);

    const preferredAreaId = selectedTables[0]?.area_id || null;
    const payload = {
      date: form.date,
      time: form.time,
      durationMinutes: 120, // default dining block
      holdDurationMinutes: form.holdDurationMinutes,
      guest_count: form.guestCount,
      preferred_area_id: preferredAreaId,
      selectedTableId: selectedTableId,
      table_ids: selectedTableId ? [selectedTableId] : [],
      dining_purpose: DINING_PURPOSES.find((p) => p.id === form.diningPurpose)?.label,
      contact_name: form.fullName.trim(),
      contact_email: form.email.trim(),
      contact_phone: form.phone.trim(),
      special_request: buildSpecialRequest(),
    };

    try {
      const userId = isAuthenticated ? currentUser?.userId ?? currentUser?.id : null;
      const res = await createReservation(payload, userId);
      if (res?.reservation) {
        // Persist pre-order for signed-in members (guests keep a local preview only).
        if (userId && preorderItems.length > 0) {
          try {
            await savePreorder(
              res.reservation.reservation_id,
              preorderItems.map((i) => ({ dish_id: i.dish_id, quantity: i.quantity })),
              userId
            );
          } catch {
            /* non-blocking — reservation already created */
          }
        }
        setSuccessReservation(res.reservation);
        setStep("success");
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError("Could not create reservation. Please try again.");
      }
    } catch (err) {
      if (err?.code === "TABLE_UNAVAILABLE") {
        setError(err.message);
        setSelectedTableId(null);
        getAvailability({
          date: form.date,
          time: form.time,
          durationMinutes: 120,
          guestCount: form.guestCount,
          areaType: null,
        })
          .then((r) => setTables(r?.tables || []))
          .catch(() => { });
      } else {
        setError(err?.message || "Could not create reservation. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const activeStepIndex = STEPS.findIndex((s) => s.id === step);

  /* ---------- SUCCESS ---------- */
  if (step === "success" && successReservation) {
    return (
      <main className="rzv-page">
        <section className="rzv-booking rzv-booking--success">
          <div className="rzv-step rzv-step--enter">
            <ReservationSuccessPanel
              reservation={successReservation}
              promotion={promotion}
              preorderItems={preorderItems}
              onReturnHome={() => onNavigate?.("home")}
              onViewReservation={() => onNavigate?.("myReservations")}
            />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="rzv-page">
      <ReservationHero onReserveClick={scrollToBooking} />

      <section className="rzv-booking" ref={bookingRef} id="rzv-book">
        <div className="rzv-booking__head">
          <span className="rzv-booking__kicker">Reserve a Table</span>
          <h2 className="rzv-booking__title rzv-serif">Choose your moment</h2>
          <p className="rzv-booking__lead">
            Complete your details, choose your table on our interactive floor plan, then review and
            confirm. Availability updates live.
          </p>

          {/* Step progress */}
          <ol className="rzv-steps" aria-label="Reservation progress">
            {STEPS.map((s, i) => (
              <li
                key={s.id}
                className={`rzv-steps__item ${i === activeStepIndex
                    ? "rzv-steps__item--active"
                    : i < activeStepIndex
                      ? "rzv-steps__item--done"
                      : ""
                  }`}
              >
                <span className="rzv-steps__dot">{i < activeStepIndex ? "✓" : i + 1}</span>
                <span className="rzv-steps__label">{s.label}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* STEP 1 — Reservation Details */}
        {step === "details" ? (
          <div className={`rzv-step rzv-step--narrow ${exiting ? "rzv-step--exit" : "rzv-step--enter"}`}>
            <ReservationDetailsPanel
              form={form}
              setField={setField}
              settings={settings}
              timeSlots={timeSlots}
              isAuthenticated={isAuthenticated}
              todayStr={todayString()}
              detailsValid={detailsValid}
              reviewing={detailsReviewing}
              missing={missing}
              onDone={handleDone}
              onConfirm={handleConfirmDetails}
              onCancel={handleCancelReview}
            />
          </div>
        ) : null}

        {/* STEP 2 + 3 — Choose Table + Summary */}
        {step === "tables" ? (
          <div
            ref={tablesRef}
            className={`rzv-step ${exiting ? "rzv-step--exit" : "rzv-step--enter"}`}
          >
            <div className="rzv-tablestep">
              <div className="rzv-tablestep__bar">
                <button type="button" className="rzv-backlink" onClick={handleEditDetails}>
                  ← Back to details
                </button>
                <span className="rzv-tablestep__recap">
                  {form.guestCount} guests ·{" "}
                  {form.date ? new Date(`${form.date}T00:00:00`).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                  }) : "—"}{" "}
                  · {form.time || "—"}
                </span>
              </div>

              <TableBoard
                tables={tables}
                selectedTableId={selectedTableId}
                onSelectTable={handleSelectTable}
                loading={loadingAvailability}
                guestCount={form.guestCount}
                membershipTier={membershipTier}
                isAuthenticated={isAuthenticated}
                onNavigateLogin={() => onNavigate("login")}
                onNavigateRegister={onRequireAuth}
              />

              {summaryVisible ? (
                <div className="rzv-reveal">
                  <ReservationSummary
                    form={form}
                    selectedTables={selectedTables}
                    promotion={promotion}
                    preorderItems={preorderItems}
                    error={error}
                    submitting={submitting}
                    canSubmit={canSubmit}
                    onSubmit={handleSubmit}
                    onEditDetails={handleEditDetails}
                    onOpenPreorder={() => setPreorderOpen(true)}
                    onOpenPromotion={handleOpenPromotion}
                    onClearPromotion={handleClearPromotion}
                  />
                </div>
              ) : (
                <p className="rzv-tablestep__prompt">
                  Select an available table on the plan to review and confirm your reservation.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </section>

      {/* Overlays */}
      <PreorderModal
        open={preorderOpen}
        initialItems={preorderItems}
        onClose={() => setPreorderOpen(false)}
        onApply={handleApplyPreorder}
      />
      <PromotionModal
        open={promotionOpen}
        isAuthenticated={isAuthenticated}
        current={promotion}
        onClose={() => setPromotionOpen(false)}
        onApply={handleApplyPromotion}
        onSignUp={handleSignUp}
      />
    </main>
  );
}

export default ReservationPage;
