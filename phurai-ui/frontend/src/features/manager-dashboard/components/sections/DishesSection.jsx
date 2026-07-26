import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ManagerModal } from "../ManagerOverlay.jsx";
import {
  SectionHead,
  ContentPanel,
  Toolbar,
  SearchField,
  StatusBadge,
  Button,
  EmptyState,
  NotConnectedNote,
} from "../ManagerUI.jsx";
import { DISH_CATEGORIES } from "@/shared/constants.js";
import KpiCard from "../KpiCard.jsx";
import { Pagination } from "@/components/ui/Pagination.jsx";
import { asArray } from "@/core/utils/asArray.js";
import { formatVND } from "@/core/utils/formatCurrency.js";
import { getMenuTabFromSearch } from "../../config/managerRoutes.js";
import { addDish, updateDish, deleteDish } from "../../services/managerApi.js";
import { loadAuthUser } from "@/core/api/httpClient.js";

const EMPTY = {
  dish_name: "",
  category_name: DISH_CATEGORIES[0],
  price: 0,
  is_available: true,
  is_recommended: false,
  is_preorderable: true,
  spicy_level: 0,
  prep_minutes: 10,
  description: "",
  image_url: "",
};

function DishesSection({ dishes, setDishes, bestSellers, pendingAction, role, toast, dishSource }) {
  const dishList = asArray(dishes);
  const bestSellerList = asArray(bestSellers);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(
    () => getMenuTabFromSearch(`?${searchParams.toString()}`),
    [searchParams]
  );

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formError, setFormError] = useState("");
  const [imageError, setImageError] = useState(false);

  const triggerFormError = (msg) => {
    setFormError(msg);
    if (window._formErrTimer) clearTimeout(window._formErrTimer);
    window._formErrTimer = setTimeout(() => {
      setFormError("");
    }, 5000);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, cat, tab]);
  const currentUser = loadAuthUser();
  const isManager = role === "manager";

  const selectTab = (nextTab) => {
    if (nextTab === "best") {
      setSearchParams({ tab: "best" }, { replace: true });
      return;
    }
    setSearchParams({}, { replace: true });
  };

  useEffect(() => {
    if (pendingAction === "add" && isManager) {
      setEditing({ ...EMPTY });
      setIsNew(true);
    }
  }, [pendingAction, isManager]);

  const filtered = useMemo(() => {
    let list = dishList;
    if (cat !== "all") list = list.filter((d) => d.category_name === cat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (d) =>
          d.dish_name?.toLowerCase().includes(q) ||
          d.category_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [dishList, cat, search]);

  const totalResults = filtered.length;
  const totalPages = Math.ceil(totalResults / ITEMS_PER_PAGE) || 1;
  const paginatedDishes = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const save = async () => {
    setFormError("");

    // Test case 1: Dish name
    if (!editing?.dish_name || !editing.dish_name.trim()) {
      triggerFormError("⚠️ Lỗi: Tên món ăn bắt buộc phải nhập và không được để trống!");
      return;
    }
    // Test case 2: Price
    if (editing.price === "" || editing.price === null || isNaN(Number(editing.price)) || Number(editing.price) < 0) {
      triggerFormError("⚠️ Lỗi: Giá món ăn phải là số hợp lệ lớn hơn hoặc bằng 0 VND!");
      return;
    }
    // Test case 3: Prep time
    if (editing.prep_minutes !== "" && (isNaN(Number(editing.prep_minutes)) || Number(editing.prep_minutes) < 0)) {
      triggerFormError("⚠️ Lỗi: Thời gian chuẩn bị món ăn không hợp lệ!");
      return;
    }

    const clean = {
      name: editing.dish_name,
      category: editing.category_name,
      price: Number(editing.price) || 0,
      prep_time_minutes: Number(editing.prep_minutes) > 0 ? Number(editing.prep_minutes) : null,
      spicy_level: Number(editing.spicy_level) || 0,
      is_available: editing.is_available,
      is_recommended: editing.is_recommended,
      is_preorderable: editing.is_preorderable,
      description: editing.description || "",
      image_url: editing.image_url || "",
    };

    try {
      setSubmitting(true);
      if (isNew) {
        const res = await addDish(clean, currentUser?.user_id);
        setDishes((prev) => [...prev, { ...editing, dish_id: res.dish_id, prep_minutes: clean.prep_time_minutes }]);
        toast("Dish added successfully", "success");
      } else {
        await updateDish(editing.dish_id, clean, currentUser?.user_id);
        setDishes((prev) => prev.map((d) => (d.dish_id === editing.dish_id ? { ...d, ...editing, prep_minutes: clean.prep_time_minutes } : d)));
        toast("Dish updated successfully", "success");
      }
      setEditing(null);
    } catch (err) {
      triggerFormError(`⚠️ Lỗi từ hệ thống: ${err.message || "Không thể lưu thông tin món ăn"}`);
      toast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    try {
      setSubmitting(true);
      await deleteDish(confirmDel.dish_id, currentUser?.user_id);
      setDishes((prev) => prev.filter((d) => d.dish_id !== confirmDel.dish_id));
      toast("Dish removed successfully", "success");
      setConfirmDel(null);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const totalDishesCount = dishList.length;
  const availableDishesCount = useMemo(() => dishList.filter((d) => d.is_available).length, [dishList]);

  const kpis = [
    {
      id: "total_dishes",
      label: "Total Dishes",
      value: totalDishesCount,
      format: "number",
      icon: "dish",
      accent: "amber",
      trend: { dir: "up", text: "Active Menu Items" },
    },
    {
      id: "available_dishes",
      label: "Available Dishes",
      value: availableDishesCount,
      format: "number",
      suffix: ` / ${totalDishesCount}`,
      icon: "check",
      accent: "green",
      trend: { dir: "up", text: "Ready to Serve" },
    },
  ];

  return (
    <div className="sfx-stack">
      {/* 2 KPI Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(240px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        {kpis.map((c, i) => (
          <KpiCard key={c.id} card={c} index={i} />
        ))}
      </div>

      <div className="sfx-card" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* Equalized Filter & Actions Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div className="sfx-tabs" role="tablist" aria-label="Menu views" style={{ marginBottom: 0 }}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "list"}
              className={`sfx-tab ${tab === "list" ? "is-active" : ""}`}
              onClick={() => selectTab("list")}
            >
              Dish List ({dishList.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "best"}
              className={`sfx-tab ${tab === "best" ? "is-active" : ""}`}
              onClick={() => selectTab("best")}
            >
              Best-selling ({bestSellerList.length})
            </button>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            {tab === "list" && (
              <>
                <div style={{ width: "220px" }}>
                  <SearchField value={search} onChange={setSearch} placeholder="Search dishes…" />
                </div>
                <select className="sfx-select" value={cat} onChange={(e) => setCat(e.target.value)} style={{ minWidth: "150px" }}>
                  <option value="all">All categories</option>
                  {DISH_CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </>
            )}

            {isManager ? (
              <Button variant="gold" icon="plus" onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); }}>
                Add Dish
              </Button>
            ) : null}
          </div>
        </div>

        {tab === "list" ? (
          <>
            <div className="sfx-card sfx-card--flush" style={{ overflow: "hidden" }}>
              <div className="sfx-table-wrap">
                <table className="sfx-table sfx-table--hover">
                  <thead>
                    <tr>
                      <th>Dish</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Prep</th>
                      <th>Status</th>
                      {isManager ? <th className="sfx-table__right">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDishes.map((d) => (
                      <tr key={d.dish_id}>
                        <td>
                          <div className="sfx-dishcell" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            {d.image_url ? (
                              <img
                                src={d.image_url}
                                alt={d.dish_name}
                                style={{ width: "38px", height: "38px", borderRadius: "8px", objectFit: "cover", border: "1px solid rgba(0,0,0,0.08)", boxShadow: "0 2px 6px rgba(0,0,0,0.05)" }}
                                onError={(e) => { e.target.style.display = "none"; }}
                              />
                            ) : (
                              <span className="sfx-thumb" style={{ width: "38px", height: "38px", borderRadius: "8px", background: "#f4efe6", color: "#9f8655", fontWeight: "700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>
                                {d.dish_name[0]}
                              </span>
                            )}
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <strong style={{ fontSize: "13.5px", color: "#111827", fontWeight: "600" }}>{d.dish_name}</strong>
                              {d.is_recommended ? (
                                <span style={{ fontSize: "11px", fontWeight: "600", color: "#9f8655", display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "2px" }}>
                                  ★ Recommended
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontWeight: "500" }}>{d.category_name}</td>
                        <td style={{ fontWeight: "600" }}>{formatVND(d.price)}</td>
                        <td>{d.prep_minutes ? `${d.prep_minutes}m` : "—"}</td>
                        <td>
                          <StatusBadge tone={d.is_available ? "green" : "muted"}>
                            {d.is_available ? "Available" : "Unavailable"}
                          </StatusBadge>
                        </td>
                        {isManager ? (
                          <td className="sfx-table__right">
                            <div className="sfx-rowacts">
                              <Button size="sm" variant="ghost" icon="edit" onClick={() => { setEditing({ ...d }); setIsNew(false); }}>
                                Edit
                              </Button>
                              <Button size="sm" variant="ghost" icon="trash" onClick={() => setConfirmDel(d)} />
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    ))}

                    {!filtered.length ? (
                      <tr>
                        <td colSpan={isManager ? 6 : 5}>
                          <EmptyState
                            icon="dish"
                            title="No dishes found"
                            hint={search || cat !== "all" ? "Try adjusting search filters" : "Click Add Dish to create one"}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>

              {/* Showing X to Y of Z results & Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalCount={totalResults}
                limit={ITEMS_PER_PAGE}
              />
            </div>
          </>
        ) : (
          <div className="sfx-card">
            <header className="sfx-card__head">
              <h3 className="sfx-card__title">Best-selling Dishes</h3>
              <span className="sfx-muted">Ranked by revenue · sample</span>
            </header>
            <div className="sfx-card__body">
              <div className="sfx-table-wrap">
                <table className="sfx-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Dish</th>
                      <th>Qty sold</th>
                      <th>Revenue</th>
                      <th>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestSellerList.map((d) => {
                      const max = Math.max(...bestSellerList.map((b) => b.revenue));
                      return (
                        <tr key={d.rank}>
                          <td><span className="sfx-rank__no">{d.rank}</span></td>
                          <td><strong>{d.dish_name}</strong></td>
                          <td>{d.qty_sold}</td>
                          <td>{formatVND(d.revenue)}</td>
                          <td className="sfx--cell">
                            <span className="sfx-">
                              <span className="sfx-__fill" style={{ width: `${(d.revenue / max) * 100}%` }} />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      <ManagerModal
        open={Boolean(editing)}
        title={isNew ? "Add Dish" : `Edit ${editing?.dish_name || "Dish"}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            {!isNew ? (
              <Button variant="danger" icon="trash" onClick={() => { setConfirmDel(editing); setEditing(null); }}>
                Delete
              </Button>
            ) : <span />}
            <div className="sfx-modal__footacts">
              <Button variant="ghost" onClick={() => setEditing(null)} disabled={submitting}>Cancel</Button>
              <Button variant="gold" onClick={save} disabled={submitting}>{isNew ? "Add dish" : "Save changes"}</Button>
            </div>
          </>
        }
      >
        {editing ? (
          <div className="sfx-form">
            {/* Red Alert Banner displaying errors auto-hiding in 5s */}
            {formError ? (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "16px",
                color: "#b91c1c",
                fontSize: "13px",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                justify: "space-between",
                boxShadow: "0 2px 4px rgba(220,38,38,0.1)",
              }}>
                <span>{formError}</span>
                <span style={{ fontSize: "11px", color: "#ef4444", fontWeight: "normal", marginLeft: "12px" }}>Tự ẩn sau 5s</span>
              </div>
            ) : null}

            <label className="sfx-field">
              <span>Dish name *</span>
              <input
                value={editing.dish_name}
                onChange={(e) => {
                  setEditing({ ...editing, dish_name: e.target.value });
                  setFormError("");
                }}
                placeholder="e.g. Truffle Udon"
              />
            </label>
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Category</span>
                <select value={editing.category_name} onChange={(e) => setEditing({ ...editing, category_name: e.target.value })}>
                  {DISH_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="sfx-field">
                <span>Price (VND) *</span>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={editing.price}
                  onChange={(e) => {
                    setEditing({ ...editing, price: e.target.value });
                    setFormError("");
                  }}
                />
              </label>
            </div>
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Prep time (min)</span>
                <input
                  type="number"
                  min="0"
                  value={editing.prep_minutes}
                  onChange={(e) => {
                    setEditing({ ...editing, prep_minutes: e.target.value });
                    setFormError("");
                  }}
                />
              </label>
            </div>
            <div className="sfx-form__row">
              <label className="sfx-field sfx-field--full">
                <span>Description</span>
                <textarea
                  value={editing.description || ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  placeholder="A short description of the dish..."
                  rows="2"
                />
              </label>
            </div>
            <div className="sfx-form__row">
              <div className="sfx-field sfx-field--full">
                <span>Dish Image (URL or Drag & Drop File)</span>

                {/* Live Image Preview & Validation Status */}
                {editing.image_url ? (
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    background: imageError ? "#fff5f5" : "#f9fafb",
                    padding: "10px",
                    borderRadius: "8px",
                    border: imageError ? "1px solid #fca5a5" : "1px solid #e5e7eb",
                    marginTop: "6px"
                  }}>
                    <img
                      src={editing.image_url}
                      alt="Dish preview"
                      style={{ width: "54px", height: "54px", objectFit: "cover", borderRadius: "6px", border: "1px solid #ddd" }}
                      onLoad={() => setImageError(false)}
                      onError={() => setImageError(true)}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: "12px", fontWeight: "bold", margin: 0, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {editing.image_url.startsWith("data:") ? "Uploaded Image File" : editing.image_url}
                      </p>
                      {imageError ? (
                        <span style={{ fontSize: "11px", color: "#dc2626", fontWeight: "bold" }}>⚠️ Không thể tải ảnh (URL không tồn tại hoặc lỗi đường dẫn)</span>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#16a34a" }}>✓ Ảnh đã tải thành công</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon="close"
                      onClick={() => {
                        setEditing({ ...editing, image_url: "" });
                        setImageError(false);
                      }}
                      title="Remove image"
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}

                {/* Dual Image Controls: URL Input + File Drag & Drop */}
                <div style={{ display: "flex", gap: "10px", marginTop: "8px", alignItems: "center" }}>
                  <input
                    style={{ flex: 1 }}
                    value={editing.image_url || ""}
                    onChange={(e) => {
                      setEditing({ ...editing, image_url: e.target.value });
                      setImageError(false);
                    }}
                    placeholder="Paste image URL (https://...)..."
                  />
                  <label
                    style={{
                      padding: "8px 14px",
                      background: "#f3f4f6",
                      border: "1px dashed #9ca3af",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "12px",
                      fontWeight: "bold",
                      color: "#374151",
                      whiteSpace: "nowrap",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    📁 Drag / Upload File
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (evt) => {
                            setEditing((prev) => ({ ...prev, image_url: evt.target.result }));
                            setImageError(false);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
            <div className="sfx-toggles">
              <label className="sfx-toggle">
                <input type="checkbox" checked={editing.is_available} onChange={(e) => setEditing({ ...editing, is_available: e.target.checked })} />
                <span>Available</span>
              </label>
              <label className="sfx-toggle">
                <input type="checkbox" checked={editing.is_recommended} onChange={(e) => setEditing({ ...editing, is_recommended: e.target.checked })} />
                <span>Recommended</span>
              </label>
              <label className="sfx-toggle">
                <input type="checkbox" checked={editing.is_preorderable} onChange={(e) => setEditing({ ...editing, is_preorderable: e.target.checked })} />
                <span>Allow Pre-order</span>
              </label>
            </div>
          </div>
        ) : null}
      </ManagerModal>

      <ManagerModal
        open={Boolean(confirmDel)}
        title="Delete dish?"
        size="sm"
        onClose={() => setConfirmDel(null)}
        footer={
          <div className="sfx-modal__footacts">
            <Button variant="ghost" onClick={() => setConfirmDel(null)} disabled={submitting}>Keep</Button>
            <Button variant="danger" icon="trash" onClick={remove} disabled={submitting}>Delete</Button>
          </div>
        }
      >
        <p className="sfx-confirm-text">
          Remove <strong>{confirmDel?.dish_name}</strong> from the menu list? This is a local change only.
        </p>
      </ManagerModal>
    </div>
  );
}

export default DishesSection;
