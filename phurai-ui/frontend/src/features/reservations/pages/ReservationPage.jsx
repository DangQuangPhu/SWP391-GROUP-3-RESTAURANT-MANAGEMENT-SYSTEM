import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import reservationImg from "@/assets/images/reservation/Reservation.jpg";
import "../styles/reservation.css";
import ReservationHero from "../components/ReservationHero.jsx";
import ReservationSummary from "../components/ReservationSummary.jsx";
import ReservationSuccessPanel from "../components/ReservationSuccessPanel.jsx";
import ReservationPaymentPanel from "../components/ReservationPaymentPanel.jsx";
import ReservationDetails from "../components/ReservationDetails.jsx";
import {
  DINING_PURPOSES,
  buildTimeSlots,
  KITCHEN_VIEW_AREA_NAME,
} from "../data/floorPlanConfig.js";
import {
  getReservationSettings,
  getAvailability,
} from "../services/reservationApi.js";
import { createPreSaveReservation } from "../services/reservationPreSaveApi.js";
import { useSocket } from "@/core/socket/SocketContext.jsx";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s().-]{7,}$/;

function todayString() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const INITIAL_FORM = {
  date: todayString(),
  time: "",
  endTime: "",
  guestCount: "",
  holdDurationMinutes: 30,
  diningPurpose: "casual",
  selectedArea: "",
  preferredAreaId: null,
  fullName: "",
  email: "",
  phone: "",
  notes: "",
  diningPurposeNote: "",
};

const STEPS = [
  { id: "details", label: "Details" },
  { id: "summary", label: "Summary" },
  { id: "payment", label: "Payment" },
  { id: "success", label: "Confirmed" },
];


function ReservationPage({
  isAuthenticated = false,
  currentUser = null,
  onNavigate,
  onRequireAuth,
}) {
  const navigate = useNavigate();
  const membershipTier = currentUser?.membershipTier || "Bronze";

  const pageVariants = useMemo(() => ({
    initial: (direction) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0,
      position: "absolute",
      width: "100%",
    }),
    animate: {
      x: 0,
      opacity: 1,
      position: "relative",
    },
    exit: (direction) => ({
      x: direction < 0 ? 50 : -50,
      opacity: 0,
      position: "absolute",
      width: "100%",
    })
  }), []);

  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(() => {
    try {
      const stored = localStorage.getItem("phurai_reservation_form");
      return stored ? JSON.parse(stored) : INITIAL_FORM;
    } catch (e) {
      return INITIAL_FORM;
    }
  });
  const [tables, setTables] = useState([]);
  
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;
    
    const handleTableStatusChanged = (data) => {
      const { table_id, table_status } = data;
      setTables(prevTables => prevTables.map(t => 
        t.table_id === table_id ? { ...t, table_status, availability_at_slot: table_status } : t
      ));
    };

    socket.on("table:status_changed", handleTableStatusChanged);
    return () => {
      socket.off("table:status_changed", handleTableStatusChanged);
    };
  }, [socket]);
  const [selectedTableId, setSelectedTableId] = useState(() => {
    return localStorage.getItem("phurai_reservation_table") || null;
  });
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successReservation, setSuccessReservation] = useState(() => {
    const stored = localStorage.getItem("phurai_pending_reservation");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const elapsed = Math.floor((Date.now() - parsed.createdAt) / 1000);
        if (elapsed < 15 * 60) {
          return parsed;
        } else {
          localStorage.removeItem("phurai_pending_reservation");
        }
      } catch (e) {
        console.error("Failed to parse stored reservation", e);
      }
    }
    return null;
  });

  const [preorderItems, setPreorderItems] = useState(() => {
    try {
      const stored = localStorage.getItem("phurai_reservation_preorder_items");
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  });
  const [preorderTotal, setPreorderTotal] = useState(() => {
    const stored = localStorage.getItem("phurai_reservation_preorder_total");
    return stored ? Number(stored) : 0;
  });
  const [promoCode, setPromoCode] = useState(() => localStorage.getItem("phurai_applied_promo") || "");
  const [promoDiscount, setPromoDiscount] = useState(() => {
    try {
      const stored = localStorage.getItem("phurai_applied_promo_discount");
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    if (promoCode) {
      localStorage.setItem("phurai_applied_promo", promoCode);
    } else {
      localStorage.removeItem("phurai_applied_promo");
    }
  }, [promoCode]);

  useEffect(() => {
    if (promoDiscount) {
      localStorage.setItem("phurai_applied_promo_discount", JSON.stringify(promoDiscount));
    } else {
      localStorage.removeItem("phurai_applied_promo_discount");
    }
  }, [promoDiscount]);

  useEffect(() => {
    localStorage.setItem("phurai_reservation_form", JSON.stringify(form));
  }, [form]);

  useEffect(() => {
    if (selectedTableId) {
      localStorage.setItem("phurai_reservation_table", selectedTableId);
    } else {
      localStorage.removeItem("phurai_reservation_table");
    }
  }, [selectedTableId]);

  useEffect(() => {
    localStorage.setItem("phurai_reservation_preorder_items", JSON.stringify(preorderItems));
  }, [preorderItems]);

  useEffect(() => {
    localStorage.setItem("phurai_reservation_preorder_total", preorderTotal.toString());
  }, [preorderTotal]);

  const { step: urlStep } = useParams();

  // --- guided step machine ---
  const [step, setStep] = useState(urlStep || "details"); // details | summary | payment | success
  const [prevStep, setPrevStep] = useState(urlStep || "details");
  const [detailsReviewing, setDetailsReviewing] = useState(false);
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);

  useEffect(() => {
    if (urlStep && urlStep !== step) {
      setPrevStep(step);
      setStep(urlStep);
    } else if (!urlStep && step !== "details") {
      navigate('/reservations/details', { replace: true });
    }
  }, [urlStep, step, navigate]);

  // Redirect to details if on payment or success step without a valid reservation
  useEffect(() => {
    const isPaymentOrSuccess = step === "payment" || step === "success";
    if (isPaymentOrSuccess && !successReservation) {
      const stored = localStorage.getItem("phurai_pending_reservation");
      if (!stored) {
        navigate('/reservations/details', { replace: true });
      } else {
        try {
          const parsed = JSON.parse(stored);
          const elapsed = Math.floor((Date.now() - parsed.createdAt) / 1000);
          if (elapsed >= 15 * 60) {
            navigate('/reservations/details', { replace: true });
          } else {
            // Restore the reservation state so the UI renders
            setSuccessReservation(parsed);
          }
        } catch {
          navigate('/reservations/details', { replace: true });
        }
      }
    }
  }, [step, successReservation, navigate]);

  const bookingRef = useRef(null);
  const tablesRef = useRef(null);

  const setField = useCallback((name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Stable callbacks for ReservationDetails — must be useCallback to prevent
  // re-render loops caused by the useEffect inside ReservationDetails that
  // depends on onSelectTable as a dependency.
  const handleSelectTable = useCallback((tableId) => {
    setSelectedTableId(tableId);
  }, []);

  const handleUpdateForm = useCallback((name, value) => {
    if (name === 'date') setField('date', value);
    else if (name === 'startTime') setField('time', value);
    else if (name === 'endTime') setField('endTime', value);
    else if (name === 'guests') setField('guestCount', value);
    else if (name === 'duration') setField('holdDurationMinutes', parseInt(value) || 30);
    else if (name === 'diningPurpose') setField('diningPurpose', value);
  }, [setField]);

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

  const getStepIndex = useCallback((s) => STEPS.findIndex(x => x.id === s), []);
  const activeStepIndex = getStepIndex(step);
  const direction = activeStepIndex > getStepIndex(prevStep) ? 1 : -1;

  const transitionTo = useCallback((nextStep) => {
    setPrevStep(step);
    setStep(nextStep);
    navigate(`/reservations/${nextStep}`);
  }, [step, navigate]);

  /* Fetch availability whenever the key selection changes (debounced). */
  useEffect(() => {
    if (!form.date || !form.time) {
      setTables([]);
      setSelectedTableId(null);
      return undefined;
    }

    let active = true;
    setLoadingAvailability(true);
    const handle = setTimeout(() => {
      getAvailability({
        date: form.date,
        time: form.time,
        durationMinutes: 90 + (Number(form.holdDurationMinutes) || 30),
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
  }, [form.date, form.time, form.holdDurationMinutes, form.guestCount, form.diningPurpose, settings]);

  const selectedTables = useMemo(() => {
    if (!selectedTableId) return [];
    return tables.filter((t) => t.table_id === selectedTableId || t.merged_into_table_id === selectedTableId);
  }, [tables, selectedTableId]);

  const isKitchenView = useMemo(() => {
    if (!selectedTables.length) return false;
    const prefix = String(selectedTables[0].display_label || selectedTables[0].area_name || "").trim().toLowerCase();
    return prefix.includes("kitchen");
  }, [selectedTables]);

  const totalCapacity = useMemo(() => selectedTables.reduce((sum, t) => sum + Number(t.capacity), 0), [selectedTables]);

  const canSubmit = useMemo(() => {
    if (!form.date || !form.time || !form.guestCount || !form.fullName || !form.email || !form.phone || !selectedTableId) return false;
    if (totalCapacity < form.guestCount) return false;
    return true;
  }, [form, selectedTableId, totalCapacity]);

  const handleEditDetails = useCallback(() => {
    transitionTo("details");
  }, [transitionTo]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      // API payload construction matching backend contract
      const payload = {
        customer_id: currentUser?.id || null,
        guest_count: form.guestCount,
        reservation_start_at: `${form.date}T${form.time}:00`,
        durationMinutes: form.holdDurationMinutes || 30,
        reservation_end_at: form.endTime ? `${form.date}T${form.endTime}:00` : undefined,
        special_request: form.diningPurposeNote
          ? `[Dining Purpose: ${form.diningPurpose}] [Notes: ${form.diningPurposeNote}]`
          : `[Dining Purpose: ${form.diningPurpose}]`,
        table_ids: selectedTables.map((t) => t.table_id),
        contact_name: form.fullName,
        contact_phone: form.phone,
        contact_email: form.email,
        preorder_items: Object.values(preorderItems).map(item => ({
          dish_id: item.dish_id,
          quantity: item.quantity,
          customization_requests: item.note || ""
        })),
        promo_code: promoCode
      };

      const res = await createPreSaveReservation(payload);

      if (res?.success) {
        const enrichedRes = { ...res, createdAt: Date.now() };
        setSuccessReservation(enrichedRes);
        localStorage.setItem("phurai_pending_reservation", JSON.stringify(enrichedRes));
        transitionTo("payment");
      } else {
        throw new Error("Failed to create reservation");
      }
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || "An error occurred");
      toast.error(err.response?.data?.error || err.response?.data?.message || err.message || "Failed to submit reservation.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnHome = useCallback(() => {
    localStorage.removeItem("phurai_pending_reservation");
    navigate("/");
  }, [navigate]);

  const handleViewReservation = useCallback(() => {
    localStorage.removeItem("phurai_pending_reservation");
    navigate("/my-reservations");
  }, [navigate]);

  const handlePaymentSuccess = useCallback(() => {
    localStorage.removeItem("phurai_applied_promo");
    localStorage.removeItem("phurai_applied_promo_discount");
    localStorage.removeItem("phurai_reservation_form");
    localStorage.removeItem("phurai_reservation_table");
    localStorage.removeItem("phurai_reservation_preorder_items");
    localStorage.removeItem("phurai_reservation_preorder_total");
    setIsPaymentSuccess(true);
    transitionTo("success");
  }, [transitionTo]);

  return (
    <div className={`rd-page ${step === 'summary' ? 'rd-page--bg-summary' : ''}`}>
      <button className="rd-home-btn" onClick={() => navigate("/")} aria-label="Go to Home">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </button>

      <div className={`rd-split ${step !== 'details' ? 'rd-split--centered' : ''}`}>
        <AnimatePresence>
          {step === "details" && (
            <motion.div
              className="rd-image-col"
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <img src={reservationImg} alt="" className="rd-image" />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className={`rd-content-col ${step !== 'details' ? 'rd-content-col--centered' : ''}`}
          layout
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.p layout className="rd-eyebrow">RESERVE A TABLE</motion.p>
          <motion.h1 layout className="rd-title">CHOOSE YOUR MOMENT</motion.h1>
          {step === "details" && (
            <motion.p layout className="rd-subtitle">
              Complete your details, choose your table on our interactive floor plan,
              then review and confirm. Availability updates live.
            </motion.p>
          )}

          <motion.div layout className="rd-stepper">
            {STEPS.map((stepObj, i) => {
              const label = stepObj.label;
              const isActive = i <= activeStepIndex;
              return (
                <div className="rd-step" key={label}>
                  <div className={`rd-step-circle ${isActive ? 'rd-step-circle-active' : ''}`}>
                    {i + 1}
                  </div>
                  <span className={isActive ? 'rd-step-label-active' : 'rd-step-label'}>{label}</span>
                  {i < STEPS.length - 1 && <div className="rd-step-line" />}
                </div>
              );
            })}
          </motion.div>

          <AnimatePresence mode="wait" custom={direction}>
            {step === "details" && (
              <motion.div
                key="details"
                custom={direction}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <ReservationDetails
                  initialForm={{
                    date: form.date,
                    startTime: form.time,
                    diningArea: form.selectedArea || 'Standard dining (choose a table)',
                    selectedTable: selectedTableId,
                    guests: form.guestCount,
                    duration: form.holdDurationMinutes || 30,
                    endTime: form.endTime,
                    diningPurpose: DINING_PURPOSES.find(p => p.id === form.diningPurpose)?.label || 'Casual Dinner',
                    diningPurposeNote: form.diningPurposeNote,
                    fullName: form.fullName,
                    email: form.email,
                    phone: form.phone,
                  }}
                  tableHoldMin={Number(settings?.table_hold_min) || 15}
                  tables={tables}
                  selectedTableId={selectedTableId}
                  onSelectTable={handleSelectTable}
                  tablesLoading={loadingAvailability}
                  membershipTier={membershipTier}
                  isAuthenticated={isAuthenticated}
                  onUpdateForm={handleUpdateForm}
                  onGoHome={() => navigate("/")}
                  onContinue={(localForm) => {
                    setField("date", localForm.date);
                    setField("time", localForm.startTime);
                    setField("endTime", localForm.endTime);
                    setField("guestCount", localForm.guests);
                    setField("holdDurationMinutes", parseInt(localForm.duration) || 30);
                    setField("diningPurpose", localForm.diningPurpose);
                    setField("diningPurposeNote", localForm.diningPurposeNote);
                    setField("selectedArea", localForm.diningArea);
                    setField("fullName", localForm.fullName);
                    setField("email", localForm.email);
                    setField("phone", localForm.phone);
                    transitionTo("summary");
                  }}
                />
              </motion.div>
            )}

            {step === "summary" && (
              <motion.div
                key="summary"
                custom={direction}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="rzv-step rzv-step--enter"
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
                  <div className="rzv-reveal">
                    <ReservationSummary
                      form={form}
                      setField={setField}
                      selectedTables={selectedTables}
                      isKitchenView={isKitchenView}
                      error={error}
                      submitting={submitting}
                      canSubmit={canSubmit}
                      onSubmit={handleSubmit}
                      onEditDetails={handleEditDetails}
                      preorderItems={preorderItems}
                      setPreorderItems={setPreorderItems}
                      preorderTotal={preorderTotal}
                      setPreorderTotal={setPreorderTotal}
                      promoCode={promoCode}
                      setPromoCode={setPromoCode}
                      promoDiscount={promoDiscount}
                      setPromoDiscount={setPromoDiscount}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === "payment" && successReservation && (
              <motion.div
                key="payment"
                custom={direction}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="rzv-step rzv-step--enter"
              >
                <div className={`w-full transition-all duration-500 ease-in-out ${isPaymentSuccess ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}>
                  <ReservationPaymentPanel
                    reservation={successReservation}
                    amount={successReservation.deposit_amount}
                    orderCode={successReservation.order_code}
                    qrUrl={successReservation.vietqr_url}
                    onSuccess={handlePaymentSuccess}
                    onCancel={() => navigate("/")}
                  />
                </div>
              </motion.div>
            )}

            {step === "success" && successReservation && (
              <motion.div
                key="success"
                custom={direction}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="rzv-step rzv-step--enter w-full"
              >
                <ReservationSuccessPanel
                  reservation={successReservation}
                  onReturnHome={handleReturnHome}
                  onViewReservation={handleViewReservation}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

export default ReservationPage;
