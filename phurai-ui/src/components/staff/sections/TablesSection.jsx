import { useEffect, useMemo, useState } from "react";
import { StaffModal } from "@/components/staff/StaffOverlay.jsx";
import {
  SectionHead,
  Toolbar,
  StatusBadge,
  Button,
  NotConnectedNote,
} from "@/components/staff/StaffUI.jsx";
import {
  TABLE_STATUS_META,
  AREAS,
} from "@/data/staffDashboardMockData.js";

const STATUS_KEYS = Object.keys(TABLE_STATUS_META);
const EMPTY = { table_number: "", area_name: AREAS[0], capacity: 2, status: "available" };

function TablesSection({ tables, setTables, pendingAction, role, toast }) {
  const [areaFilter, setAreaFilter] = useState("all");
  const [editing, setEditing] = useState(null); // table or EMPTY
  const [isNew, setIsNew] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const isManager = role === "manager";

  useEffect(() => {
    if (pendingAction === "add" && isManager) {
      setEditing({ ...EMPTY });
      setIsNew(true);
    }
  }, [pendingAction, isManager]);

  const grouped = useMemo(() => {
    const list = areaFilter === "all" ? tables : tables.filter((t) => t.area_name === areaFilter);
    const map = {};
    list.forEach((t) => {
      (map[t.area_name] = map[t.area_name] || []).push(t);
    });
    return map;
  }, [tables, areaFilter]);

  const openNew = () => {
    setEditing({ ...EMPTY });
    setIsNew(true);
  };
  const openEdit = (t) => {
    setEditing({ ...t });
    setIsNew(false);
  };

  const save = () => {
    if (!editing.table_number.trim()) {
      toast("Table number is required", "error");
      return;
    }
    if (isNew) {
      setTables((prev) => [
        ...prev,
        { ...editing, table_id: Date.now(), capacity: Number(editing.capacity) || 1 },
      ]);
      toast("Table added to this view (not persisted — API not connected)", "info");
    } else {
      setTables((prev) =>
        prev.map((t) => (t.table_id === editing.table_id ? { ...editing, capacity: Number(editing.capacity) || 1 } : t))
      );
      toast("Table updated locally (API not connected)", "info");
    }
    setEditing(null);
  };

  const quickStatus = (t, status) => {
    setTables((prev) => prev.map((x) => (x.table_id === t.table_id ? { ...x, status } : x)));
    toast(`${t.table_number} → ${TABLE_STATUS_META[status].label} (local only)`, "info");
  };

  const remove = () => {
    setTables((prev) => prev.filter((t) => t.table_id !== confirmDel.table_id));
    toast("Table removed from view (delete API not connected)", "info");
    setConfirmDel(null);
  };

  return (
    <div className="sfx-stack">
      <SectionHead
        title="Table Map"
        subtitle={`${tables.length} tables across ${AREAS.length} areas`}
        actions={
          isManager ? (
            <Button variant="gold" icon="plus" onClick={openNew}>
              Add Table
            </Button>
          ) : null
        }
      />

      <Toolbar>
        <div className="sfx-legend">
          {STATUS_KEYS.map((k) => (
            <span key={k} className="sfx-legend__item">
              <i className={`sfx-dot sfx-dot--${TABLE_STATUS_META[k].tone}`} />
              {TABLE_STATUS_META[k].label}
            </span>
          ))}
        </div>
        <select className="sfx-select" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
          <option value="all">All areas</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </Toolbar>

      {Object.entries(grouped).map(([areaName, list]) => (
        <div key={areaName} className="sfx-card">
          <header className="sfx-card__head">
            <h3 className="sfx-card__title">{areaName}</h3>
            <span className="sfx-muted">{list.length} tables</span>
          </header>
          <div className="sfx-card__body">
            <div className="sfx-tablemap">
              {list.map((t) => (
                <button
                  key={t.table_id}
                  type="button"
                  className={`sfx-mtile sfx-mtile--${TABLE_STATUS_META[t.status]?.tone}`}
                  onClick={() => openEdit(t)}
                >
                  <span className="sfx-mtile__no">{t.table_number}</span>
                  <span className="sfx-mtile__cap">{t.capacity} seats</span>
                  <StatusBadge tone={TABLE_STATUS_META[t.status]?.tone}>
                    {TABLE_STATUS_META[t.status]?.label}
                  </StatusBadge>
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Add / edit modal */}
      <StaffModal
        open={Boolean(editing)}
        title={isNew ? "Add Table" : `Edit ${editing?.table_number || "Table"}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            {!isNew && isManager ? (
              <Button
                variant="danger"
                icon="trash"
                onClick={() => {
                  setConfirmDel(editing);
                  setEditing(null);
                }}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="sfx-modal__footacts">
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button variant="gold" onClick={save}>
                {isNew ? "Add table" : "Save changes"}
              </Button>
            </div>
          </>
        }
      >
        {editing ? (
          <div className="sfx-form">
            <label className="sfx-field">
              <span>Table number</span>
              <input
                value={editing.table_number}
                onChange={(e) => setEditing({ ...editing, table_number: e.target.value })}
                placeholder="e.g. M-09"
              />
            </label>
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Area</span>
                <select
                  value={editing.area_name}
                  onChange={(e) => setEditing({ ...editing, area_name: e.target.value })}
                >
                  {AREAS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
              <label className="sfx-field">
                <span>Capacity</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={editing.capacity}
                  onChange={(e) => setEditing({ ...editing, capacity: e.target.value })}
                />
              </label>
            </div>
            <label className="sfx-field">
              <span>Status</span>
              <div className="sfx-chips">
                {STATUS_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`sfx-chip ${editing.status === k ? "is-active" : ""}`}
                    onClick={() => setEditing({ ...editing, status: k })}
                  >
                    {TABLE_STATUS_META[k].label}
                  </button>
                ))}
              </div>
            </label>
            {!isNew ? (
              <div className="sfx-quickstatus">
                <span className="sfx-muted">Quick set:</span>
                {["available", "occupied", "cleaning"].map((k) => (
                  <Button key={k} size="sm" variant="soft" onClick={() => quickStatus(editing, k)}>
                    {TABLE_STATUS_META[k].label}
                  </Button>
                ))}
              </div>
            ) : null}
            <NotConnectedNote>Table write/delete API not connected — changes stay in this view.</NotConnectedNote>
          </div>
        ) : null}
      </StaffModal>

      {/* Delete confirm */}
      <StaffModal
        open={Boolean(confirmDel)}
        title="Delete table?"
        size="sm"
        onClose={() => setConfirmDel(null)}
        footer={
          <div className="sfx-modal__footacts">
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>
              Keep
            </Button>
            <Button variant="danger" icon="trash" onClick={remove}>
              Delete
            </Button>
          </div>
        }
      >
        <p className="sfx-confirm-text">
          Remove <strong>{confirmDel?.table_number}</strong> ({confirmDel?.area_name}) from the floor
          plan? This is a local change only.
        </p>
      </StaffModal>
    </div>
  );
}

export default TablesSection;
