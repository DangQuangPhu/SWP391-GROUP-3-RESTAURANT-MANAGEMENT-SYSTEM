import { useCallback, useEffect, useMemo, useState } from "react";
import "../styles/reservation.css";
import { formatVND } from "@/utils/formatCurrency";
import PreorderPanel from "../components/PreorderPanel.jsx";
import { getMyReservations, cancelReservation } from "../services/reservationApi.js";

const ACTIVE_STATUSES = ["Pending", "Confirmed"];
const PREORDER_STATUSES = ["Pending", "Confirmed"];

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusModifier(status) {
  const key = String(status || "").toLowerCase().replace(/\s+/g, "-");
  return `rzv-status-pill--${key}`;
}

function MyReservationsPage({
  isAuthenticated = false,
  currentUser = null,
  onNavigate,
  onNavigateLogin,
}) {
  const userId = currentUser?.userId ?? currentUser?.id ?? null;

  const [reservations, setReservations] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [error, setError] = useState("");
  const [openPreorderId, setOpenPreorderId] = useState(null);
  const [cancelingId, setCancelingId] = useState(null);

  const load = useCallback(() => {
    if (!isAuthenticated || !userId) return;
    setStatus("loading");
    setError("");
    getMyReservations(userId)
      .then((res) => {
        setReservations(res?.reservations || []);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err?.message || "Could not load your reservations.");
        setStatus("error");
      });
  }, [isAuthenticated, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const up = [];
    const old = [];
    for (const r of reservations) {
      const start = new Date(r.reservation_start_at).getTime();
      const isActive = ACTIVE_STATUSES.includes(r.reservation_status);
      if (isActive && (Number.isNaN(start) || start >= now)) up.push(r);
      else old.push(r);
    }
    return { upcoming: up, past: old };
  }, [reservations]);

  const handleCancel = async (reservation) => {
    if (cancelingId) return;
    const ok = window.confirm(
      `Cancel reservation #${reservation.reservation_id}? This cannot be undone.`
    );
    if (!ok) return;

    setCancelingId(reservation.reservation_id);
    setError("");
    try {
      await cancelReservation(reservation.reservation_id, userId, "Cancelled by guest");
      setReservations((prev) =>
        prev.map((r) =>
          r.reservation_id === reservation.reservation_id
            ? { ...r, reservation_status: "Cancelled" }
            : r
        )
      );
    } catch (err) {
      setError(err?.message || "Could not cancel this reservation.");
    } finally {
      setCancelingId(null);
    }
  };

  const handlePreorderSaved = (reservationId, preorders) => {
    setReservations((prev) =>
      prev.map((r) =>
        r.reservation_id === reservationId ? { ...r, preorders } : r
      )
    );
  };

  const renderCard = (r) => {
    const canCancel = ACTIVE_STATUSES.includes(r.reservation_status);
    const canPreorder = PREORDER_STATUSES.includes(r.reservation_status);
    const isPreorderOpen = openPreorderId === r.reservation_id;
    const preorderTotal = (r.preorders || []).reduce(
      (sum, p) => sum + Number(p.unit_price) * Number(p.quantity),
      0
    );

    return (
      <article className="rzv-res-card" key={r.reservation_id}>
        <header className="rzv-res-card__head">
          <div>
            <span className="rzv-res-card__id">Reservation #{r.reservation_id}</span>
            <h3 className="rzv-res-card__when rzv-serif">
              {formatDateTime(r.reservation_start_at)}
            </h3>
          </div>
          <span className={`rzv-status-pill ${statusModifier(r.reservation_status)}`}>
            {r.reservation_status}
          </span>
        </header>

        <div className="rzv-res-card__grid">
          <div className="rzv-res-card__cell">
            <span className="rzv-res-card__label">Guests</span>
            <span className="rzv-res-card__value">{r.guest_count}</span>
          </div>
          <div className="rzv-res-card__cell">
            <span className="rzv-res-card__label">Area</span>
            <span className="rzv-res-card__value">{r.area_name || "Any"}</span>
          </div>
          <div className="rzv-res-card__cell">
            <span className="rzv-res-card__label">Table(s)</span>
            <span className="rzv-res-card__value">
              {r.tables?.length
                ? r.tables.map((t) => `${t.display_label} (${t.capacity})`).join(", ")
                : "—"}
            </span>
          </div>
          <div className="rzv-res-card__cell">
            <span className="rzv-res-card__label">Ends</span>
            <span className="rzv-res-card__value">
              {formatDateTime(r.reservation_end_at)}
            </span>
          </div>
        </div>

        {r.preorders?.length ? (
          <div className="rzv-res-card__preorders">
            <span className="rzv-res-card__label">Pre-order</span>
            <ul className="rzv-res-card__preorder-list">
              {r.preorders.map((p) => (
                <li key={p.dish_id}>
                  <span>
                    {p.quantity}× {p.dish_name}
                  </span>
                  <span>{formatVND(Number(p.unit_price) * Number(p.quantity))}</span>
                </li>
              ))}
            </ul>
            <div className="rzv-res-card__preorder-total">
              <span>Total</span>
              <strong>{formatVND(preorderTotal)}</strong>
            </div>
          </div>
        ) : null}

        {r.special_request ? (
          <div className="rzv-res-card__notes">
            <span className="rzv-res-card__label">Notes</span>
            <p>{r.special_request}</p>
          </div>
        ) : null}

        <footer className="rzv-res-card__actions">
          {canPreorder ? (
            <button
              type="button"
              className="rzv-btn rzv-btn--ghost"
              onClick={() =>
                setOpenPreorderId((prev) =>
                  prev === r.reservation_id ? null : r.reservation_id
                )
              }
            >
              {isPreorderOpen
                ? "Close pre-order"
                : r.preorders?.length
                ? "Edit pre-order"
                : "Add pre-order"}
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              className="rzv-btn rzv-btn--danger"
              onClick={() => handleCancel(r)}
              disabled={cancelingId === r.reservation_id}
            >
              {cancelingId === r.reservation_id ? "Cancelling…" : "Cancel reservation"}
            </button>
          ) : null}
        </footer>

        {isPreorderOpen ? (
          <PreorderPanel
            reservation={r}
            userId={userId}
            onSaved={handlePreorderSaved}
          />
        ) : null}
      </article>
    );
  };

  return (
    <main className="rzv-page rzv-myres">
      <section className="rzv-myres__hero">
        <span className="rzv-booking__kicker">Your Table</span>
        <h1 className="rzv-myres__title rzv-serif">My Reservations</h1>
        <p className="rzv-myres__lead">
          Review upcoming visits, attach a pre-order, or cancel a booking.
        </p>
      </section>

      <div className="rzv-myres__body">
        {!isAuthenticated ? (
          <div className="rzv-myres__empty">
            <p>Please sign in to view your reservations.</p>
            <button
              type="button"
              className="rzv-btn rzv-btn--solid"
              onClick={() => onNavigateLogin?.()}
            >
              Sign In
            </button>
          </div>
        ) : null}

        {isAuthenticated && status === "loading" ? (
          <p className="rzv-myres__state">Loading your reservations…</p>
        ) : null}

        {isAuthenticated && status === "error" ? (
          <div className="rzv-myres__empty">
            <p className="rzv-summary__error">{error}</p>
            <button type="button" className="rzv-btn rzv-btn--ghost" onClick={load}>
              Try again
            </button>
          </div>
        ) : null}

        {isAuthenticated && status === "ready" ? (
          <>
            {error ? <p className="rzv-summary__error">{error}</p> : null}

            {reservations.length === 0 ? (
              <div className="rzv-myres__empty">
                <p>You have no reservations yet.</p>
                <button
                  type="button"
                  className="rzv-btn rzv-btn--solid"
                  onClick={() => onNavigate?.("reservations")}
                >
                  Book a Table
                </button>
              </div>
            ) : null}

            {upcoming.length > 0 ? (
              <section className="rzv-myres__group">
                <h2 className="rzv-myres__group-title">Upcoming</h2>
                <div className="rzv-myres__list">{upcoming.map(renderCard)}</div>
              </section>
            ) : null}

            {past.length > 0 ? (
              <section className="rzv-myres__group">
                <h2 className="rzv-myres__group-title">Past &amp; Cancelled</h2>
                <div className="rzv-myres__list">{past.map(renderCard)}</div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}

export default MyReservationsPage;
