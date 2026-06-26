import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { SectionHead, ContentPanel, Toolbar, SearchField, Button, EmptyState } from "../ManagerUI.jsx";
import { ManagerModal } from "../ManagerOverlay.jsx";
import { fetchPromotions, createPromotion, updatePromotion, togglePromotionStatus, deletePromotion } from "../../services/promotionsApi.js";
import { Copy, Edit2, Trash2, Play, Pause } from "lucide-react";

export default function PromotionsSection({ promotions, setPromotions, toast }) {
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState(null);

  const [formData, setFormData] = useState({
    promotion_name: "",
    description: "",
    promo_code: "",
    discount_type: "PERCENT",
    discount_value: "",
    max_discount_amount: "",
    min_order_value: "0",
    valid_from: "",
    valid_until: "",
    usage_limit: "",
    applicable_to: "All",
  });

  const loadData = async () => {
    try {
      const res = await fetchPromotions();
      if (res.success) {
        setPromotions(res.data || []);
      } else {
        toast(res.error || res.message || "Failed to load promotions", "error");
      }
    } catch (err) {
      toast(err.data?.error || err.data?.message || err.message || "Failed to refresh promotions", "error");
    }
  };

  useEffect(() => {
    if (!promotions || promotions.length === 0) {
      loadData();
    }
  }, []);

  const handleToggleStatus = async (id) => {
    try {
      const res = await togglePromotionStatus(id);
      if (res.success) {
        setPromotions(prev => prev.map(p => p.promotion_id === id ? { ...p, is_active: res.is_active } : p));
        toast("Status updated", "success");
      }
    } catch (err) {
      toast("Failed to update status", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this promotion?")) return;
    try {
      const res = await deletePromotion(id);
      if (res.success) {
        setPromotions(prev => prev.filter(p => p.promotion_id !== id));
        toast("Promotion deleted", "success");
      }
    } catch (err) {
      const errorMessage = err.data?.message || err.message || "Failed to delete promotion";
      toast(errorMessage, "error");
    }
  };

  const handleEdit = (promo) => {
    setFormData({
      promotion_name: promo.promotion_name || "",
      description: promo.description || "",
      promo_code: promo.promo_code || "",
      discount_type: promo.discount_type || "PERCENT",
      discount_value: promo.discount_value?.toString() || "",
      max_discount_amount: promo.max_discount_amount?.toString() || "",
      min_order_value: promo.min_order_value?.toString() || "0",
      valid_from: promo.valid_from ? format(parseISO(promo.valid_from), "yyyy-MM-dd'T'HH:mm") : "",
      valid_until: promo.valid_until ? format(parseISO(promo.valid_until), "yyyy-MM-dd'T'HH:mm") : "",
      usage_limit: promo.usage_limit?.toString() || "",
      applicable_to: promo.applicable_to || "All",
    });
    setEditingPromoId(promo.promotion_id);
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      promotion_name: "",
      description: "",
      promo_code: "",
      discount_type: "PERCENT",
      discount_value: "",
      max_discount_amount: "",
      min_order_value: "0",
      valid_from: "",
      valid_until: "",
      usage_limit: "",
      applicable_to: "All",
    });
    setEditingPromoId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        discount_value: parseFloat(formData.discount_value),
        max_discount_amount: formData.max_discount_amount ? parseFloat(formData.max_discount_amount) : null,
        min_order_value: parseFloat(formData.min_order_value) || 0,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit, 10) : null,
      };

      let res;
      if (editingPromoId) {
        res = await updatePromotion(editingPromoId, payload);
      } else {
        res = await createPromotion(payload);
      }

      if (res.success) {
        toast(`Promotion ${editingPromoId ? 'updated' : 'created'} successfully`, "success");
        setShowAddModal(false);
        resetForm();
        loadData();
      }
    } catch (err) {
      const errorMessage = err.data?.message || err.message || `Failed to ${editingPromoId ? 'update' : 'create'} promotion`;
      toast(errorMessage, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = promotions?.filter(Boolean).filter(p =>
    p.promo_code?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="sfx-page">
      <SectionHead
        title="Promotions & Vouchers"
        subtitle="Manage discount codes, vouchers and their lifecycle rules"
        actions={
          <Button variant="primary" icon="plus" onClick={() => { resetForm(); setShowAddModal(true); }}>
            Add Promotion
          </Button>
        }
      />

      <Toolbar>
        <SearchField value={search} onChange={setSearch} placeholder="Search promo code..." />
      </Toolbar>

      <ContentPanel>
        {filtered.length === 0 ? (
          <EmptyState
            icon="tag"
            title="No promotions found"
            hint={search ? "Try a different search term" : "Create your first promotion to boost sales!"}
          />
        ) : (
          <div className="sfx-table-wrap">
            <table className="sfx-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Min Order</th>
                  <th>Valid Range</th>
                  <th>Usage</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const isExpired = new Date(p.valid_until) < new Date();
                  const isExhausted = p.usage_limit !== null && p.used_count >= p.usage_limit;
                  const inactive = !p.is_active || isExpired || isExhausted;

                  return (
                    <tr key={p.promotion_id} className={inactive ? "opacity-60 grayscale-[50%]" : ""}>
                      <td className="font-semibold">
                        <div className="inline-flex items-center gap-2 bg-slate-100 border border-dashed border-slate-300 rounded px-3 py-1 font-mono text-slate-900 text-sm">
                          {p.promo_code}
                        </div>
                      </td>
                      <td>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {p.discount_type === 'PERCENT' ? `${p.discount_value}%` : `₫${p.discount_value.toLocaleString()}`}
                        </span>
                        {p.max_discount_amount && (
                          <div className="text-xs text-gray-500">Max ₫{p.max_discount_amount.toLocaleString()}</div>
                        )}
                      </td>
                      <td>₫{p.min_order_value.toLocaleString()}</td>
                      <td className="text-sm">
                        <div>{format(parseISO(p.valid_from), "MMM d, yyyy")}</div>
                        <div className="text-gray-500">to {format(parseISO(p.valid_until), "MMM d, yyyy")}</div>
                      </td>
                      <td>
                        <div className="flex flex-col gap-1 w-28">
                          <div className="flex justify-between text-xs font-medium text-gray-700">
                            <span>{p.used_count}</span>
                            <span className="text-gray-400">/ {p.usage_limit || '∞'}</span>
                          </div>
                          {p.usage_limit ? (
                            <div className="w-full bg-gray-200 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${isExhausted ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(100, (p.used_count / p.usage_limit) * 100)}%` }}
                              ></div>
                            </div>
                          ) : null}
                          {isExhausted && <span className="text-[10px] text-red-500 font-semibold uppercase tracking-wider">Exhausted</span>}
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                          {p.applicable_to || 'All'}
                        </span>
                      </td>
                      <td>
                        {isExpired ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Expired
                          </span>
                        ) : p.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            className="p-1.5 text-gray-500 rounded-md hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            title="Copy Code"
                            onClick={() => {
                              navigator.clipboard.writeText(p.promo_code);
                              toast("Promo code copied", "success");
                            }}
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            className="p-1.5 text-gray-500 rounded-md hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            title={p.is_active ? "Disable" : "Enable"}
                            onClick={() => handleToggleStatus(p.promotion_id)}
                          >
                            {p.is_active ? <Pause size={16} /> : <Play size={16} />}
                          </button>
                          <button
                            className="p-1.5 text-blue-500 rounded-md hover:bg-blue-50 transition-colors"
                            title="Edit"
                            onClick={() => handleEdit(p)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="p-1.5 text-red-500 rounded-md hover:bg-red-50 transition-colors"
                            title="Delete"
                            onClick={() => handleDelete(p.promotion_id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ContentPanel>

      <ManagerModal
        open={showAddModal}
        onClose={() => {
          if (!submitting) {
            setShowAddModal(false);
            resetForm();
          }
        }}
        title={editingPromoId ? "Edit Promotion" : "Create Promotion"}
      >
        <form id="addPromoForm" onSubmit={handleSubmit} className="space-y-4 p-1">
          <div>
            <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Promotion Name *</label>
            <input
              type="text"
              required
              className="sfx-input"
              value={formData.promotion_name}
              onChange={e => setFormData({ ...formData, promotion_name: e.target.value })}
              placeholder="e.g. Summer Sale 2026"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Description</label>
            <textarea
              className="sfx-input min-h-[80px]"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of the promotion"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Voucher Code *</label>
            <input
              type="text"
              required
              className="sfx-input"
              value={formData.promo_code}
              onChange={e => setFormData({ ...formData, promo_code: e.target.value.toUpperCase() })}
              placeholder="e.g. SUMMER20"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Type *</label>
              <select
                className="sfx-select w-full"
                value={formData.discount_type}
                onChange={e => setFormData({ ...formData, discount_type: e.target.value })}
              >
                <option value="PERCENT">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (₫)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Value *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                className="sfx-input"
                value={formData.discount_value}
                onChange={e => setFormData({ ...formData, discount_value: e.target.value })}
                placeholder={formData.discount_type === 'PERCENT' ? "e.g. 15" : "e.g. 50000"}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {formData.discount_type === 'PERCENT' && (
              <div>
                <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Max Discount (₫)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="sfx-input"
                  value={formData.max_discount_amount}
                  onChange={e => setFormData({ ...formData, max_discount_amount: e.target.value })}
                  placeholder="e.g. 100000"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Min Order Value (₫)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                className="sfx-input"
                value={formData.min_order_value}
                onChange={e => setFormData({ ...formData, min_order_value: e.target.value })}
                placeholder="e.g. 200000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Valid From *</label>
              <input
                type="datetime-local"
                required
                className="sfx-input"
                value={formData.valid_from}
                onChange={e => setFormData({ ...formData, valid_from: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Valid Until *</label>
              <input
                type="datetime-local"
                required
                className="sfx-input"
                value={formData.valid_until}
                onChange={e => setFormData({ ...formData, valid_until: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Usage Limit (Total uses)</label>
              <input
                type="number"
                min="1"
                className="sfx-input"
                value={formData.usage_limit}
                onChange={e => setFormData({ ...formData, usage_limit: e.target.value })}
                placeholder="Empty = unlimited"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Applicable To *</label>
              <select
                className="sfx-select w-full"
                value={formData.applicable_to}
                onChange={e => setFormData({ ...formData, applicable_to: e.target.value })}
              >
                <option value="All">All (Reservation & Order)</option>
                <option value="Reservation">Reservation Only</option>
                <option value="Order">Order Only</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowAddModal(false)} disabled={submitting}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Create Promotion"}
            </Button>
          </div>
        </form>
      </ManagerModal>
    </div>
  );
}
