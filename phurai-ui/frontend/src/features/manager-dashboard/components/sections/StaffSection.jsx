/**
 * StaffSection.jsx — Employee Registry (Full Rewrite per KDS Directive Part 3.4)
 *
 * Shows ALL employees from dbo.StaffProfiles (with OR without system accounts).
 * Actions: Edit, Grant Access, Revoke Access, Add Performance Review.
 * Filter: All / With Account / Without Account (client-side, single API call).
 * Salary column: visible only to Manager (role_id=4) and Admin (role_id=5).
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { listContainerVariants, listItemVariants } from "@/components/ui/Skeleton";
import { ManagerModal } from "../ManagerOverlay.jsx";
import {
  SectionHead,
  ContentPanel,
  Toolbar,
  SearchField,
  StatusBadge,
  Button,
  EmptyState,
} from "../ManagerUI.jsx";
import { useManagerPortal } from "../../context/ManagerPortalContext.jsx";
import {
  getEmployees,
  getJobTitles,
  createEmployee,
  updateEmployee,
  grantAccess,
  revokeAccess,
  addPerformanceReview,
} from "../../services/managerApi.js";

// ── Role label map ────────────────────────────────────────────────────────────
const ROLE_LABELS = { 1: "Customer", 2: "Staff", 4: "Manager", 5: "Admin" };
const GRANTABLE_ROLES_MANAGER = [{ id: 2, label: "Restaurant Staff" }];
const GRANTABLE_ROLES_ADMIN   = [{ id: 2, label: "Restaurant Staff" }, { id: 4, label: "Manager" }];

// ── Filter tabs ───────────────────────────────────────────────────────────────
const FILTER_TABS = [
  { id: "all",      label: "All" },
  { id: "with",     label: "With Account" },
  { id: "without",  label: "Without Account" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (v) => v ?? "—";
const fmtSalary = (v) => v != null ? `${Number(v).toLocaleString("vi-VN")}₫` : "—";
const fmtRating = (v) => v != null ? `${Number(v).toFixed(1)} ★` : "—";

// ── Empty form templates ──────────────────────────────────────────────────────
const EMPTY_EMP = {
  full_name: "", email: "", phone: "", job_title_id: "", department: "", salary: "",
};
const EMPTY_REVIEW = { rating: "5", notes: "" };
const EMPTY_GRANT  = { role_id: 2 };

// ═════════════════════════════════════════════════════════════════════════════
function StaffSection({ toast }) {
  const { currentUser } = useManagerPortal();
  const callerRoleId = currentUser?.role_id;
  const showSalary   = [4, 5].includes(callerRoleId);
  const grantableRoles = callerRoleId === 5 ? GRANTABLE_ROLES_ADMIN : GRANTABLE_ROLES_MANAGER;

  // ── Data state ────────────────────────────────────────────────────────────
  const [employees, setEmployees]   = useState([]);
  const [jobTitles, setJobTitles]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterTab, setFilterTab]   = useState("all");
  const [searchQ, setSearchQ]       = useState("");

  // ── Modal state ───────────────────────────────────────────────────────────
  const [editModal, setEditModal]       = useState(null);  // employee row | null
  const [isNew, setIsNew]               = useState(false);
  const [editForm, setEditForm]         = useState(EMPTY_EMP);
  const [grantModal, setGrantModal]     = useState(null);  // employee row | null
  const [grantForm, setGrantForm]       = useState(EMPTY_GRANT);
  const [reviewModal, setReviewModal]   = useState(null);  // employee row | null
  const [reviewForm, setReviewForm]     = useState(EMPTY_REVIEW);
  const [saving, setSaving]             = useState(false);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, jtRes] = await Promise.all([getEmployees(), getJobTitles()]);
      setEmployees(empRes.data ?? []);
      setJobTitles(jtRes.data ?? []);
    } catch (err) {
      toast?.({ type: "error", message: "Failed to load employees." });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Client-side filter + search ───────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = employees;
    if (filterTab === "with")    list = list.filter(e => e.has_system_account);
    if (filterTab === "without") list = list.filter(e => !e.has_system_account);
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase();
      list = list.filter(e =>
        (e.full_name ?? "").toLowerCase().includes(q) ||
        (e.email     ?? "").toLowerCase().includes(q) ||
        (e.job_title ?? "").toLowerCase().includes(q) ||
        (e.department?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [employees, filterTab, searchQ]);

  // ── Edit handlers ─────────────────────────────────────────────────────────
  const openEdit = (emp) => {
    setIsNew(false);
    setEditForm({
      full_name:    emp.full_name  ?? "",
      email:        emp.email      ?? "",
      phone:        emp.phone      ?? "",
      job_title_id: emp.job_title_id ?? "",
      department:   emp.department ?? "",
      salary:       emp.salary     ?? "",
    });
    setEditModal(emp);
  };

  const openNew = () => {
    setIsNew(true);
    setEditForm(EMPTY_EMP);
    setEditModal({});
  };

  const handleSaveEmployee = async () => {
    if (!editForm.full_name.trim()) {
      toast?.({ type: "error", message: "Full name is required." }); return;
    }
    setSaving(true);
    try {
      const payload = {
        full_name:    editForm.full_name.trim(),
        email:        editForm.email.trim()    || undefined,
        phone:        editForm.phone.trim()    || undefined,
        job_title_id: editForm.job_title_id   || undefined,
        department:   editForm.department.trim() || undefined,
        ...(showSalary ? { salary: editForm.salary || undefined } : {}),
      };
      if (isNew) {
        await createEmployee(payload);
        toast?.({ type: "success", message: "Employee created." });
      } else {
        await updateEmployee(editModal.staff_id, payload);
        toast?.({ type: "success", message: "Employee updated." });
      }
      setEditModal(null);
      await loadData();
    } catch (err) {
      toast?.({ type: "error", message: err.message || "Failed to save employee." });
    } finally {
      setSaving(false);
    }
  };

  // ── Grant Access handlers ─────────────────────────────────────────────────
  const openGrant = (emp) => {
    setGrantForm({ role_id: grantableRoles[0]?.id ?? 2 });
    setGrantModal(emp);
  };

  const handleGrant = async () => {
    setSaving(true);
    try {
      await grantAccess(grantModal.staff_id, { role_id: grantForm.role_id });
      toast?.({ type: "success", message: "System access granted. Temp password sent to employee email." });
      setGrantModal(null);
      await loadData();
    } catch (err) {
      toast?.({ type: "error", message: err.message || "Failed to grant access." });
    } finally {
      setSaving(false);
    }
  };

  // ── Revoke Access ─────────────────────────────────────────────────────────
  const handleRevoke = async (emp) => {
    if (!window.confirm(`Revoke system access for ${emp.full_name}? They will be logged out immediately.`)) return;
    setSaving(true);
    try {
      await revokeAccess(emp.staff_id);
      toast?.({ type: "success", message: `Access revoked for ${emp.full_name}.` });
      await loadData();
    } catch (err) {
      toast?.({ type: "error", message: err.message || "Failed to revoke access." });
    } finally {
      setSaving(false);
    }
  };

  // ── Performance Review ────────────────────────────────────────────────────
  const openReview = (emp) => {
    setReviewForm(EMPTY_REVIEW);
    setReviewModal(emp);
  };

  const handleSaveReview = async () => {
    const rating = parseFloat(reviewForm.rating);
    if (isNaN(rating) || rating < 1 || rating > 5) {
      toast?.({ type: "error", message: "Rating must be between 1.0 and 5.0." }); return;
    }
    setSaving(true);
    try {
      await addPerformanceReview(reviewModal.staff_id, { rating, notes: reviewForm.notes.trim() || undefined });
      toast?.({ type: "success", message: "Performance review saved." });
      setReviewModal(null);
      await loadData();
    } catch (err) {
      toast?.({ type: "error", message: err.message || "Failed to save review." });
    } finally {
      setSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="staff-section">
      <SectionHead title="Employee Registry" subtitle={`${employees.length} employee${employees.length !== 1 ? "s" : ""} total`}>
        <Button variant="primary" onClick={openNew}>+ Add Employee</Button>
      </SectionHead>

      <ContentPanel>
        {/* Filter Tabs + Search */}
        <Toolbar>
          <div className="filter-tabs" style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {FILTER_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                style={{
                  padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer",
                  fontWeight: filterTab === tab.id ? "600" : "400",
                  background: filterTab === tab.id ? "var(--accent, #c8a96e)" : "var(--surface-2, #2a2a2a)",
                  color: filterTab === tab.id ? "#fff" : "var(--text-muted, #aaa)",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <SearchField
            placeholder="Search name, email, title, department…"
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
          />
        </Toolbar>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Loading employees…</div>
        ) : filtered.length === 0 ? (
          <EmptyState message="No employees match your filter." />
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border, #333)", color: "var(--text-muted, #888)", textAlign: "left" }}>
                  <th style={{ padding: "10px 12px" }}>Name</th>
                  <th style={{ padding: "10px 12px" }}>Job Title</th>
                  <th style={{ padding: "10px 12px" }}>Department</th>
                  {showSalary && <th style={{ padding: "10px 12px" }}>Salary</th>}
                  <th style={{ padding: "10px 12px" }}>Rating</th>
                  <th style={{ padding: "10px 12px" }}>System Access</th>
                  <th style={{ padding: "10px 12px" }}>Actions</th>
                </tr>
              </thead>
              <motion.tbody variants={listContainerVariants} initial="hidden" animate="visible">
                {filtered.map(emp => (
                  <motion.tr
                    key={emp.staff_id}
                    variants={listItemVariants}
                    style={{ borderBottom: "1px solid var(--border-subtle, #222)", verticalAlign: "middle" }}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ fontWeight: "500" }}>{fmt(emp.full_name)}</div>
                      <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{fmt(emp.email)}</div>
                    </td>
                    <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>{fmt(emp.job_title)}</td>
                    <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>{fmt(emp.department)}</td>
                    {showSalary && <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>{fmtSalary(emp.salary)}</td>}
                    <td style={{ padding: "10px 12px" }}>{fmtRating(emp.latest_rating)}</td>
                    <td style={{ padding: "10px 12px" }}>
                      {emp.has_system_account ? (
                        <StatusBadge status={emp.account_is_active ? "active" : "inactive"}>
                          {emp.account_is_active ? ROLE_LABELS[emp.role_id] ?? "Staff" : "Suspended"}
                        </StatusBadge>
                      ) : (
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No Account</span>
                      )}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        <Button size="sm" onClick={() => openEdit(emp)}>Edit</Button>
                        {!emp.has_system_account && (
                          <Button size="sm" variant="success" onClick={() => openGrant(emp)}>Grant Access</Button>
                        )}
                        {emp.has_system_account && emp.account_is_active && emp.role_id !== 5 && (
                          <Button size="sm" variant="danger" onClick={() => handleRevoke(emp)} disabled={saving}>Revoke</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => openReview(emp)}>Review</Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}
      </ContentPanel>

      {/* Edit / New Employee Modal */}
      {editModal !== null && (
        <ManagerModal
          title={isNew ? "New Employee" : "Edit Employee"}
          onClose={() => setEditModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveEmployee} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <label>Full Name *
              <input className="modal-input" value={editForm.full_name}
                onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
            </label>
            <label>Email
              <input className="modal-input" type="email" value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
            </label>
            <label>Phone
              <input className="modal-input" value={editForm.phone}
                onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
            </label>
            <label>Job Title
              <select className="modal-input" value={editForm.job_title_id}
                onChange={e => setEditForm(f => ({ ...f, job_title_id: e.target.value }))}>
                <option value="">— Select —</option>
                {jobTitles.map(jt => (
                  <option key={jt.job_title_id} value={jt.job_title_id}>{jt.title_name}</option>
                ))}
              </select>
            </label>
            <label>Department
              <input className="modal-input" value={editForm.department}
                onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))} />
            </label>
            {showSalary && (
              <label>Salary (VND)
                <input className="modal-input" type="number" value={editForm.salary}
                  onChange={e => setEditForm(f => ({ ...f, salary: e.target.value }))} />
              </label>
            )}
          </div>
        </ManagerModal>
      )}

      {/* Grant System Access Modal */}
      {grantModal !== null && (
        <ManagerModal
          title={`Grant Access — ${grantModal.full_name}`}
          onClose={() => setGrantModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setGrantModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleGrant} disabled={saving}>
                {saving ? "Granting…" : "Grant Access"}
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              A temporary password will be sent to <strong>{grantModal.email}</strong>.
              The employee must change it on first login.
            </p>
            <label>Assign Role
              <select className="modal-input" value={grantForm.role_id}
                onChange={e => setGrantForm(f => ({ ...f, role_id: Number(e.target.value) }))}>
                {grantableRoles.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </label>
          </div>
        </ManagerModal>
      )}

      {/* Performance Review Modal */}
      {reviewModal !== null && (
        <ManagerModal
          title={`Performance Review — ${reviewModal.full_name}`}
          onClose={() => setReviewModal(null)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setReviewModal(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveReview} disabled={saving}>
                {saving ? "Saving…" : "Save Review"}
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <label>Rating (1.0 – 5.0) *
              <input className="modal-input" type="number" min="1" max="5" step="0.1"
                value={reviewForm.rating}
                onChange={e => setReviewForm(f => ({ ...f, rating: e.target.value }))} />
            </label>
            <label>Notes
              <textarea className="modal-input" rows={4} value={reviewForm.notes}
                onChange={e => setReviewForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes about this review period…" />
            </label>
          </div>
        </ManagerModal>
      )}
    </div>
  );
}

export default StaffSection;
