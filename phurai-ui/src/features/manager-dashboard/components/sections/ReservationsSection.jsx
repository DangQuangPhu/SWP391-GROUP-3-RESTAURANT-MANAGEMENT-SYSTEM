import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ManagerDrawer } from "../ManagerOverlay.jsx";
import {
  SectionHead,
  Toolbar,
  SearchField,
  StatusBadge,
  Button,
  EmptyState,
  NotConnectedNote,
} from "../ManagerUI.jsx";
import { RESERVATION_STATUS_META, AREAS } from "../../data/managerDashboardMockData.js";
import { getReservationsFilterFromSearch } from "../../config/managerRoutes.js";

const FILTER_TABS = [
  { id: "all", label: "Live Reservations" },
  { id: "arriving", label: "Check-in Guests" },
];

function ReservationsSection({ reservations, setReservations, toast }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [area, setArea] = useState("all");
  const [active, setActive] = useState(null);

  const urlFilter = useMemo(
    () => getReservationsFilterFromSearch(`?${searchParams.toString()}`),
    [searchParams]
  );

  const selectFilterTab = (nextFilter) => {
    if (nextFilter === "arriving") {
      setSearchParams({ filter: "arriving" }, { replace: true });
      return;
    }
    setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    if (urlFilter === "arriving") setStatus("upcoming");
  }, [urlFilter]);

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      const kw = search.trim().toLowerCase();
      const matchKw =
        !kw ||
        r.customer_name.toLowerCase().includes(kw) ||
        r.table_label.toLowerCase().includes(kw) ||
        String(r.phone).includes(kw);
      const matchStatus =
        status === "all" ||
        (status === "upcoming"
          ? ["pending", "confirmed"].includes(r.status)
          : r.status === status);
      const matchArea = area === "all" || r.area_name === area;
      return matchKw && matchStatus && matchArea;
    });
  }, [reservations, search, status, area]);

  const setStatusFor = (id, next, label) => {
    setReservations((prev) =>
      prev.map((r) => (r.reservation_id === id ? { ...r, status: next } : r))
    );
    setActive((cur) => (cur && cur.reservation_id === id ? { ...cur, status: next } : cur));
    toast(`${label} (local only — booking API not connected)`, "info");
  };

  return (
    <div className="sfx-stack">
      <SectionHead
        title="Reservations"
        subtitle={`${filtered.length} of ${reservations.length} bookings`}
      />

      <div className="sfx-tabs" role="tablist" aria-label="Reservation views">
        {FILTER_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={urlFilter === t.id}
            className={`sfx-tab ${urlFilter === t.id ? "is-active" : ""}`}
            onClick={() => selectFilterTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Toolbar>
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Customer, table or phone…"
        />
        <select className="sfx-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="upcoming">Arriving (pending/confirmed)</option>
          {Object.entries(RESERVATION_STATUS_META).map(([k, m]) => (
            <option key={k} value={k}>
              {m.label}
            </option>
          ))}
        </select>
        <select className="sfx-select" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="all">All areas</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </Toolbar>

      <div className="sfx-card sfx-card--flush">
        <div className="sfx-table-wrap">
          <table className="sfx-table sfx-table--hover">
            <thead>
              <tr>
                <th>Time</th>
                <th>Customer</th>
                <th>Guests</th>
                <th>Area / Table</th>
                <th>Occasion</th>
                <th>Status</th>
                <th className="sfx-table__right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta = RESERVATION_STATUS_META[r.status] || {};
                return (
                  <tr key={r.reservation_id}>
                    <td className="sfx-mono">{r.start_time}</td>
                    <td>
                      <strong>{r.customer_name}</strong>
                      <small className="sfx-cell-sub">{r.phone}</small>
                    </td>
                    <td>{r.party_size}</td>
                    <td>
                      {r.area_name}
                      <small className="sfx-cell-sub">{r.table_label}</small>
                    </td>
                    <td>{r.occasion || "—"}</td>
                    <td>
                      <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                    </td>
                    <td className="sfx-table__right">
                      <div className="sfx-rowacts">
                        <Button size="sm" variant="ghost" icon="eye" onClick={() => setActive(r)}>
                          View
                        </Button>
                        {["pending"].includes(r.status) && (
                          <Button
                            size="sm"
                            variant="soft"
                            onClick={() => setStatusFor(r.reservation_id, "confirmed", "Reservation confirmed")}
                          >
                            Confirm
                          </Button>
                        )}
                        {["confirmed", "pending"].includes(r.status) && (
                          <Button
                            size="sm"
                            variant="gold"
                            onClick={() => setStatusFor(r.reservation_id, "checked_in", "Guest checked in")}
                          >
                            Check-in
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? (
          <EmptyState title="No reservations match your filters" hint="Try clearing the search or status filter." />
        ) : null}
      </div>

      <ManagerDrawer
        open={Boolean(active)}
        title={active ? `Reservation #${active.reservation_id}` : ""}
        onClose={() => setActive(null)}
        footer={
          active && !["cancelled", "completed", "no_show"].includes(active.status) ? (
            <div className="sfx-drawer__acts">
              <Button
                variant="danger"
                onClick={() => setStatusFor(active.reservation_id, "cancelled", "Reservation cancelled")}
              >
                Cancel booking
              </Button>
              <Button
                variant="gold"
                onClick={() => setStatusFor(active.reservation_id, "checked_in", "Guest checked in")}
              >
                Check-in guest
              </Button>
            </div>
          ) : null
        }
      >
        {active ? (
          <div className="sfx-detail">
            <div className="sfx-detail__row">
              <span>Customer</span>
              <strong>{active.customer_name}</strong>
            </div>
            <div className="sfx-detail__row">
              <span>Contact</span>
              <strong>
                {active.phone}
                <br />
                {active.email}
              </strong>
            </div>
            <div className="sfx-detail__grid">
              <div>
                <span>Date</span>
                <strong>{active.reservation_date}</strong>
              </div>
              <div>
                <span>Time</span>
                <strong>{active.start_time}</strong>
              </div>
              <div>
                <span>Guests</span>
                <strong>{active.party_size}</strong>
              </div>
              <div>
                <span>Table</span>
                <strong>{active.table_label}</strong>
              </div>
              <div>
                <span>Area</span>
                <strong>{active.area_name}</strong>
              </div>
              <div>
                <span>Occasion</span>
                <strong>{active.occasion || "—"}</strong>
              </div>
            </div>
            <div className="sfx-detail__row">
              <span>Status</span>
              <StatusBadge tone={RESERVATION_STATUS_META[active.status]?.tone}>
                {RESERVATION_STATUS_META[active.status]?.label}
              </StatusBadge>
            </div>
            <div className="sfx-detail__block">
              <span>Special request</span>
              <p>{active.special_request || "None"}</p>
            </div>
            <div className="sfx-detail__block">
              <span>Pre-ordered items</span>
              {active.preorder?.length ? (
                <ul className="sfx-detail__list">
                  {active.preorder.map((p, i) => (
                    <li key={i}>
                      <span>{p.dish_name}</span>
                      <strong>×{p.qty}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>None</p>
              )}
            </div>
            <NotConnectedNote>
              Status changes apply to this view only — reservation write API not connected.
            </NotConnectedNote>
          </div>
        ) : null}
      </ManagerDrawer>
    </div>
  );
}

export default ReservationsSection;
