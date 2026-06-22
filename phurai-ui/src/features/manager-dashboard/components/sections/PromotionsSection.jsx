import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import Icon from "../ManagerIcons.jsx";
import { SectionHead, ContentPanel, Toolbar, SearchField, Button, StatusBadge, EmptyState } from "../ManagerUI.jsx";
import { ManagerModal } from "../ManagerOverlay.jsx";
import { fetchPromotions, createPromotion, togglePromotionStatus, deletePromotion } from "../../services/promotionsApi.js";

export default function PromotionsSection({ promotions, setPromotions, toast }) {
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    promo_code: "",
    discount_type: "PERCENT",
    discount_value: "",
    max_discount_amount: "",
    min_order_value: "0",
    valid_from: "",
    valid_until: "",
    usage_limit: "",
  });

  const loadData = async () => {
    try {
      const res = await fetchPromotions();
      if (res.success) {
        setPromotions(res.data || []);
      }
    } catch (err) {
      toast("Failed to refresh promotions", "error");
    }
  };

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
      toast(err.response?.data?.message || "Failed to delete promotion", "error");
    }
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

      const res = await createPromotion(payload);
      if (res.success) {
        toast("Promotion created successfully", "success");
        setShowAddModal(false);
        setFormData({
          promo_code: "",
          discount_type: "PERCENT",
          discount_value: "",
          max_discount_amount: "",
          min_order_value: "0",
          valid_from: "",
          valid_until: "",
          usage_limit: "",
        });
        loadData();
      }
    } catch (err) {
      toast(err.response?.data?.message || "Failed to create promotion", "error");
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
          <Button variant="primary" icon="plus" onClick={() => setShowAddModal(true)}>
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
                      <td className="font-semibold text-gray-900 dark:text-white">
                        {p.promo_code}
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
                        {p.used_count} / {p.usage_limit || '∞'}
                        {isExhausted && <div className="text-xs text-red-500">Exhausted</div>}
                      </td>
                      <td>
                        {isExpired ? (
                          <StatusBadge tone="danger">Expired</StatusBadge>
                        ) : p.is_active ? (
                          <StatusBadge tone="success">Active</StatusBadge>
                        ) : (
                          <StatusBadge tone="muted">Disabled</StatusBadge>
                        )}
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            className="sfx-iconbtn"
                            title={p.is_active ? "Disable" : "Enable"}
                            onClick={() => handleToggleStatus(p.promotion_id)}
                          >
                            <Icon name={p.is_active ? "pause" : "play"} size={16} />
                          </button>
                          <button
                            className="sfx-iconbtn text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Delete"
                            onClick={() => handleDelete(p.promotion_id)}
                          >
                            <Icon name="trash" size={16} />
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
        onClose={() => !submitting && setShowAddModal(false)}
        title="Create Promotion"
      >
        <form id="addPromoForm" onSubmit={handleSubmit} className="space-y-4 p-1">
          <div>
            <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Promo Code *</label>
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

          <div>
            <label className="block text-sm font-semibold text-[var(--sfx-text)] mb-1.5">Usage Limit (Total uses allowed)</label>
            <input
              type="number"
              min="1"
              className="sfx-input"
              value={formData.usage_limit}
              onChange={e => setFormData({ ...formData, usage_limit: e.target.value })}
              placeholder="Leave empty for unlimited"
            />
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
