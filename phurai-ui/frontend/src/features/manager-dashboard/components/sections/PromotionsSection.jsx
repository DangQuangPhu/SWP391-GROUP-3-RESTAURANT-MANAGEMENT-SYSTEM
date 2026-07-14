import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { listContainerVariants, listItemVariants } from "@/components/ui/Skeleton";
import { format, parseISO } from "date-fns";
import { SectionHead, ContentPanel, Toolbar, SearchField, Button, EmptyState } from "../ManagerUI.jsx";
import { ManagerModal } from "../ManagerOverlay.jsx";
import { fetchPromotions, createPromotion, updatePromotion, togglePromotionStatus, deletePromotion } from "../../services/promotionsApi.js";
import { Copy, Edit2, Trash2, Play, Pause, Star, ShoppingBag, CalendarCheck } from "lucide-react";

const SCOPE_COLORS = {
  Both:        { bg: '#EDE9FE', color: '#7C3AED' },
  Order:       { bg: '#D1FAE5', color: '#065F46' },
  Reservation: { bg: '#DBEAFE', color: '#1E40AF' },
};

function ScopeBadge({ scope }) {
  const s = SCOPE_COLORS[scope] || { bg: '#F3F4F6', color: '#374151' };
  const Icon = scope === 'Order' ? ShoppingBag : scope === 'Reservation' ? CalendarCheck : null;
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: '0.72rem', fontWeight: 700,
      padding: '2px 8px', borderRadius: 99, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      {Icon && <Icon size={10} />}{scope || 'Both'}
    </span>
  );
}

export default function PromotionsSection({ promotions, setPromotions, toast }) {
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingPromoId, setEditingPromoId] = useState(null);

  const [formData, setFormData] = useState({
    promotion_name: "",
    description: "",
    promo_code: "",
    discount_type: "Percent",
    discount_value: "",
    max_discount_amount: "",
    min_order_value: "0",
    valid_from: "",
    valid_until: "",
    usage_limit: "",
    applicable_to: "Both",
    points_required: "0",
    total_quantity: "",
    validity_duration_hours: "24",
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
      discount_type: (promo.discount_type === 'PERCENT' ? 'Percent' : promo.discount_type) || 'Percent',
      discount_value: promo.discount_value?.toString() || "",
      max_discount_amount: promo.max_discount_amount?.toString() || "",
      min_order_value: promo.min_order_value?.toString() || "0",
      valid_from: promo.valid_from ? format(parseISO(promo.valid_from), "yyyy-MM-dd'T'HH:mm") : "",
      valid_until: promo.valid_until ? format(parseISO(promo.valid_until), "yyyy-MM-dd'T'HH:mm") : "",
      usage_limit: promo.usage_limit?.toString() || "",
      applicable_to: ['Both','Order','Reservation'].includes(promo.applicable_to) ? promo.applicable_to : 'Both',
      points_required: promo.points_required?.toString() || "0",
      total_quantity: promo.total_quantity?.toString() || "",
      validity_duration_hours: promo.validity_duration_hours?.toString() || "24",
    });
    setEditingPromoId(promo.promotion_id);
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      promotion_name: "", description: "", promo_code: "",
      discount_type: "Percent", discount_value: "", max_discount_amount: "",
      min_order_value: "0", valid_from: "", valid_until: "",
      usage_limit: "", applicable_to: "Both",
      points_required: "0", total_quantity: "", validity_duration_hours: "24",
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
        points_required: parseInt(formData.points_required, 10) || 0,
        total_quantity: formData.total_quantity ? parseInt(formData.total_quantity, 10) : null,
        validity_duration_hours: parseInt(formData.validity_duration_hours, 10) || 24,
        applicable_to: ['Both','Order','Reservation'].includes(formData.applicable_to) ? formData.applicable_to : 'Both',
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
    (p.promo_code || p.promotion_name || "").toLowerCase().includes(search.toLowerCase())
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
                  <th>Name / Code</th>
                  <th>Discount</th>
                  <th>Scope</th>
                  <th>Points Req.</th>
                  <th>Qty Remaining</th>
                  <th>Voucher Valid</th>
                  <th>Date Range</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <motion.tbody
                variants={listContainerVariants}
                initial="hidden"
                animate="visible"
              >
                {filtered.map(p => {
                  const isExpired = p.valid_until && new Date(p.valid_until) < new Date();
                  const isExhausted = p.usage_limit != null && p.used_count >= p.usage_limit;
                  const inactive = !p.is_active || isExpired || isExhausted;

                  return (
                    <motion.tr
                      key={p.voucher_id || p.promotion_id}
                      variants={listItemVariants}
                      className={inactive ? "opacity-60 grayscale-[50%]" : ""}
                    >
                      {/* Name / Code */}
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 3 }}>{p.promotion_name}</div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
                          background: '#F1F5F9', border: '1px dashed #CBD5E1', borderRadius: 6,
                          padding: '1px 8px', fontFamily: 'monospace', fontSize: '0.78rem', color: '#0F172A' }}>
                          {p.promo_code}
                          <button title="Copy" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: '#64748B', lineHeight: 1 }}
                            onClick={() => { navigator.clipboard.writeText(p.promo_code); toast("Code copied", "success"); }}>
                            <Copy size={11} />
                          </button>
                        </span>
                      </td>
                      {/* Discount */}
                      <td>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {p.discount_type === 'PERCENT' || p.discount_type === 'Percent'
                            ? `${p.discount_value}%` : `₫${Number(p.discount_value).toLocaleString()}`}
                        </span>
                        {p.max_discount_amount > 0 && (
                          <div className="text-xs text-gray-500">Max ₫{Number(p.max_discount_amount).toLocaleString()}</div>
                        )}
                        {p.min_order_value > 0 && (
                          <div className="text-xs text-gray-500">Min ₫{Number(p.min_order_value).toLocaleString()}</div>
                        )}
                      </td>
                      {/* Scope */}
                      <td><ScopeBadge scope={p.applicable_to} /></td>
                      {/* Points Required */}
                      <td>
                        {p.points_required > 0 ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#D97706', fontWeight: 700, fontSize: '0.85rem' }}>
                            <Star size={11} fill="#D97706" />{p.points_required}
                          </span>
                        ) : <span style={{ color: '#10B981', fontWeight: 700, fontSize: '0.8rem' }}>Free</span>}
                      </td>
                      {/* Qty Remaining */}
                      <td style={{ fontSize: '0.85rem' }}>
                        {p.total_quantity != null
                          ? <span><span style={{ fontWeight: 600 }}>{p.remaining_quantity ?? '—'}</span><span style={{ color: '#94A3B8' }}> / {p.total_quantity}</span></span>
                          : <span style={{ color: '#94A3B8' }}>∞</span>}
                      </td>
                      {/* Voucher Valid */}
                      <td style={{ fontSize: '0.85rem', color: '#475569' }}>
                        {p.validity_duration_hours != null ? `${p.validity_duration_hours}h` : '24h'}
                      </td>
                      {/* Date Range */}
                      <td className="text-sm">
                        <div>{p.valid_from ? format(parseISO(p.valid_from), "MMM d, yyyy") : '—'}</div>
                        <div className="text-gray-500">to {p.valid_until ? format(parseISO(p.valid_until), "MMM d, yyyy") : '—'}</div>
                      </td>
                      {/* Status */}
                      <td>
                        {isExpired ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Expired</span>
                        ) : p.is_active ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Active</span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">Disabled</span>
                        )}
                      </td>
                      {/* Actions */}
                      <td className="text-right">
                        <div className="flex justify-end gap-1">
                          <button
                            className="p-1.5 text-gray-500 rounded-md hover:bg-gray-100 hover:text-gray-700 transition-colors"
                            title={p.is_active ? "Disable" : "Enable"}
                            onClick={() => handleToggleStatus(p.voucher_id || p.promotion_id)}
                          >
                            {p.is_active ? <Pause size={15} /> : <Play size={15} />}
                          </button>
                          <button
                            className="p-1.5 text-blue-500 rounded-md hover:bg-blue-50 transition-colors"
                            title="Edit"
                            onClick={() => handleEdit(p)}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className="p-1.5 text-red-500 rounded-md hover:bg-red-50 transition-colors"
                            title="Delete"
                            onClick={() => handleDelete(p.voucher_id || p.promotion_id)}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}

              </motion.tbody>
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
                <option value="Both">Both (Reservation &amp; Order)</option>
                <option value="Reservation">Reservation Only</option>
                <option value="Order">Order Only</option>
              </select>
            </div>
          </div>

          {/* Loyalty Exchange Panel */}
          <div style={{ padding: '12px 16px', background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A' }}>
            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#92400E', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 6 }}>
              <Star size={13} fill="#D97706" color="#D97706" /> Loyalty Exchange Settings
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Points Required</label>
                <input type="number" min="0" step="1" className="sfx-input"
                  value={formData.points_required}
                  onChange={e => setFormData({ ...formData, points_required: e.target.value })}
                  placeholder="0 = free gift" />
                <p style={{ fontSize: '0.68rem', color: '#92400E', marginTop: 2 }}>0 = auto-granted (welcome gift)</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Total Quantity</label>
                <input type="number" min="1" step="1" className="sfx-input"
                  value={formData.total_quantity}
                  onChange={e => setFormData({ ...formData, total_quantity: e.target.value })}
                  placeholder="Empty = unlimited" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Voucher Valid (hours)</label>
                <input type="number" min="1" step="1" className="sfx-input"
                  value={formData.validity_duration_hours}
                  onChange={e => setFormData({ ...formData, validity_duration_hours: e.target.value })}
                  placeholder="24" />
                <p style={{ fontSize: '0.68rem', color: '#92400E', marginTop: 2 }}>After customer redeems</p>
              </div>
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
