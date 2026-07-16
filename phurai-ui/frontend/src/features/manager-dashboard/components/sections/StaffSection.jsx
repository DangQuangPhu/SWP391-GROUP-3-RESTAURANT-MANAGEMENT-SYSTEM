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
import Icon from "../ManagerIcons.jsx";
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
  deleteEmployee,
  grantAccess,
  revokeAccess,
  addPerformanceReview,
} from "../../services/managerApi.js";


// ── Role label map ────────────────────────────────────────────────────────────
const ROLE_LABELS = { 1: "Customer", 2: "Staff", 3: "Manager", 4: "Admin" };
const GRANTABLE_ROLES_MANAGER = [{ id: 2, label: "Restaurant Staff" }];
const GRANTABLE_ROLES_ADMIN   = [{ id: 2, label: "Restaurant Staff" }, { id: 3, label: "Manager" }];

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

// ── Corporate domain helpers ──────────────────────────────────────────────────
const CORPORATE_DOMAIN = "phurai.vn";

/** Strip @domain from email string, return only the local part */
const stripDomain = (email) => {
  if (!email) return "";
  return email.includes("@") ? email.split("@")[0] : email;
};

/** Generate email prefix slug from Vietnamese full name */
const slugifyName = (name) => {
  if (!name || !name.trim()) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
};

// ── Empty form templates ──────────────────────────────────────────────────────
const EMPTY_EMP = {
  full_name: "", email: "", phone: "", job_title_id: "", department: "", salary: "", employment_status: "Active", password: ""
};
const EMPTY_REVIEW = { rating: "5", notes: "" };
const EMPTY_GRANT  = { role_id: 2 };

// ═════════════════════════════════════════════════════════════════════════════
function StaffSection({ toast, hideHeader = false }) {
  const { currentUser } = useManagerPortal();
  const callerRoleId = currentUser?.role_id;
  const showSalary   = false;
  const grantableRoles = callerRoleId === 4 ? GRANTABLE_ROLES_ADMIN : GRANTABLE_ROLES_MANAGER;

  // ── Data state ────────────────────────────────────────────────────────────
  const [employees, setEmployees]   = useState([]);
  const [jobTitles, setJobTitles]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [filterTab, setFilterTab]   = useState("all");
  const [searchQ, setSearchQ]       = useState("");

  // ── Modal state ───────────────────────────────────────────────────────────
  const [editModal, setEditModal]           = useState(null);  // employee row | null
  const [isNew, setIsNew]                   = useState(false);
  const [editForm, setEditForm]             = useState(EMPTY_EMP);
  const [grantModal, setGrantModal]         = useState(null);  // employee row | null
  const [grantForm, setGrantForm]   = useState({ role_id: 2 });
  const [reviewModal, setReviewModal] = useState(null);
  const [reviewForm, setReviewForm]   = useState({ rating: "5.0", notes: "" });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);
  // Phase 2: Access Revocation is now handled automatically by the backend without warning.
  const [saving, setSaving]                 = useState(false);

  // ── Fetch data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, jtRes] = await Promise.all([getEmployees(), getJobTitles()]);
      setEmployees(empRes.data ?? []);
      setJobTitles(jtRes.data ?? []);
    } catch (err) {
      toast?.("Failed to load employees.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Client-side filter + search ───────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = employees;
    
    // Hide Admins from non-Admins
    if (callerRoleId !== 4) {
      list = list.filter(e => e.role_id !== 4);
    }

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
      full_name:         emp.full_name  ?? "",
      email:             stripDomain(emp.email ?? ""),
      phone:             emp.phone      ?? "",
      job_title_id:      emp.job_title_id ?? "",
      department:        emp.department ?? "",
      salary:            emp.salary     ?? "",
      employment_status: emp.employment_status ?? "Active",
      password:          "",
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
      toast?.("Full name is required.", "error"); return;
    }
    setSaving(true);
    try {
      // ── Build email: strip any domain, re-append @phurai.vn ──
      const emailPrefix = stripDomain(editForm.email.trim());
      const formattedEmail = emailPrefix ? `${emailPrefix}@${CORPORATE_DOMAIN}` : undefined;

      const payload = {
        full_name:         editForm.full_name.trim(),
        email:             formattedEmail,
        phone:             editForm.phone.trim()    || undefined,
        job_title_id:      editForm.job_title_id   || undefined,
        department:        editForm.department.trim() || undefined,
        employment_status: editForm.employment_status || "Active",
        password:          editForm.password?.trim() || undefined,
        ...(showSalary ? { salary: editForm.salary || undefined } : {}),
      };
      if (isNew) {
        await createEmployee(payload);
        toast?.("Employee created.", "success");
      } else {
        // Phase 2: Check if job_title_id changed to a non-access-requiring title
        // for an employee who currently has a system account
        const prevTitleId = editModal.job_title_id;
        const newTitleId  = editForm.job_title_id ? Number(editForm.job_title_id) : null;
        const newTitle    = jobTitles.find(t => t.job_title_id === newTitleId);
        const titleChanged = newTitleId && newTitleId !== prevTitleId;
        const accessWillBeUnneeded = titleChanged && newTitle && !newTitle.requires_system_access;
        const empHasAccount = editModal.has_system_account;

        if (accessWillBeUnneeded && empHasAccount) {
          await updateEmployee(editModal.staff_id, payload);
          setEditModal(null);
          await loadData();
          toast?.("Employee updated. System access automatically revoked due to role change.", "success");
          return;
        }

        await updateEmployee(editModal.staff_id, payload);
        toast?.("Employee updated.", "success");
      }
      setEditModal(null);
      await loadData();
    } catch (err) {
      toast?.(err.message || "Failed to save employee.", "error");
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
      toast?.("System access granted. Temp password sent to employee email.", "success");
      setGrantModal(null);
      await loadData();
    } catch (err) {
      toast?.(err.message || "Failed to grant access.", "error");
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
      toast?.(`Access revoked for ${emp.full_name}.`, "success");
      await loadData();
    } catch (err) {
      toast?.(err.message || "Failed to revoke access.", "error");
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
      toast?.("Rating must be between 1.0 and 5.0.", "error"); return;
    }
    setSaving(true);
    try {
      await addPerformanceReview(reviewModal.staff_id, { rating, notes: reviewForm.notes.trim() || undefined });
      toast?.("Performance review saved.", "success");
      setReviewModal(null);
      await loadData();
    } catch (err) {
      toast?.(err.message || "Failed to save review.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEmployee = async (emp) => {
    setDeleteConfirmModal(emp);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmModal) return;
    setSaving(true);
    try {
      await deleteEmployee(deleteConfirmModal.staff_id);
      toast?.("Employee deleted.", "success");
      setDeleteConfirmModal(null);
      await loadData();
    } catch (err) {
      toast?.(err.message || "Failed to delete employee.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickJobTitleChange = async (emp, newJobTitleId) => {
    const prevTitleId = emp.job_title_id;
    const oldTitleName = emp.job_title;
    const newTitle = jobTitles.find(t => t.job_title_id === newJobTitleId);

    // Optimistic UI update
    setEmployees(prev => prev.map(e => 
      e.staff_id === emp.staff_id ? { ...e, job_title_id: newJobTitleId, job_title: newTitle?.title_name } : e
    ));

    try {
      const titleChanged = newJobTitleId !== prevTitleId;
      const accessWillBeUnneeded = titleChanged && newTitle && !newTitle.requires_system_access;
      const empHasAccount = emp.has_system_account;

      if (accessWillBeUnneeded && empHasAccount) {
        await updateEmployee(emp.staff_id, { job_title_id: newJobTitleId });
        setEmployees(prev => prev.map(e => 
          e.staff_id === emp.staff_id ? { ...e, has_system_account: 0 } : e
        ));
        toast?.(`Role changed to ${newTitle?.title_name}. System access automatically revoked.`, "success");
        return;
      }

      const payload = { job_title_id: newJobTitleId };
      if (newTitle?.requires_system_access && !emp.email) {
        const prefix = slugifyName(emp.full_name);
        if (prefix) payload.email = `${prefix}@${CORPORATE_DOMAIN}`;
      }

      await updateEmployee(emp.staff_id, payload);
      toast?.(`Job title updated for ${emp.full_name}.`, "success");
      
      // Silently sync database state
      const fresh = await getEmployees();
      if (fresh?.data) setEmployees(fresh.data);
    } catch (err) {
      // Rollback
      setEmployees(prev => prev.map(e => 
        e.staff_id === emp.staff_id ? { ...e, job_title_id: prevTitleId, job_title: oldTitleName } : e
      ));
      toast?.(err.message || "Failed to update job title.", "error");
    }
  };

  const handleQuickActiveToggle = async (emp, isActive) => {
    const originalActive = emp.account_is_active;

    // Optimistic UI update
    setEmployees(prev => prev.map(e => 
      e.staff_id === emp.staff_id ? { ...e, account_is_active: isActive ? 1 : 0 } : e
    ));

    try {
      await updateEmployee(emp.staff_id, { is_active: isActive });
      toast?.(`Status updated for ${emp.full_name}.`, "success");
      
      // Silently sync database state
      const fresh = await getEmployees();
      if (fresh?.data) setEmployees(fresh.data);
    } catch (err) {
      // Rollback
      setEmployees(prev => prev.map(e => 
        e.staff_id === emp.staff_id ? { ...e, account_is_active: originalActive } : e
      ));
      toast?.(err.message || "Failed to update status.", "error");
    }
  };
  const staffKpis = useMemo(() => {
    return [
      { label: "Total Employees", value: employees.length, color: "blue", icon: "users" },
      { label: "Active Accounts", value: employees.filter(e => e.has_system_account && e.account_is_active).length, color: "green", icon: "check" },
      { label: "Online Now", value: employees.filter(e => e.is_online).length, color: "amber", icon: "clock" },
      { label: "Registry Pending", value: employees.filter(e => !e.has_system_account).length, color: "purple", icon: "calendar" }
    ];
  }, [employees]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="sfx-stack">
      {!hideHeader && (
        <SectionHead
          title="Employee Registry"
          subtitle="Manage restaurant staff accounts and roles"
        />
      )}

      <div className="sfx-kpis mb-2" aria-label="Staff summary">
        {staffKpis.map((kpi, idx) => (
          <article key={idx} className={`sfx-kpi sfx-kpi--${kpi.color}`}>
            <div className="sfx-kpi__top">
              <span className="sfx-kpi__icon" aria-hidden="true"><Icon name={kpi.icon} size={18} /></span>
            </div>
            <p className="sfx-kpi__value">{kpi.value}</p>
            <p className="sfx-kpi__label">{kpi.label}</p>
          </article>
        ))}
      </div>

      <div className="sfx-card sfx-card--overflow-visible" style={{ background: "#ffffff", padding: "24px", borderRadius: "14px", boxShadow: "0 6px 32px rgba(31,26,23,0.04)" }}>
        <header className="sfx-card__head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <h3 className="sfx-card__title" style={{ color: "#1a1a1a", fontSize: 20, margin: 0 }}>Staff Registry</h3>
            <p className="sfx-muted" style={{ fontSize: 13, margin: "4px 0 0" }}>Active employees and roles</p>
          </div>
          <span className="sfx-muted" style={{ fontSize: 13 }}>{employees.length} employees</span>
        </header>

        {/* Redesigned Search & Filter Dropdown Row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", marginBottom: "20px", width: "100%" }}>
          <div style={{ flex: 1, maxWidth: "480px" }}>
            <SearchField
              placeholder="Search name, email, title, department…"
              value={searchQ}
              onChange={setSearchQ}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ position: "relative" }}>
              <select
                value={filterTab}
                onChange={(e) => setFilterTab(e.target.value)}
                style={{
                  padding: "9px 34px 9px 16px",
                  borderRadius: "10px",
                  border: "1px solid rgba(0,0,0,0.08)",
                  background: "#f9fafb",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#111",
                  outline: "none",
                  cursor: "pointer",
                  appearance: "none",
                  transition: "all 0.2s ease",
                  boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)"
                }}
                onMouseOver={e => e.currentTarget.style.background = "#fff"}
                onMouseOut={e => e.currentTarget.style.background = "#f9fafb"}
              >
                <option value="all">All Statuses</option>
                <option value="with">With Account</option>
                <option value="without">Without Account</option>
              </select>
              <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#666" }}>
                <Icon name="chevron-down" size={14} />
              </span>
            </div>
            <Button 
              variant="primary" 
              onClick={openNew} 
              style={{ 
                background: "linear-gradient(135deg, #111 0%, #333 100%)", 
                border: "none", 
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)", 
                borderRadius: "10px", 
                padding: "9px 24px",
                fontWeight: 600,
                letterSpacing: "0.01em",
                color: "#fff"
              }}
            >
              + Add Staff
            </Button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Loading employees…</div>
        ) : filtered.length === 0 ? (
          <EmptyState message="No employees match your filter." />
        ) : (
          <div className="sfx-table-wrap">
            <table className="sfx-table sfx-table--hover" style={{ background: "#ffffff" }}>
              <thead>
                <tr style={{ background: "#ffffff" }}>
                  <th style={{ color: "#000", fontSize: 13, textTransform: "uppercase", verticalAlign: "middle", width: "40px", textAlign: "center" }}>#</th>
                  <th style={{ color: "#000", fontSize: 13, textTransform: "uppercase", verticalAlign: "middle" }}>Name</th>
                  <th style={{ color: "#000", fontSize: 13, textTransform: "uppercase", verticalAlign: "middle" }}>Role</th>
                  {showSalary && <th style={{ color: "#000", fontSize: 13, textTransform: "uppercase", verticalAlign: "middle" }}>Salary</th>}
                  <th style={{ color: "#000", fontSize: 13, textTransform: "uppercase", verticalAlign: "middle" }}>Account Status</th>
                  <th style={{ color: "#000", fontSize: 13, textTransform: "uppercase", verticalAlign: "middle" }}>Online Status</th>
                  <th style={{ color: "#000", fontSize: 13, textTransform: "uppercase", verticalAlign: "middle", textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <motion.tbody variants={listContainerVariants} initial="hidden" animate="visible">
                {filtered.map((emp, index) => {
                  const isSelf = emp.user_id === currentUser?.user_id || emp.user_id === currentUser?.id;
                  const isSystemAdmin = emp.job_title_id === 1;

                  return (
                    <motion.tr
                      key={emp.staff_id}
                      variants={listItemVariants}
                      style={{ borderBottom: "1px solid var(--border-subtle, #f0f0f0)", verticalAlign: "middle", transition: "background 0.2s" }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-hover, #fafafa)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      <td style={{ padding: "20px", textAlign: "center", fontWeight: "600", color: "var(--text-muted, #777)" }}>
                        {index + 1}
                      </td>
                      <td style={{ padding: "20px" }}>
                        <div style={{ fontWeight: "600", color: "var(--text-main, #111)" }}>{fmt(emp.full_name)}</div>
                        <div style={{ fontSize: "13px", color: "var(--text-muted, #777)", marginTop: "4px" }}>{fmt(emp.email)}</div>
                        {emp.phone && <div style={{ fontSize: "12px", color: "var(--text-muted, #999)", marginTop: "2px" }}>{emp.phone}</div>}
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <select
                          value={emp.job_title_id || ""}
                          onChange={(e) => handleQuickJobTitleChange(emp, Number(e.target.value))}
                          disabled={isSelf || isSystemAdmin || saving}
                          style={{
                            padding: "6px 10px",
                            border: "1px solid var(--border-subtle, #eaeaea)",
                            fontSize: "13px",
                            color: "var(--text-main, #333)",
                            cursor: (isSelf || isSystemAdmin) ? "not-allowed" : "pointer",
                            fontWeight: "500"
                          }}
                        >
                          <option value="" disabled>— Select Job —</option>
                          {jobTitles.map(jt => (
                            <option key={jt.job_title_id} value={jt.job_title_id}>
                              {jt.title_name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {showSalary && <td style={{ padding: "16px 20px", fontFamily: "monospace", color: "var(--text-main, #333)" }}>{fmtSalary(emp.salary)}</td>}
                      <td style={{ padding: "16px 20px" }}>
                        {emp.has_system_account ? (
                          <button
                            onClick={() => handleQuickActiveToggle(emp, !emp.account_is_active)}
                            disabled={isSelf || isSystemAdmin}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "4px 12px",
                              borderRadius: "99px",
                              fontSize: "12px",
                              fontWeight: "600",
                              border: "1px solid",
                              cursor: (isSelf || isSystemAdmin) ? "not-allowed" : "pointer",
                              outline: "none",
                              transition: "all 0.2s ease",
                              background: emp.account_is_active ? "#ecfdf5" : "#fff1f2",
                              color: emp.account_is_active ? "#047857" : "#b91c1c",
                              borderColor: emp.account_is_active ? "#a7f3d0" : "#fecdd3"
                            }}
                            title="Click to toggle status"
                          >
                            <span style={{
                              display: "inline-block",
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              marginRight: "6px",
                              background: emp.account_is_active ? "#10b981" : "#ef4444"
                            }} />
                            {emp.account_is_active ? "Active" : "Suspended"}
                          </button>
                        ) : (
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "4px 12px",
                            borderRadius: "99px",
                            fontSize: "12px",
                            fontWeight: "600",
                            border: "1px solid #e2e8f0",
                            background: "#f1f5f9",
                            color: "#64748b"
                          }}>
                            <span style={{
                              display: "inline-block",
                              width: "6px",
                              height: "6px",
                              borderRadius: "50%",
                              marginRight: "6px",
                              background: "#94a3b8"
                            }} />
                            No Account
                          </span>
                        )}
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{
                            display: "inline-block", width: "8px", height: "8px", borderRadius: "50%",
                            background: emp.is_online ? "#2f7d4f" : "#9e9e9e"
                          }} />
                          <span style={{ fontWeight: "600", color: emp.is_online ? "#2f7d4f" : "var(--text-muted, #999)" }}>
                            {emp.is_online ? "Online" : "Offline"}
                          </span>
                        </div>
                        {emp.is_online && emp.online_since && (
                          <div style={{ fontSize: "11px", color: "var(--text-muted, #999)", marginTop: "2px" }}>
                            Since {new Date(emp.online_since).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "16px 20px" }}>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "nowrap" }}>
                          <Button size="sm" onClick={() => openEdit(emp)} style={{ background: "#fff", color: "#111", borderRadius: "8px", fontWeight: 600, border: "1px solid #d1d5db", padding: "6px 14px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>Edit</Button>
                          <Button size="sm" onClick={() => openReview(emp)} style={{ background: "#fff", color: "#111", borderRadius: "8px", fontWeight: 600, border: "1px solid #d1d5db", padding: "6px 14px", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>Review</Button>
                          {!isSystemAdmin && !isSelf && (
                            <Button size="sm" onClick={() => handleDeleteEmployee(emp)} disabled={saving} style={{ background: "#fef2f2", color: "#ef4444", borderRadius: "8px", fontWeight: 600, border: "1px solid #fecaca", padding: "6px 14px" }}>
                              Delete
                            </Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </motion.tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / New Employee Modal */}
      {editModal !== null && (
        <ManagerModal
          size="lg"
          title={isNew ? "Add New Staff" : "Edit Staff"}
          onClose={() => setEditModal(null)}
          footer={
            <div style={{ display: "flex", gap: "12px", width: "100%", justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setEditModal(null)} style={{ borderRadius: "10px", padding: "8px 20px", fontWeight: 600, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569" }}>Cancel</Button>
              <Button 
                onClick={handleSaveEmployee} 
                disabled={saving}
                style={{ 
                  borderRadius: "10px", 
                  padding: "8px 28px", 
                  fontWeight: 600,
                  background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                  border: "none",
                  boxShadow: "0 4px 14px rgba(99, 102, 241, 0.3)",
                  color: "#ffffff"
                }}
              >
                {saving ? "Saving…" : "Save Staff"}
              </Button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "4px 0" }}>
            
            <div style={{ display: "flex", gap: "16px" }}>
              <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#333" }}>
                <div>Full Name <span style={{ color: "#ef4444" }}>*</span></div>
                <input 
                  className="modal-input" 
                  value={editForm.full_name}
                  placeholder="e.g. Nguyen Van A"
                  style={{ borderRadius: "10px", border: "1px solid #e2e8f0", padding: "12px", fontSize: "14px", transition: "all 0.2s" }}
                  onFocus={e => e.target.style.borderColor = "#6366f1"}
                  onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                  onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} 
                />
              </label>

              <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#333" }}>
                <div>Phone Number</div>
                <input 
                  className="modal-input" 
                  value={editForm.phone}
                  placeholder="+84..."
                  style={{ borderRadius: "10px", border: "1px solid #e2e8f0", padding: "12px", fontSize: "14px", transition: "all 0.2s" }}
                  onFocus={e => e.target.style.borderColor = "#6366f1"}
                  onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                  onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} 
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#333" }}>
                <div>Job Title <span style={{ color: "#ef4444" }}>*</span></div>
                <div style={{ position: "relative" }}>
                  <select 
                    className="modal-input" 
                    value={editForm.job_title_id}
                    style={{ borderRadius: "10px", border: "1px solid #e2e8f0", padding: "12px", fontSize: "14px", width: "100%", appearance: "none", cursor: "pointer", background: "#f8fafc" }}
                    onChange={e => {
                      const newTitleId = e.target.value;
                      const newTitle = jobTitles.find(t => String(t.job_title_id) === String(newTitleId));
                      setEditForm(f => {
                        const updated = { ...f, job_title_id: newTitleId };
                        // Auto-populate email from name if new role requires access and email is empty
                        if (newTitle?.requires_system_access && !stripDomain(f.email)) {
                          const suggested = slugifyName(f.full_name);
                          if (suggested) updated.email = suggested;
                        }
                        return updated;
                      });
                    }}
                  >
                    <option value="" disabled>Select Role...</option>
                    {jobTitles.map(jt => (
                      <option key={jt.job_title_id} value={jt.job_title_id}>
                        {jt.title_name}
                      </option>
                    ))}
                  </select>
                  <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#94a3b8" }}>▼</span>
                </div>
              </label>

              <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#333" }}>
                <div>Status</div>
                <div style={{ position: "relative" }}>
                  <select 
                    className="modal-input" 
                    value={editForm.employment_status}
                    style={{ borderRadius: "10px", border: "1px solid #e2e8f0", padding: "12px", fontSize: "14px", width: "100%", appearance: "none", cursor: "pointer", background: "#f8fafc" }}
                    onChange={e => setEditForm(f => ({ ...f, employment_status: e.target.value }))}>
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Resigned">Resigned</option>
                  </select>
                  <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#94a3b8" }}>▼</span>
                </div>
              </label>
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#333" }}>
                <div>Department</div>
                <div style={{ position: "relative" }}>
                  <select 
                    className="modal-input" 
                    value={editForm.department}
                    style={{ borderRadius: "10px", border: "1px solid #e2e8f0", padding: "12px", fontSize: "14px", width: "100%", appearance: "none", cursor: "pointer", background: "#f8fafc" }}
                    onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}
                  >
                    <option value="" disabled>Select Department...</option>
                    <option value="Service">Service</option>
                    <option value="Kitchen">Kitchen</option>
                    <option value="Bar">Bar</option>
                    <option value="Management">Management</option>
                    <option value="Operations">Operations</option>
                    <option value="Administration">Administration</option>
                  </select>
                  <span style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#94a3b8" }}>▼</span>
                </div>
              </label>

              {showSalary ? (
                <label style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#333" }}>
                  <div>Salary (VND)</div>
                  <input 
                    className="modal-input" 
                    type="number" 
                    value={editForm.salary}
                    placeholder="e.g. 15000000"
                    style={{ borderRadius: "10px", border: "1px solid #e2e8f0", padding: "12px", fontSize: "14px", fontFamily: "monospace", transition: "all 0.2s" }}
                    onFocus={e => e.target.style.borderColor = "#6366f1"}
                    onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                    onChange={e => setEditForm(f => ({ ...f, salary: e.target.value }))} 
                  />
                </label>
              ) : (
                <div style={{ flex: 1 }} />
              )}
            </div>

            {/* Apple-style Animated Section for Roles requiring System Access */}
            {(() => {
              const selectedJobTitle = jobTitles.find(t => String(t.job_title_id) === String(editForm.job_title_id));
              const requiresSystemAccess = selectedJobTitle?.requires_system_access;
              
              return (
                <div style={{
                  overflow: "hidden",
                  transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                  height: requiresSystemAccess ? "auto" : "0px",
                  opacity: requiresSystemAccess ? 1 : 0,
                  transform: requiresSystemAccess ? "translateY(0)" : "translateY(-10px)",
                  pointerEvents: requiresSystemAccess ? "auto" : "none"
                }}>
                  <div style={{ 
                    background: "rgba(99, 102, 241, 0.04)", 
                    border: "1px solid rgba(99, 102, 241, 0.15)", 
                    borderRadius: "12px", 
                    padding: "20px",
                    display: "flex", 
                    flexDirection: "column", 
                    gap: "16px",
                    marginTop: "4px",
                    marginBottom: "4px"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#4f46e5", fontWeight: 600, fontSize: "13px" }}>
                      <span style={{ display: "inline-flex", background: "#4f46e5", color: "#fff", width: "18px", height: "18px", borderRadius: "50%", alignItems: "center", justifyContent: "center", fontSize: "10px" }}>✓</span>
                      Role requires System Access. Account will be auto-provisioned.
                    </div>
                    
                    <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#333" }}>
                      <div>Corporate Email</div>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 0,
                        border: "1px solid #c7d2fe",
                        borderRadius: "10px", overflow: "hidden",
                        background: "#fff",
                        boxShadow: "0 2px 8px rgba(99, 102, 241, 0.05)",
                        transition: "border-color 0.2s",
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = "#6366f1"}
                      onBlur={e => e.currentTarget.style.borderColor = "#c7d2fe"}
                      >
                        <input
                          className="modal-input"
                          style={{
                            border: "none", outline: "none", flex: 1,
                            borderRadius: "10px 0 0 10px", margin: 0,
                            padding: "12px 14px",
                            fontSize: "14px",
                            fontWeight: 500
                          }}
                          placeholder="username"
                          value={stripDomain(editForm.email)}
                          onChange={e => {
                            const val = e.target.value.replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase();
                            setEditForm(f => ({ ...f, email: val }));
                          }}
                        />
                        <span style={{
                          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                          color: "#fff",
                          padding: "12px 16px",
                          fontSize: "14px",
                          fontWeight: 600,
                          letterSpacing: "0.01em",
                          whiteSpace: "nowrap",
                          userSelect: "none",
                          borderRadius: "0 10px 10px 0",
                        }}>@{CORPORATE_DOMAIN}</span>
                      </div>
                    </label>

                    {(!editModal || !editModal.has_system_account) && (
                      <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#333" }}>
                        <div>Initial Password</div>
                        <input 
                          className="modal-input" 
                          type="password" 
                          placeholder="Leave blank to auto-generate and email" 
                          value={editForm.password || ""}
                          style={{ borderRadius: "10px", border: "1px solid #c7d2fe", padding: "12px", fontSize: "14px", background: "#fff", transition: "all 0.2s" }}
                          onFocus={e => e.target.style.borderColor = "#6366f1"}
                          onBlur={e => e.target.style.borderColor = "#c7d2fe"}
                          onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} 
                        />
                      </label>
                    )}
                  </div>
                </div>
              );
            })()}
            
          </div>
        </ManagerModal>
      )}

      {/* Grant System Access Modal */}
      {grantModal !== null && (
        <ManagerModal
          title={`Grant Access — ${grantModal.full_name}`}
          onClose={() => setGrantModal(null)}
          footer={
            <div style={{ display: "flex", gap: "12px", width: "100%", justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setGrantModal(null)}>Cancel</Button>
              <Button onClick={handleGrant} disabled={saving} style={{ borderRadius: "10px", background: "linear-gradient(135deg, #111 0%, #333 100%)", color: "#fff", border: "none" }}>
                {saving ? "Granting…" : "Grant Access"}
              </Button>
            </div>
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
          size="lg"
          title={`Performance Review — ${reviewModal.full_name}`}
          onClose={() => setReviewModal(null)}
          footer={
            <div style={{ display: "flex", gap: "12px", width: "100%", justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setReviewModal(null)} style={{ borderRadius: "10px", padding: "8px 20px", fontWeight: 600, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569" }}>Cancel</Button>
              <Button 
                onClick={handleSaveReview} 
                disabled={saving}
                style={{ 
                  borderRadius: "10px", 
                  padding: "8px 28px", 
                  fontWeight: 600,
                  background: "linear-gradient(135deg, #111 0%, #333 100%)",
                  border: "none",
                  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.2)",
                  color: "#ffffff"
                }}
              >
                {saving ? "Saving…" : "Save Review"}
              </Button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "4px 0" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#333" }}>
              <div>Rating (1.0 – 5.0) <span style={{ color: "#ef4444" }}>*</span></div>
              <input 
                className="modal-input" 
                type="number" min="1" max="5" step="0.1"
                value={reviewForm.rating}
                style={{ borderRadius: "10px", border: "1px solid #e2e8f0", padding: "12px", fontSize: "14px", transition: "all 0.2s" }}
                onFocus={e => e.target.style.borderColor = "#111"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                onChange={e => setReviewForm(f => ({ ...f, rating: e.target.value }))} 
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px", fontWeight: 600, color: "#333" }}>
              <div>Review Notes</div>
              <textarea 
                className="modal-input" 
                rows={4} 
                value={reviewForm.notes}
                style={{ borderRadius: "10px", border: "1px solid #e2e8f0", padding: "12px", fontSize: "14px", transition: "all 0.2s", resize: "vertical" }}
                onFocus={e => e.target.style.borderColor = "#111"}
                onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                onChange={e => setReviewForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes about this review period…" 
              />
            </label>
          </div>
        </ManagerModal>
      )}

      {/* Delete Staff Confirmation Modal */}
      {deleteConfirmModal !== null && (
        <ManagerModal
          title="Confirm Deletion"
          onClose={() => setDeleteConfirmModal(null)}
          footer={
            <div style={{ display: "flex", gap: "12px", width: "100%", justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setDeleteConfirmModal(null)} style={{ borderRadius: "10px", padding: "8px 20px", fontWeight: 600, background: "#f1f5f9", border: "1px solid #e2e8f0", color: "#475569" }}>
                Cancel
              </Button>
              <Button
                disabled={saving}
                onClick={confirmDelete}
                style={{
                  borderRadius: "10px", padding: "8px 28px", fontWeight: 600,
                  background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  border: "none", color: "#fff", boxShadow: "0 4px 14px rgba(239, 68, 68, 0.3)"
                }}
              >
                {saving ? "Deleting…" : "Delete Staff"}
              </Button>
            </div>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{
              background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "8px", padding: "14px", fontSize: "14px", lineHeight: "1.6", color: "#b91c1c"
            }}>
              Are you sure you want to delete <strong>{deleteConfirmModal.full_name}</strong>?
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
              This action cannot be undone. All data associated with this employee will be permanently removed.
            </p>
          </div>
        </ManagerModal>
      )}

    </div>
  );
}

export default StaffSection;
