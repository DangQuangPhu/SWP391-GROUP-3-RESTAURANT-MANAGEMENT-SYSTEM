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
import { DISH_CATEGORIES } from "@/data/staffDashboardMockData.js";
import { formatVND } from "@/utils/formatCurrency.js";

const EMPTY = {
  dish_name: "",
  category_name: DISH_CATEGORIES[0],
  price: 0,
  is_available: true,
  is_recommended: false,
  spicy_level: 0,
  prep_minutes: 10,
};

function DishesSection({ dishes, setDishes, bestSellers, pendingAction, role, toast, dishSource }) {
  const [tab, setTab] = useState("list");
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState(null);
  const [isNew, setIsNew] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const isManager = role === "manager";

  useEffect(() => {
    if (pendingAction === "tab-best") setTab("best");
    if (pendingAction === "add" && isManager) {
      setEditing({ ...EMPTY });
      setIsNew(true);
    }
  }, [pendingAction, isManager]);

  const filtered = useMemo(() => {
    return dishes.filter((d) => {
      const kw = search.trim().toLowerCase();
      const matchKw = !kw || d.dish_name.toLowerCase().includes(kw);
      const matchCat = cat === "all" || d.category_name === cat;
      return matchKw && matchCat;
    });
  }, [dishes, search, cat]);

  const save = () => {
    if (!editing.dish_name.trim()) {
      toast("Dish name is required", "error");
      return;
    }
    const clean = { ...editing, price: Number(editing.price) || 0, prep_minutes: Number(editing.prep_minutes) || 0 };
    if (isNew) {
      setDishes((prev) => [...prev, { ...clean, dish_id: Date.now() }]);
      toast("Dish added to this view (not persisted — API not connected)", "info");
    } else {
      setDishes((prev) => prev.map((d) => (d.dish_id === clean.dish_id ? clean : d)));
      toast("Dish updated locally (API not connected)", "info");
    }
    setEditing(null);
  };

  const remove = () => {
    setDishes((prev) => prev.filter((d) => d.dish_id !== confirmDel.dish_id));
    toast("Dish removed from view (delete API not connected)", "info");
    setConfirmDel(null);
  };

  const spicy = (lvl) => (lvl > 0 ? "🌶".repeat(lvl) : "—");

  return (
    <div className="sfx-stack">
      <SectionHead
        title="Menu & Dishes"
        subtitle={dishSource === "api" ? "Live menu data" : "Sample menu data"}
        actions={
          isManager ? (
            <Button variant="gold" icon="plus" onClick={() => { setEditing({ ...EMPTY }); setIsNew(true); }}>
              Add Dish
            </Button>
          ) : null
        }
      />

      <div className="sfx-tabs">
        <button className={`sfx-tab ${tab === "list" ? "is-active" : ""}`} onClick={() => setTab("list")}>
          Dish List
        </button>
        <button className={`sfx-tab ${tab === "best" ? "is-active" : ""}`} onClick={() => setTab("best")}>
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
                  {bestSellers.map((d) => {
                    const max = Math.max(...bestSellers.map((b) => b.revenue));
                    return (
                      <tr key={d.rank}>
                        <td><span className="sfx-rank__no">{d.rank}</span></td>
                        <td><strong>{d.dish_name}</strong></td>
                        <td>{d.qty_sold}</td>
                        <td>{formatVND(d.revenue)}</td>
                        <td className="sfx-bar-cell">
                          <span className="sfx-bar">
                            <span className="sfx-bar__fill" style={{ width: `${(d.revenue / max) * 100}%` }} />
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

      <StaffModal
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
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="gold" onClick={save}>{isNew ? "Add dish" : "Save changes"}</Button>
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
            <div className="sfx-toggles">
              <label className="sfx-toggle">
                <input type="checkbox" checked={editing.is_available} onChange={(e) => setEditing({ ...editing, is_available: e.target.checked })} />
                <span>Available</span>
              </label>
              <label className="sfx-toggle">
                <input type="checkbox" checked={editing.is_recommended} onChange={(e) => setEditing({ ...editing, is_recommended: e.target.checked })} />
                <span>Recommended</span>
              </label>
            </div>
            <NotConnectedNote>Dish write/delete API not connected — changes stay in this view.</NotConnectedNote>
          </div>
        ) : null}
      </StaffModal>

      <StaffModal
        open={Boolean(confirmDel)}
        title="Delete dish?"
        size="sm"
        onClose={() => setConfirmDel(null)}
        footer={
          <div className="sfx-modal__footacts">
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>Keep</Button>
            <Button variant="danger" icon="trash" onClick={remove}>Delete</Button>
          </div>
        }
      >
        <p className="sfx-confirm-text">
          Remove <strong>{confirmDel?.dish_name}</strong> from the menu list? This is a local change only.
        </p>
      </StaffModal>
    </div>
  );
}

export default DishesSection;
