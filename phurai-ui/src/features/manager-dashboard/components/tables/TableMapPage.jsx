import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ManagerModal } from "../ManagerOverlay.jsx";
import { SectionHead, StatusBadge, Button } from "../ManagerUI.jsx";
import { useManagerPortal } from "../../context/ManagerPortalContext.jsx";
import { TABLE_STATUS_META, AREAS } from "../../data/managerDashboardMockData.js";
import { fetchAreas, fetchFilteredTables } from "../../services/managerApi.js";
import AddTableModal from "./AddTableModal.jsx";
import TableMapFilterBar from "./TableMapFilterBar.jsx";
import { STATUS_KEYS, STATUS_SLUG_TO_API } from "./tableConstants.js";

const SEARCH_DEBOUNCE_MS = 300;

function parseStatusesParam(raw) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((slug) => STATUS_KEYS.includes(slug));
}

function readFiltersFromUrl(searchParams) {
  return {
    search: searchParams.get("search") || "",
    areaId: searchParams.get("area_id") || "",
    selectedStatuses: parseStatusesParam(searchParams.get("statuses")),
  };
}

function buildFilterSearchParams(searchParams, { search, areaId, selectedStatuses }) {
  const next = new URLSearchParams(searchParams);
  const trimmed = search.trim();

  if (trimmed) next.set("search", trimmed);
  else next.delete("search");

  if (areaId) next.set("area_id", String(areaId));
  else next.delete("area_id");

  if (selectedStatuses.length > 0) next.set("statuses", selectedStatuses.join(","));
  else next.delete("statuses");

  return next;
}

function TableMapPage({ tables, setTables, pendingAction, role, toast }) {
  const { currentUser } = useManagerPortal();
  const managerUserId = currentUser?.userId ?? currentUser?.id ?? null;
  const [searchParams, setSearchParams] = useSearchParams();

  const initialFilters = useMemo(() => readFiltersFromUrl(searchParams), []);

  const [searchInput, setSearchInput] = useState(initialFilters.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialFilters.search);
  const [areaId, setAreaId] = useState(initialFilters.areaId);
  const [selectedStatuses, setSelectedStatuses] = useState(initialFilters.selectedStatuses);

  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const isManager = role === "manager";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSearchParams(
      (current) => {
        const next = buildFilterSearchParams(current, {
          search: debouncedSearch,
          areaId,
          selectedStatuses,
        });
        return next.toString() === current.toString() ? current : next;
      },
      { replace: true }
    );
  }, [debouncedSearch, areaId, selectedStatuses, setSearchParams]);

  const setTablesRef = useRef(setTables);
  useEffect(() => {
    setTablesRef.current = setTables;
  }, [setTables]);

  const loadFilteredTables = useCallback(async () => {
    if (!managerUserId) return;
    setListLoading(true);
    try {
      const statuses =
        selectedStatuses.length > 0
          ? selectedStatuses.map((slug) => STATUS_SLUG_TO_API[slug]).join(",")
          : undefined;

      const res = await fetchFilteredTables(
        {
          search: debouncedSearch.trim() || undefined,
          area_id: areaId || undefined,
          statuses,
        },
        managerUserId
      );
      setTablesRef.current(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTablesRef.current([]);
    } finally {
      setListLoading(false);
    }
  }, [managerUserId, debouncedSearch, areaId, selectedStatuses]);

  useEffect(() => {
    if (!managerUserId) return undefined;

    let alive = true;
    setAreasLoading(true);

    fetchAreas(managerUserId)
      .then((res) => {
        if (!alive) return;
        setAreas(Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!alive) return;
        setAreas([]);
      })
      .finally(() => {
        if (alive) setAreasLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [managerUserId]);

  useEffect(() => {
    loadFilteredTables();
  }, [loadFilteredTables]);

  useEffect(() => {
    if (pendingAction === "add" && isManager) {
      setAddModalOpen(true);
    }
  }, [pendingAction, isManager]);

  const grouped = useMemo(() => {
    const map = {};
    tables.forEach((t) => {
      (map[t.area_name] = map[t.area_name] || []).push(t);
    });
    return map;
  }, [tables]);

  const areaCount = areas.length || AREAS.length;
  const groupedEntries = Object.entries(grouped);

  const toggleStatusFilter = (slug) => {
    setSelectedStatuses((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  const handleAddSuccess = () => {
    toast("Table added successfully", "success");
    loadFilteredTables();
  };

  const saveEdit = () => {
    if (!editing.table_number.trim()) {
      toast("Table number is required", "error");
      return;
    }
    setTables((prev) =>
      prev.map((t) =>
        t.table_id === editing.table_id
          ? { ...editing, capacity: Number(editing.capacity) || 1 }
          : t
      )
    );
    toast("Table updated", "success");
    setEditing(null);
  };

  const quickStatus = (t, status) => {
    setTables((prev) => prev.map((x) => (x.table_id === t.table_id ? { ...x, status } : x)));
    toast(`${t.table_number} → ${TABLE_STATUS_META[status].label}`, "info");
  };

  const remove = () => {
    setTables((prev) => prev.filter((t) => t.table_id !== confirmDel.table_id));
    toast("Table removed", "info");
    setConfirmDel(null);
  };

  return (
    <div className="sfx-stack">
      <SectionHead
        title="Table Map"
        subtitle={`${tables.length} tables across ${areaCount} areas`}
        actions={
          isManager ? (
            <Button variant="gold" icon="plus" onClick={() => setAddModalOpen(true)}>
              Add Table
            </Button>
          ) : null
        }
      />

      <TableMapFilterBar
        search={searchInput}
        onSearchChange={setSearchInput}
        areaId={areaId}
        onAreaChange={setAreaId}
        areas={areas}
        areasLoading={areasLoading}
        selectedStatuses={selectedStatuses}
        onToggleStatus={toggleStatusFilter}
      />

      <div className={`sfx-tablemap-wrap ${listLoading ? "is-loading" : ""}`}>
        {!listLoading && groupedEntries.length === 0 ? (
          <div className="sfx-card">
            <div className="sfx-card__body">
              <p className="sfx-muted">No tables match the current filters.</p>
            </div>
          </div>
        ) : null}

        {groupedEntries.map(([areaName, list]) => (
          <div key={areaName} className="sfx-card">
            <header className="sfx-card__head">
              <h3 className="sfx-card__title">{areaName}</h3>
              <span className="sfx-muted">{list.length} tables</span>
            </header>
            <div className="sfx-card__body">
              <div className="sfx-tablemap">
                {list.map((t) => (
                  <button
                    key={t.table_id}
                    type="button"
                    className={`sfx-mtile sfx-mtile--${TABLE_STATUS_META[t.status]?.tone}`}
                    onClick={() => setEditing({ ...t })}
                  >
                    <span className="sfx-mtile__no">{t.table_number}</span>
                    <span className="sfx-mtile__cap">{t.capacity} seats</span>
                    <StatusBadge tone={TABLE_STATUS_META[t.status]?.tone}>
                      {TABLE_STATUS_META[t.status]?.label}
                    </StatusBadge>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <AddTableModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleAddSuccess}
        managerUserId={managerUserId}
      />

      <ManagerModal
        open={Boolean(editing)}
        title={`Edit ${editing?.table_number || "Table"}`}
        onClose={() => setEditing(null)}
        footer={
          <>
            {isManager ? (
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
              <Button variant="gold" onClick={saveEdit}>
                Save changes
              </Button>
            </div>
          </>
        }
      >
        {editing ? (
          <div className="sfx-form">
            <label className="sfx-field">
              <span>Table number</span>
              <input
                className="sfx-input"
                value={editing.table_number}
                onChange={(e) => setEditing({ ...editing, table_number: e.target.value })}
                placeholder="e.g. M-09"
              />
            </label>
            <div className="sfx-form__row">
              <label className="sfx-field">
                <span>Area</span>
                <select
                  className="sfx-select"
                  value={editing.area_name}
                  onChange={(e) => setEditing({ ...editing, area_name: e.target.value })}
                >
                  {(areas.length ? areas.map((a) => a.area_name) : AREAS).map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
              <label className="sfx-field">
                <span>Capacity</span>
                <input
                  className="sfx-input"
                  type="number"
                  min="1"
                  max="20"
                  value={editing.capacity}
                  onChange={(e) => setEditing({ ...editing, capacity: e.target.value })}
                />
              </label>
            </div>
            <label className="sfx-field">
              <span>Status</span>
              <div className="sfx-chips">
                {STATUS_KEYS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    className={`sfx-chip ${editing.status === k ? "is-active" : "sfx-chip--outline"}`}
                    onClick={() => setEditing({ ...editing, status: k })}
                  >
                    {TABLE_STATUS_META[k].label}
                  </button>
                ))}
              </div>
            </label>
            <div className="sfx-quickstatus">
              <span className="sfx-muted">Quick set:</span>
              {["available", "occupied", "cleaning"].map((k) => (
                <Button key={k} size="sm" variant="soft" onClick={() => quickStatus(editing, k)}>
                  {TABLE_STATUS_META[k].label}
                </Button>
              ))}
            </div>
          </div>
        ) : null}
      </ManagerModal>

      <ManagerModal
        open={Boolean(confirmDel)}
        title="Delete table?"
        size="sm"
        onClose={() => setConfirmDel(null)}
        footer={
          <div className="sfx-modal__footacts">
            <Button variant="ghost" onClick={() => setConfirmDel(null)}>
              Keep
            </Button>
            <Button variant="danger" icon="trash" onClick={remove}>
              Delete
            </Button>
          </div>
        }
      >
        <p className="sfx-confirm-text">
          Remove <strong>{confirmDel?.table_number}</strong> ({confirmDel?.area_name}) from the floor
          plan?
        </p>
      </ManagerModal>
    </div>
  );
}

export default TableMapPage;
