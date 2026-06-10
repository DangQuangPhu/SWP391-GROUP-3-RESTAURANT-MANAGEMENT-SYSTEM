import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "@/styles/reservation.css";
import ReservationHero from "@/components/reservation/ReservationHero";
import ReservationFormPanel from "@/components/reservation/ReservationFormPanel";
import FloorPlan from "@/components/reservation/FloorPlan";
import ReservationSummary from "@/components/reservation/ReservationSummary";
import ReservationConfirmation from "@/components/reservation/ReservationConfirmation";
import {
  AREA_PREFERENCES,
  DINING_PURPOSES,
  buildTimeSlots,
} from "@/data/floorPlanConfig";
import {
  getReservationSettings,
  getAvailability,
  createReservation,
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
  durationMinutes: 120,
  diningPurpose: "casual",
  areaPref: "any",
  fullName: "",
  email: "",
  phone: "",
  specialRequest: "",
  eventTitle: "",
  cakeRequest: "",
  decoration: "",
  equipment: "",
};

function ReservationPage({ isAuthenticated = false, currentUser = null, onNavigate }) {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [tables, setTables] = useState([]);
  const [selectedTableIds, setSelectedTableIds] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successReservation, setSuccessReservation] = useState(null);

  const bookingRef = useRef(null);

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
    return buildTimeSlots(settings.open_time, settings.close_time, form.durationMinutes);
  }, [settings, form.durationMinutes]);

  const areaType = useMemo(() => {
    const pref = AREA_PREFERENCES.find((a) => a.id === form.areaPref);
    return pref?.areaType || null;
  }, [form.areaPref]);

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
        durationMinutes: form.durationMinutes,
        guestCount: form.guestCount,
        areaType,
        eventType: form.diningPurpose,
      })
        .then((res) => {
          if (!active) return;
          const nextTables = res?.tables || [];
          setTables(nextTables);
          // Drop any selected table that is no longer bookable.
          setSelectedTableIds((prev) =>
            prev.filter((id) => {
              const t = nextTables.find((x) => x.table_id === id);
              return t && t.is_bookable && !t.is_too_small;
            })
          );
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
  }, [form.date, form.time, form.durationMinutes, form.guestCount, areaType, form.diningPurpose]);

  const selectedTables = useMemo(
    () => tables.filter((t) => selectedTableIds.includes(t.table_id)),
    [tables, selectedTableIds]
  );

  const handleSelectTable = useCallback((tableId) => {
    setError("");
    setSelectedTableIds((prev) =>
      prev.includes(tableId) ? prev.filter((id) => id !== tableId) : [...prev, tableId]
    );
  }, []);

  const totalCapacity = useMemo(
    () => selectedTables.reduce((sum, t) => sum + Number(t.capacity), 0),
    [selectedTables]
  );

  const canSubmit = useMemo(() => {
    if (!form.date || !form.time) return false;
    if (!form.guestCount || form.guestCount < 1) return false;
    if (selectedTableIds.length === 0) return false;
    if (totalCapacity < form.guestCount) return false;
    if (!form.fullName.trim()) return false;
    if (!EMAIL_RE.test(form.email.trim())) return false;
    if (!PHONE_RE.test(form.phone.trim())) return false;
    return true;
  }, [form, selectedTableIds, totalCapacity]);

  const scrollToBooking = () => {
    bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const buildSpecialRequest = () => {
    const purpose = DINING_PURPOSES.find((p) => p.id === form.diningPurpose);
    const parts = [`[Dining Purpose: ${purpose?.label || "Casual Dinner"}]`];
    if (purpose?.event) {
      if (form.eventTitle.trim()) parts.push(`[Event Title: ${form.eventTitle.trim()}]`);
      if (form.cakeRequest.trim()) parts.push(`[Cake Request: ${form.cakeRequest.trim()}]`);
      if (form.decoration.trim()) parts.push(`[Decoration: ${form.decoration.trim()}]`);
      if (form.equipment.trim()) parts.push(`[Equipment: ${form.equipment.trim()}]`);
    }
    if (!isAuthenticated) {
      parts.push(`[Guest Name: ${form.fullName.trim()}]`);
      parts.push(`[Guest Email: ${form.email.trim()}]`);
      parts.push(`[Guest Phone: ${form.phone.trim()}]`);
    }
    if (form.specialRequest.trim()) parts.push(form.specialRequest.trim());
    return parts.join("\n").slice(0, 1000);
  };

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setError("");
    setSubmitting(true);

    const preferredAreaId = selectedTables[0]?.area_id || null;
    const payload = {
      date: form.date,
      time: form.time,
      durationMinutes: form.durationMinutes,
      guest_count: form.guestCount,
      preferred_area_id: preferredAreaId,
      table_ids: selectedTableIds,
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
        setSuccessReservation(res.reservation);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError("Could not create reservation. Please try again.");
      }
    } catch (err) {
      // Conflict -> refresh availability so the booked table updates immediately.
      if (err?.code === "TABLE_UNAVAILABLE") {
        setError(err.message);
        setSelectedTableIds([]);
        getAvailability({
          date: form.date,
          time: form.time,
          durationMinutes: form.durationMinutes,
          guestCount: form.guestCount,
          areaType,
        })
          .then((r) => {
            setTables(r?.tables || []);
          })
          .catch(() => {});
      } else {
        setError(err?.message || "Could not create reservation. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForAnother = () => {
    setSuccessReservation(null);
    setSelectedTableIds([]);
    setTables([]);
    setForm((prev) => ({ ...INITIAL_FORM, fullName: prev.fullName, email: prev.email, phone: prev.phone }));
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  if (successReservation) {
    return (
      <main className="rzv-page">
        <ReservationConfirmation
          reservation={successReservation}
          onBackHome={() => onNavigate?.("home")}
          onBookAnother={resetForAnother}
          onViewReservations={
            isAuthenticated ? () => onNavigate?.("myReservations") : null
          }
        />
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
            Pick your date and party size, then select a table on our interactive floor plan.
            Availability updates live.
          </p>
        </div>

        <div className="rzv-grid">
          <div className="rzv-col">
            <ReservationFormPanel
              form={form}
              setField={setField}
              settings={settings}
              timeSlots={timeSlots}
              isAuthenticated={isAuthenticated}
              todayStr={todayString()}
            />
          </div>

          <div className="rzv-col">
            <FloorPlan
              tables={tables}
              selectedTableIds={selectedTableIds}
              onSelectTable={handleSelectTable}
              loading={loadingAvailability}
            />
            <div className="rzv-summary-dock">
              <ReservationSummary
                form={form}
                selectedTables={selectedTables}
                error={error}
                submitting={submitting}
                canSubmit={canSubmit}
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

export default ReservationPage;
