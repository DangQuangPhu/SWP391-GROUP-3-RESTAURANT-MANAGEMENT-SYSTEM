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
import { asArray } from "@/utils/asArray.js";
import { formatVND } from "@/utils/formatCurrency.js";
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
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [submitting, setSubmitting] = useState(false);
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
    return dishList.filter((d) => {
      const kw = search.trim().toLowerCase();
      const matchKw = !kw || d.dish_name.toLowerCase().includes(kw);
      const matchCat = cat === "all" || d.category_name === cat;
      return matchKw && matchCat;
    });
  }, [dishList, search, cat]);

  const save = async () => {
    if (!editing.dish_name.trim()) {
      toast("Dish name is required", "error");
      return;
    }
    const clean = {
      name: editing.dish_name,
      category: editing.category_name,
      price: Number(editing.price) || 0,
      prep_time_minutes: Number(editing.prep_minutes) || 0,
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

  const spicy = (lvl) => (lvl > 0 ? "🌶".repeat(lvl) : "—");

  return (
    <div className="sfx-stack">
      <SectionHead
        title="Menu"
        subtitle={dishSource === "api" ? "Live menu data" : "Sample menu data"}
        actions={
          isManager ? (
            <Button variant="gold" icon="plus" onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); }}>
              Add Dish
            </Button>
          ) : null
        }
      />

      <ContentPanel compact>
        <div className="sfx-tabs" role="tablist" aria-label="Menu views">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "list"}
            className={`sfx-tab ${tab === "list" ? "is-active" : ""}`}
            onClick={() => selectTab("list")}
          >
            Dish List
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "best"}
            className={`sfx-tab ${tab === "best" ? "is-active" : ""}`}
            onClick={() => selectTab("best")}
          >
            Best-selling
          </button>
        </div>

        {tab === "list" ? (
          <>
            <Toolbar>
              <SearchField value={search} onChange={setSearch} placeholder="Search dishes…" />
              <select className="sfx-select" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="all">All categories</option>
                {DISH_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Toolbar>

            <div className="sfx-card sfx-card--flush">
              <div className="sfx-table-wrap">
                <table className="sfx-table sfx-table--hover">
                  <thead>
                    <tr>
                      <th>Dish</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Spicy</th>
                      <th>Prep</th>
                      <th>Status</th>
                      {isManager ? <th className="sfx-table__right">Actions</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => (
                      <tr key={d.dish_id}>
                        <td>
                          <div className="sfx-dishcell">
                            <span className="sfx-thumb">{d.dish_name[0]}</span>
                            <span>
                              <strong>{d.dish_name}</strong>
                              {d.is_recommended ? <small className="sfx-tag-gold">Recommended</small> : null}
                            </span>
                          </div>
                        </td>
                        <td>{d.category_name}</td>
                        <td>{formatVND(d.price)}</td>
                        <td>{spicy(d.spicy_level)}</td>
                        <td>{d.prep_minutes}m</td>
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
                  </tbody>
                </table>
              </div>
              {filtered.length === 0 ? <EmptyState title="No dishes found" /> : null}
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

      </ContentPanel>

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
            <label className="sfx-field">
              <span>Dish name</span>
              <input value={editing.dish_name} onChange={(e) => setEditing({ ...editing, dish_name: e.target.value })} placeholder="e.g. Truffle Udon" />
            </label>
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Category</span>
                <select value={editing.category_name} onChange={(e) => setEditing({ ...editing, category_name: e.target.value })}>
                  {DISH_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="sfx-field">
                <span>Price (VND)</span>
                <input type="number" min="0" step="1000" value={editing.price} onChange={(e) => setEditing({ ...editing, price: e.target.value })} />
              </label>
            </div>
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Spicy level (0–3)</span>
                <input type="number" min="0" max="3" value={editing.spicy_level} onChange={(e) => setEditing({ ...editing, spicy_level: Number(e.target.value) })} />
              </label>
              <label className="sfx-field">
                <span>Prep time (min)</span>
                <input type="number" min="0" value={editing.prep_minutes} onChange={(e) => setEditing({ ...editing, prep_minutes: e.target.value })} />
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
              <label className="sfx-field sfx-field--full">
                <span>Image URL</span>
                <input
                  value={editing.image_url || ""}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </label>
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
