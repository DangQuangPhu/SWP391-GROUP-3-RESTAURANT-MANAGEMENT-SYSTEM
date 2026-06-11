import { useEffect, useMemo, useState } from "react";
import { StaffModal } from "@/components/staff/StaffOverlay.jsx";
import {
  SectionHead,
  Toolbar,
  SearchField,
  StatusBadge,
  Button,
  EmptyState,
  NotConnectedNote,
} from "@/components/staff/StaffUI.jsx";
import { PROMO_STATUS_META } from "@/data/staffDashboardMockData.js";
import { formatVND } from "@/utils/formatCurrency.js";

const EMPTY = {
  name: "",
  code: "",
  discount_type: "percent",
  discount_value: 10,
  min_order: 0,
  start_date: "",
  end_date: "",
  status: "scheduled",
  usage_count: 0,
};

function discountText(p) {
  return p.discount_type === "percent" ? `${p.discount_value}%` : formatVND(p.discount_value);
}

function PromotionsSection({ promotions, setPromotions, pendingAction, toast }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    if (pendingAction === "add") {
      setEditing({ ...EMPTY });
      setIsNew(true);
    }
  }, [pendingAction]);

  const filtered = useMemo(() => {
    return promotions.filter((p) => {
      const kw = search.trim().toLowerCase();
      const matchKw = !kw || p.name.toLowerCase().includes(kw) || p.code.toLowerCase().includes(kw);
      const matchStatus = statusFilter === "all" || p.status === statusFilter;
      return matchKw && matchStatus;
    });
  }, [promotions, search, statusFilter]);

  const save = () => {
    if (!editing.name.trim() || !editing.code.trim()) {
      toast("Name and voucher code are required", "error");
      return;
    }
    const clean = {
      ...editing,
      code: editing.code.toUpperCase(),
      discount_value: Number(editing.discount_value) || 0,
      min_order: Number(editing.min_order) || 0,
    };
    if (isNew) {
      setPromotions((prev) => [...prev, { ...clean, promo_id: Date.now() }]);
      toast("Promotion added to this view (not persisted — API not connected)", "info");
    } else {
      setPromotions((prev) => prev.map((p) => (p.promo_id === clean.promo_id ? clean : p)));
      toast("Promotion updated locally (API not connected)", "info");
    }
    setEditing(null);
  };

  const remove = () => {
    setPromotions((prev) => prev.filter((p) => p.promo_id !== confirmDel.promo_id));
    toast("Promotion removed from view (delete API not connected)", "info");
    setConfirmDel(null);
  };

  return (
    <div className="sfx-stack">
      <SectionHead
        title="Promotions"
        subtitle={`${promotions.length} campaigns`}
        actions={
          <Button variant="gold" icon="plus" onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); }}>
            Create Promotion
          </Button>
        }
      />

      <Toolbar>
        <SearchField value={search} onChange={setSearch} placeholder="Name or code…" />
        <select className="sfx-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {Object.entries(PROMO_STATUS_META).map(([k, m]) => (
            <option key={k} value={k}>{m.label}</option>
          ))}
        </select>
      </Toolbar>

      <div className="sfx-card sfx-card--flush">
        <div className="sfx-table-wrap">
          <table className="sfx-table sfx-table--hover">
            <thead>
              <tr>
                <th>Promotion</th>
                <th>Code</th>
                <th>Discount</th>
                <th>Min order</th>
                <th>Window</th>
                <th>Used</th>
                <th>Status</th>
                <th className="sfx-table__right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.promo_id}>
                  <td><strong>{p.name}</strong></td>
                  <td><code className="sfx-code">{p.code}</code></td>
                  <td>{discountText(p)}</td>
                  <td>{p.min_order ? formatVND(p.min_order) : "—"}</td>
                  <td>
                    {p.start_date || "—"}
                    <small className="sfx-cell-sub">to {p.end_date || "—"}</small>
                  </td>
                  <td>{p.usage_count}</td>
                  <td>
                    <StatusBadge tone={PROMO_STATUS_META[p.status]?.tone}>
                      {PROMO_STATUS_META[p.status]?.label}
                    </StatusBadge>
                  </td>
                  <td className="sfx-table__right">
                    <div className="sfx-rowacts">
                      <Button size="sm" variant="ghost" icon="edit" onClick={() => { setEditing({ ...p }); setIsNew(false); }}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirmDel(p)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? <EmptyState icon="tag" title="No promotions found" /> : null}
      </div>

      <StaffModal
        open={Boolean(editing)}
        title={isNew ? "Create Promotion" : `Edit ${editing?.name || "Promotion"}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            {!isNew ? (
              <Button variant="danger" icon="trash" onClick={() => { setConfirmDel(editing); setEditing(null); }}>
                Delete
              </Button>
            ) : <span />}
            <div className="sfx-modal__footacts">
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="gold" onClick={save}>{isNew ? "Create" : "Save changes"}</Button>
            </div>
          </>
        }
      >
        {editing ? (
          <div className="sfx-form">
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Promotion name</span>
                <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Weekday Lunch 15%" />
              </label>
              <label className="sfx-field">
                <span>Voucher code</span>
                <input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value })} placeholder="LUNCH15" />
              </label>
            </div>
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Discount type</span>
                <select value={editing.discount_type} onChange={(e) => setEditing({ ...editing, discount_type: e.target.value })}>
                  <option value="percent">Percent (%)</option>
                  <option value="amount">Fixed amount (VND)</option>
                </select>
              </label>
              <label className="sfx-field">
                <span>Discount value</span>
                <input type="number" min="0" value={editing.discount_value} onChange={(e) => setEditing({ ...editing, discount_value: e.target.value })} />
              </label>
            </div>
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Min order (VND)</span>
                <input type="number" min="0" step="1000" value={editing.min_order} onChange={(e) => setEditing({ ...editing, min_order: e.target.value })} />
              </label>
              <label className="sfx-field">
                <span>Status</span>
                <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  {Object.entries(PROMO_STATUS_META).map(([k, m]) => (
                    <option key={k} value={k}>{m.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Start date</span>
                <input type="date" value={editing.start_date} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} />
              </label>
              <label className="sfx-field">
                <span>End date</span>
                <input type="date" value={editing.end_date} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} />
              </label>
            </div>
            <NotConnectedNote>Promotion write/delete API not connected — changes stay in this view.</NotConnectedNote>
          </div>
        ) : null}
      </StaffModal>

      <StaffModal
        open={Boolean(confirmDel)}
        title="Delete promotion?"
        size="sm"
        onClose={() => setConfirmDel(null)}
        footer={
          <div className="sfx-modal__footacts">
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>Keep</Button>
            <Button variant="danger" icon="trash" onClick={remove}>Delete</Button>
          </div>
        }
      >
        <p className="sfx-confirm-text">
          Delete <strong>{confirmDel?.name}</strong> ({confirmDel?.code})? This is a local change only.
        </p>
      </StaffModal>
    </div>
  );
}

export default PromotionsSection;
