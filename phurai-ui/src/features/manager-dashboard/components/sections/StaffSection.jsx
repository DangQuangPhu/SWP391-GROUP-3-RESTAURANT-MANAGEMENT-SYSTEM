import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ManagerModal } from "../ManagerOverlay.jsx";
import {
  SectionHead,
  Toolbar,
  SearchField,
  StatusBadge,
  Button,
  EmptyState,
  NotConnectedNote,
} from "../ManagerUI.jsx";
import {
  STAFF_ASSIGNABLE_ROLES,
  MANAGER_STATUS_META,
  SHIFTS,
} from "../../data/managerDashboardMockData.js";
import { getStaffTabFromSearch, STAFF_TAB_IDS } from "../../config/managerRoutes.js";
import ShiftScheduler from "./ShiftScheduler.jsx";

function isSubordinateStaff(member) {
  return STAFF_ASSIGNABLE_ROLES.includes(String(member?.role_name ?? "").trim());
}

const EMPTY = {
  full_name: "",
  role_name: STAFF_ASSIGNABLE_ROLES[0],
  phone: "",
  email: "",
  status: "active",
  shift: SHIFTS[0],
};

const STAFF_TABS = [
  { id: "list", label: "Staff List" },
  { id: "shifts", label: "Shift Management" },
];

function StaffListPanel({
  staff,
  search,
  onSearch,
  roleFilter,
  onRoleFilter,
  onEdit,
  onDelete,
}) {
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

  return (
    <>
      <Toolbar>
        <SearchField value={search} onChange={onSearch} placeholder="Name, email or phone…" />
        <select
          className="sfx-select"
          value={roleFilter}
          onChange={(e) => onRoleFilter(e.target.value)}
        >
          <option value="all">All roles</option>
          {STAFF_ASSIGNABLE_ROLES.map((r) => (
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
                <tr key={s.manager_id}>
                  <td>
                    <div className="sfx-dishcell">
                      <span className="sfx-thumb sfx-thumb--round">
                        {s.full_name
                          .split(" ")
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")}
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
                    <StatusBadge tone={MANAGER_STATUS_META[s.status]?.tone}>
                      {MANAGER_STATUS_META[s.status]?.label}
                    </StatusBadge>
                  </td>
                  <td className="sfx-table__right">
                    <div className="sfx-rowacts">
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="edit"
                        onClick={() => onEdit(s)}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="trash"
                        onClick={() => onDelete(s)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? (
          <EmptyState icon="users" title="No staff members found" />
        ) : null}
      </div>
    </>
  );
}

function StaffSection({ staff, setStaff, pendingAction, toast }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(
    () => getStaffTabFromSearch(`?${searchParams.toString()}`),
    [searchParams]
  );
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const selectTab = (nextTab) => {
    if (!STAFF_TAB_IDS.includes(nextTab)) return;
    if (nextTab === "list") {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  useEffect(() => {
    if (pendingAction === "add" && tab === "list") {
      setEditing({ ...EMPTY });
      setIsNew(true);
    }
  }, [pendingAction, tab]);

  const visibleStaff = useMemo(
    () => staff.filter(isSubordinateStaff),
    [staff]
  );

  const openEdit = (member) => {
    setEditing({ ...member });
    setIsNew(false);
  };

  const save = () => {
    if (!editing.full_name.trim()) {
      toast("Staff name is required", "error");
      return;
    }
    if (!isSubordinateStaff(editing)) {
      toast("Only Restaurant Staff and Kitchen Staff can be managed here.", "error");
      return;
    }
    if (isNew) {
      setStaff((prev) => [
        ...prev.filter(isSubordinateStaff),
        { ...editing, manager_id: Date.now() },
      ]);
      toast("Staff member added to this view (not persisted — API not connected)", "info");
    } else {
      setStaff((prev) =>
        prev
          .filter(isSubordinateStaff)
          .map((s) => (s.manager_id === editing.manager_id ? editing : s))
      );
      toast("Staff member updated locally (API not connected)", "info");
    }
    setEditing(null);
  };

  const remove = () => {
    setStaff((prev) =>
      prev.filter(isSubordinateStaff).filter((s) => s.manager_id !== confirmDel.manager_id)
    );
    toast("Staff member removed from view (delete API not connected)", "info");
    setConfirmDel(null);
  };

  const sectionSubtitle =
    tab === "shifts"
      ? "Assign shifts and track attendance"
      : `${visibleStaff.length} staff member${visibleStaff.length === 1 ? "" : "s"}`;

  return (
    <div className="sfx-stack">
      <SectionHead
        title="Staff"
        subtitle={sectionSubtitle}
        actions={
          tab === "list" ? (
            <Button
              variant="gold"
              icon="plus"
              onClick={() => {
                setEditing({ ...EMPTY });
                setIsNew(true);
              }}
            >
              Add Staff
            </Button>
          ) : null
        }
      />

      <div className="sfx-tabs" role="tablist" aria-label="Staff views">
        {STAFF_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`sfx-tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "list" ? (
        <StaffListPanel
          staff={visibleStaff}
          search={search}
          onSearch={setSearch}
          roleFilter={roleFilter}
          onRoleFilter={setRoleFilter}
          onEdit={openEdit}
          onDelete={setConfirmDel}
        />
      ) : null}

      {tab === "shifts" ? <ShiftScheduler /> : null}

      <ManagerModal
        open={Boolean(editing)}
        title={isNew ? "Add Staff" : `Edit ${editing?.full_name || "staff member"}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            {!isNew ? (
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
                {isNew ? "Add staff" : "Save changes"}
              </Button>
            </div>
          </>
        }
      >
        {editing ? (
          <div className="sfx-form">
            <label className="sfx-field">
              <span>Full name</span>
              <input
                value={editing.full_name}
                onChange={(e) => setEditing({ ...editing, full_name: e.target.value })}
                placeholder="e.g. Tran Van A"
              />
            </label>
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Role</span>
                <select
                  value={editing.role_name}
                  onChange={(e) => setEditing({ ...editing, role_name: e.target.value })}
                >
                  {STAFF_ASSIGNABLE_ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </label>
              <label className="sfx-field">
                <span>Shift</span>
                <select
                  value={editing.shift}
                  onChange={(e) => setEditing({ ...editing, shift: e.target.value })}
                >
                  {SHIFTS.map((shift) => (
                    <option key={shift}>{shift}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Phone</span>
                <input
                  value={editing.phone}
                  onChange={(e) => setEditing({ ...editing, phone: e.target.value })}
                  placeholder="09xx xxx xxx"
                />
              </label>
              <label className="sfx-field">
                <span>Email</span>
                <input
                  type="email"
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                  placeholder="name@phurai.com"
                />
              </label>
            </div>
            <label className="sfx-field">
              <span>Status</span>
              <div className="sfx-chips">
                {Object.entries(MANAGER_STATUS_META).map(([k, m]) => (
                  <button
                    key={k}
                    type="button"
                    className={`sfx-chip ${editing.status === k ? "is-active" : ""}`}
                    onClick={() => setEditing({ ...editing, status: k })}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </label>
            <NotConnectedNote>
              Staff write/delete API not connected — changes stay in this view.
            </NotConnectedNote>
          </div>
        ) : null}
      </ManagerModal>

      <ManagerModal
        open={Boolean(confirmDel)}
        title="Remove staff member?"
        size="sm"
        onClose={() => setConfirmDel(null)}
        footer={
          <div className="sfx-modal__footacts">
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>
              Keep
            </Button>
            <Button variant="danger" icon="trash" onClick={remove}>
              Remove
            </Button>
          </div>
        }
      >
        <p className="sfx-confirm-text">
          Remove <strong>{confirmDel?.full_name}</strong> from the staff list? This is a local
          change only.
        </p>
      </ManagerModal>
    </div>
  );
}

export default StaffSection;
