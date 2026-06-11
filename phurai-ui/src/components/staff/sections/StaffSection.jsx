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
import {
  STAFF_ROLES,
  STAFF_STATUS_META,
  SHIFTS,
} from "@/data/staffDashboardMockData.js";

const EMPTY = {
  full_name: "",
  role_name: STAFF_ROLES[1],
  phone: "",
  email: "",
  status: "active",
  shift: SHIFTS[0],
};

function StaffSection({ staff, setStaff, pendingAction, toast }) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
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
    return staff.filter((s) => {
      const kw = search.trim().toLowerCase();
      const matchKw =
        !kw ||
        s.full_name.toLowerCase().includes(kw) ||
        s.email.toLowerCase().includes(kw) ||
        String(s.phone).includes(kw);
      const matchRole = roleFilter === "all" || s.role_name === roleFilter;
      return matchKw && matchRole;
    });
  }, [staff, search, roleFilter]);

  const save = () => {
    if (!editing.full_name.trim()) {
      toast("Staff name is required", "error");
      return;
    }
    if (isNew) {
      setStaff((prev) => [...prev, { ...editing, staff_id: Date.now() }]);
      toast("Staff added to this view (not persisted — API not connected)", "info");
    } else {
      setStaff((prev) => prev.map((s) => (s.staff_id === editing.staff_id ? editing : s)));
      toast("Staff updated locally (API not connected)", "info");
    }
    setEditing(null);
  };

  const remove = () => {
    setStaff((prev) => prev.filter((s) => s.staff_id !== confirmDel.staff_id));
    toast("Staff removed from view (delete API not connected)", "info");
    setConfirmDel(null);
  };

  return (
    <div className="sfx-stack">
      <SectionHead
        title="Staff"
        subtitle={`${staff.length} team members`}
        actions={
          <Button variant="gold" icon="plus" onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); }}>
            Add Staff
          </Button>
        }
      />

      <Toolbar>
        <SearchField value={search} onChange={setSearch} placeholder="Name, email or phone…" />
        <select className="sfx-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="all">All roles</option>
          {STAFF_ROLES.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Toolbar>

      <div className="sfx-card sfx-card--flush">
        <div className="sfx-table-wrap">
          <table className="sfx-table sfx-table--hover">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Contact</th>
                <th>Shift</th>
                <th>Status</th>
                <th className="sfx-table__right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.staff_id}>
                  <td>
                    <div className="sfx-dishcell">
                      <span className="sfx-thumb sfx-thumb--round">
                        {s.full_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                      </span>
                      <strong>{s.full_name}</strong>
                    </div>
                  </td>
                  <td>{s.role_name}</td>
                  <td>
                    {s.phone}
                    <small className="sfx-cell-sub">{s.email}</small>
                  </td>
                  <td>{s.shift}</td>
                  <td>
                    <StatusBadge tone={STAFF_STATUS_META[s.status]?.tone}>
                      {STAFF_STATUS_META[s.status]?.label}
                    </StatusBadge>
                  </td>
                  <td className="sfx-table__right">
                    <div className="sfx-rowacts">
                      <Button size="sm" variant="ghost" icon="edit" onClick={() => { setEditing({ ...s }); setIsNew(false); }}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirmDel(s)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? <EmptyState icon="users" title="No staff found" /> : null}
      </div>

      <StaffModal
        open={Boolean(editing)}
        title={isNew ? "Add Staff" : `Edit ${editing?.full_name || "Staff"}`}
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
              <Button variant="gold" onClick={save}>{isNew ? "Add staff" : "Save changes"}</Button>
            </div>
          </>
        }
      >
        {editing ? (
          <div className="sfx-form">
            <label className="sfx-field">
              <span>Full name</span>
              <input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} placeholder="e.g. Tran Van A" />
            </label>
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Role</span>
                <select value={editing.role_name} onChange={(e) => setEditing({ ...editing, role_name: e.target.value })}>
                  {STAFF_ROLES.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
              <label className="sfx-field">
                <span>Shift</span>
                <select value={editing.shift} onChange={(e) => setEditing({ ...editing, shift: e.target.value })}>
                  {SHIFTS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Phone</span>
                <input value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} placeholder="09xx xxx xxx" />
              </label>
              <label className="sfx-field">
                <span>Email</span>
                <input type="email" value={editing.email} onChange={(e) => setEditing({ ...editing, email: e.target.value })} placeholder="name@phurai.com" />
              </label>
            </div>
            <label className="sfx-field">
              <span>Status</span>
              <div className="sfx-chips">
                {Object.entries(STAFF_STATUS_META).map(([k, m]) => (
                  <button key={k} type="button" className={`sfx-chip ${editing.status === k ? "is-active" : ""}`} onClick={() => setEditing({ ...editing, status: k })}>
                    {m.label}
                  </button>
                ))}
              </div>
            </label>
            <NotConnectedNote>Staff write/delete API not connected — changes stay in this view.</NotConnectedNote>
          </div>
        ) : null}
      </StaffModal>

      <StaffModal
        open={Boolean(confirmDel)}
        title="Remove staff?"
        size="sm"
        onClose={() => setConfirmDel(null)}
        footer={
          <div className="sfx-modal__footacts">
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>Keep</Button>
            <Button variant="danger" icon="trash" onClick={remove}>Remove</Button>
          </div>
        }
      >
        <p className="sfx-confirm-text">
          Remove <strong>{confirmDel?.full_name}</strong> from the staff list? This is a local change only.
        </p>
      </StaffModal>
    </div>
  );
}

export default StaffSection;
