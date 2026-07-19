import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { toast } from "react-toastify";
import reservationImg from "@/assets/images/reservation/Reservation.jpg";
import "../styles/reservation.css";
import ReservationSummary from "../components/ReservationSummary.jsx";
import ReservationSuccessPanel from "../components/ReservationSuccessPanel.jsx";
import ReservationPaymentPanel from "../components/ReservationPaymentPanel.jsx";
import ReservationDetails from "../components/ReservationDetails.jsx";
import {
  DINING_PURPOSES,
} from "../data/floorPlanConfig.js";
import {
  getReservationSettings,
  getAvailability,
} from "../services/reservationApi.js";
import { createPreSaveReservation } from "../services/reservationPreSaveApi.js";
import { useSocket } from "@/core/socket/SocketContext.jsx";

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
}) {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  const pageVariants = useMemo(() => ({
    initial: {
      opacity: 0,
      scale: shouldReduceMotion ? 1 : 0.97,
      y: shouldReduceMotion ? 0 : 8
    },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 150,
        damping: 22,
        mass: 0.8
      }
    },
    exit: {
      opacity: 0,
      scale: shouldReduceMotion ? 1 : 0.97,
      y: shouldReduceMotion ? 0 : -8,
      transition: {
        duration: 0.2,
        ease: "easeInOut"
      }
    }
  }), [shouldReduceMotion]);

  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(() => {
    try {
      const stored = localStorage.getItem("phurai_reservation_form");
      return stored ? JSON.parse(stored) : INITIAL_FORM;
    } catch {
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
  const submittingRef = useRef(false);
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
      } catch {
        // Ignored
      }
    }
    return null;
  });

  const [preorderItems, setPreorderItems] = useState(() => {
    try {
      const stored = localStorage.getItem("phurai_reservation_preorder_items");
      return stored ? JSON.parse(stored) : {};
    } catch {
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
    } catch {
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
  const [isPaymentSuccess, setIsPaymentSuccess] = useState(false);
  // Controls the 3-phase Apple-style exit sequence (details → summary)
  const [isExitingDetails, setIsExitingDetails] = useState(false);
  // Controls the summary background overlay fade-in (Phase 3)
  const [showSummaryBg, setShowSummaryBg] = useState(step !== 'details' && step !== 'payment' && step !== 'success');
  const isTransitioningToSummaryRef = useRef(false);

  const containerVariants = useMemo(() => ({
    initial: {},
    animate: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
      }
    }
  }), [shouldReduceMotion]);

  const headerItemVariants = useMemo(() => ({
    initial: { 
      opacity: 0, 
      y: shouldReduceMotion ? 0 : 20 
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 140,
        damping: 20
      }
    }
  }), [shouldReduceMotion]);

  useEffect(() => {
    if (isTransitioningToSummaryRef.current) {
      if (urlStep === "summary" && step === "summary") {
        isTransitioningToSummaryRef.current = false;
      }
      return;
    }
    if (urlStep && urlStep !== step) {
      setStep(urlStep);
    } else if (!urlStep) {
      navigate('/reservations/details', { replace: true });
    }
  }, [urlStep, step, navigate]);

  // Enforce payment or cancel for pending reservations:
  // - If on payment/success without memory state, try to restore from localStorage.
  // - If on details/summary but a valid pending reservation exists, force-redirect to payment.
  useEffect(() => {
    const stored = localStorage.getItem("phurai_pending_reservation");
    let activePending = null;

    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const elapsed = Math.floor((Date.now() - parsed.createdAt) / 1000);
        if (elapsed < 15 * 60) {
          activePending = parsed;
        } else {
          localStorage.removeItem("phurai_pending_reservation");
        }
      } catch (err) {
        console.error("Error parsing pending reservation:", err);
      }
    }

    if (activePending) {
      // Force redirect to payment if they try to go back to details/summary
      if (step !== "payment" && step !== "success") {
        setTimeout(() => {
          setSuccessReservation(activePending);
          navigate('/reservations/payment', { replace: true });
        }, 0);
      } else if (!successReservation) {
        setTimeout(() => {
          setSuccessReservation(activePending);
        }, 0);
      }
    } else {
      // No active reservation: if they try to access payment, kick them back to details.
      // If they try to access success, kick them back to details ONLY if payment was NOT successful.
      if (step === "payment" || (step === "success" && !isPaymentSuccess)) {
        setTimeout(() => {
          navigate('/reservations/details', { replace: true });
        }, 0);
      }
    }
  }, [step, successReservation, navigate, isPaymentSuccess]);

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
    setError("");
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

  const transitionTo = useCallback((nextStep) => {
    setStep(nextStep);
    navigate(`/reservations/${nextStep}`);
  }, [navigate]);

  // Orchestrated 3-phase Apple transition: details → summary
  // Phase 1: fade out form card + bg image (350ms)
  // Phase 2: layout animation moves header to center (600ms)
  // Phase 3: summary fades in automatically via pageVariants
  const transitionToSummary = useCallback((localForm) => {
    // Guard: prevent URL-sync useEffect from racing with our timed navigation.
    isTransitioningToSummaryRef.current = true;

    // Batch all form field updates into a single setState to avoid cascading
    // re-renders that could mis-fire the URL-sync effect between updates.
    setForm((prev) => ({
      ...prev,
      date: localForm.date,
      time: localForm.startTime,
      endTime: localForm.endTime,
      guestCount: localForm.guests,
      holdDurationMinutes: parseInt(localForm.duration) || 30,
      diningPurpose: localForm.diningPurpose,
      diningPurposeNote: localForm.diningPurposeNote,
      selectedArea: localForm.diningArea,
      fullName: localForm.fullName,
      email: localForm.email,
      phone: localForm.phone,
    }));

    // Phase 1: trigger fade-out of form card + bg image simultaneously
    setIsExitingDetails(true);

    // Phase 2: after fade-out completes, change step so layout animates header to center
    setTimeout(() => {
      setStep("summary");
      navigate("/reservations/summary");
      // Reset exit flag after step has changed
      setTimeout(() => setIsExitingDetails(false), 100);
      // Phase 3: after layout animation completes (~600ms), fade in summary bg
      setTimeout(() => setShowSummaryBg(true), 620);
    }, 350);
  }, [navigate]);

  /* Fetch availability whenever the key selection changes (debounced). */
  useEffect(() => {
    if (!form.date || !form.time) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTables([]);
      setSelectedTableId(null);
      return undefined;
    }

    let active = true;
    setLoadingAvailability(true);
    const handle = setTimeout(() => {
      let calcDuration = 90 + (Number(form.holdDurationMinutes) || 30);
      if (form.time && form.endTime) {
        const [sh, sm] = form.time.split(':').map(Number);
        const [eh, em] = form.endTime.split(':').map(Number);
        let endMins = (eh === 0 && em === 0) ? 1440 : (eh * 60 + em);
        if (eh === 0 && em > 0) endMins = 1440 + em;
        if (endMins > sh * 60 + sm) {
          calcDuration = endMins - (sh * 60 + sm);
        }
      }

      getAvailability({
        date: form.date,
        time: form.time,
        durationMinutes: calcDuration,
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
            const t = nextTables.find((x) => String(x.table_id) === String(prev));
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
  }, [form.date, form.time, form.endTime, form.holdDurationMinutes, form.guestCount, form.diningPurpose, settings]);

  const selectedTables = useMemo(() => {
    if (!selectedTableId) return [];
    return tables.filter((t) => String(t.table_id) === String(selectedTableId) || String(t.merged_into_table_id) === String(selectedTableId));
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
    setShowSummaryBg(false);
    transitionTo("details");
  }, [transitionTo]);

  const handleSubmit = async () => {
    if (!canSubmit || submittingRef.current) return;
    submittingRef.current = true;
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
        special_request: form.diningPurposeNote && form.diningPurposeNote.trim() ? form.diningPurposeNote.trim() : null,
        dining_purpose: form.diningPurpose,
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
        const enrichedRes = { 
          ...res, 
          createdAt: Date.now(),
          preorderItems: Object.values(preorderItems)
        };
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
      submittingRef.current = false;
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
    <div className="rd-page">
      {/* Summary background overlay — fades in after header reaches center */}
      <div className={`rd-summary-bg-overlay ${showSummaryBg ? 'rd-summary-bg-overlay--visible' : ''}`} />
      <button className="rd-home-btn" onClick={() => navigate("/")} aria-label="Go to Home">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
          <polyline points="9 22 9 12 15 12 15 22"></polyline>
        </svg>
      </button>

      <AnimatePresence mode="wait">
        {step === "details" ? (
          <motion.div
            key="details-layout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="rd-split"
          >
            <div className="rd-image-col">
              <img src={reservationImg} alt="" className="rd-image" />
            </div>

            <motion.div
              className="rd-content-col"
              variants={containerVariants}
              initial="initial"
              animate="animate"
            >
              <motion.p variants={headerItemVariants} className="rd-eyebrow">RESERVE A TABLE</motion.p>
              <motion.h1 variants={headerItemVariants} className="rd-title">CHOOSE YOUR MOMENT</motion.h1>
              
              <motion.p variants={headerItemVariants} className="rd-subtitle">
                Complete your details, choose your table on our interactive floor plan,
                then review and confirm. Availability updates live.
              </motion.p>

              <motion.div variants={headerItemVariants} className="rd-stepper">
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

              <motion.div
                variants={pageVariants}
                initial="initial"
                animate={isExitingDetails ? { opacity: 0, transition: { duration: 0.35, ease: [0.4, 0, 1, 1] } } : "animate"}
                exit="exit"
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
                  isAuthenticated={isAuthenticated}
                  error={error}
                  onUpdateForm={handleUpdateForm}
                  onGoHome={() => navigate("/")}
                  onContinue={(localForm) => {
                    transitionToSummary(localForm);
                  }}
                />
              </motion.div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="centered-layout"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="rd-split rd-split--centered"
          >
            <motion.div
              className={`rd-content-col ${(step === 'payment' || step === 'summary') ? 'rd-content-col--wide' : 'rd-content-col--centered'}`}
              variants={containerVariants}
              initial="initial"
              animate="animate"
            >
              <motion.p variants={headerItemVariants} className="rd-eyebrow">RESERVE A TABLE</motion.p>
              <motion.h1 variants={headerItemVariants} className="rd-title">CHOOSE YOUR MOMENT</motion.h1>

              <motion.div variants={headerItemVariants} className="rd-stepper">
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

              <AnimatePresence mode="wait">
                {step === "summary" && (
                  <motion.div
                    key="summary"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="rzv-step w-full"
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
                          currentUser={currentUser}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === "payment" && successReservation && (
                  <motion.div
                    key="payment"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="rzv-step w-full"
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
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className="rzv-step w-full"
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ReservationPage;
