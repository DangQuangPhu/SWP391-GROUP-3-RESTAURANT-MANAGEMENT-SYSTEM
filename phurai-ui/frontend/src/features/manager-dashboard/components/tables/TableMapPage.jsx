import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ManagerModal } from "../ManagerOverlay.jsx";
import { SectionHead, ContentPanel, StatusBadge, Button } from "../ManagerUI.jsx";
import { useManagerPortal } from "../../context/ManagerPortalContext.jsx";
import { TABLE_STATUS_META, AREAS } from "@/shared/constants.js";
import { fetchAreas, fetchFilteredTables, mergeTablesApi, unmergeTableApi, updateTableApi, deleteTableApi, fetchTableTimelineApi } from "../../services/managerApi.js";
import { asArray } from "@/core/utils/asArray.js";
import AddTableModal from "./AddTableModal.jsx";
import TableMapFilterBar from "./TableMapFilterBar.jsx";
import { STATUS_KEYS, STATUS_SLUG_TO_API } from "./tableConstants.js";
import { QRCodeSVG as QRCode } from "qrcode.react";

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
  const tableList = asArray(tables);
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
  const [timeline, setTimeline] = useState([]);
  const [confirmDel, setConfirmDel] = useState(null);

  const [isJiggling, setIsJiggling] = useState(false);
  const pressTimer = useRef(null);

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

  useEffect(() => {
    if (editing?.table_id && managerUserId) {
      setTimeline([]);
      fetchTableTimelineApi(editing.table_id, managerUserId)
        .then((res) => {
          if (res?.success) setTimeline(res.timeline || []);
        })
        .catch(() => setTimeline([]));
    } else {
      setTimeline([]);
    }
  }, [editing?.table_id, managerUserId]);

  const grouped = useMemo(() => {
    // 1. Natural Sorting
    const sorted = [...tableList].sort((a, b) => {
      const cmp = a.area_name.localeCompare(b.area_name);
      if (cmp !== 0) return cmp;
      return a.table_number.localeCompare(b.table_number, undefined, { numeric: true });
    });

    // 2. Resolve Merges Visually
    const parentMap = new Map();
    sorted.forEach((t) => {
      if (!t.merged_into_table_id) {
        parentMap.set(t.table_id, { ...t, combined_names: [t.table_number], combined_capacity: t.capacity, child_ids: [] });
      }
    });

    sorted.forEach((t) => {
      if (t.merged_into_table_id && parentMap.has(t.merged_into_table_id)) {
        const parent = parentMap.get(t.merged_into_table_id);
        parent.combined_names.push(t.table_number);
        parent.combined_capacity += t.capacity;
        parent.child_ids.push(t.table_id);
      }
    });

    const displayList = Array.from(parentMap.values());

    const map = {};
    displayList.forEach((t) => {
      (map[t.area_name] = map[t.area_name] || []).push(t);
    });
    return map;
  }, [tableList]);

  const areaCount = areas.length || AREAS.length;
  const groupedEntries = Object.entries(grouped);

  // Drag and Drop & Long Press
  const handlePointerDown = (e, t) => {
    if (!isManager || t.is_counter) return;
    pressTimer.current = window.setTimeout(() => {
      setIsJiggling(true);
    }, 500);
  };

  const handlePointerUpOrLeave = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current);
  };

  const handleDragStart = (e, t) => {
    if (!isJiggling || t.is_counter) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("application/json", JSON.stringify({ id: t.table_id, area_id: t.area_id }));
  };

  const handleDrop = async (e, targetTable) => {
    e.preventDefault();
    setIsJiggling(false);
    if (targetTable.is_counter) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.id === targetTable.table_id || data.area_id !== targetTable.area_id) return;

      await mergeTablesApi(data.id, targetTable.table_id, managerUserId);
      toast("Tables merged successfully", "success");
      loadFilteredTables();
    } catch (err) {
      toast(err.message || "Merge failed", "error");
    }
  };

  const handleUnmerge = async (tableId) => {
    try {
      await unmergeTableApi(tableId, managerUserId);
      toast("Tables separated", "success");
      setEditing(null);
      loadFilteredTables();
    } catch (err) {
      toast(err.message || "Failed to separate tables", "error");
    }
  };

  const toggleStatusFilter = (slug) => {
    if (slug === "clear") {
      setSelectedStatuses([]);
    } else {
      setSelectedStatuses([slug]);
    }
  };

  const handleAddSuccess = () => {
    toast("Table added successfully", "success");
    loadFilteredTables();
  };

  const saveEdit = async () => {
    if (!editing.table_number.trim()) {
      toast("Table number is required", "error");
      return;
    }

    try {
      const apiStatus = STATUS_SLUG_TO_API[String(editing.status).toLowerCase()] || "Available";
      const payload = {
        table_number: editing.table_number.trim(),
        area_id: editing.area_id || (areas.find(a => a.area_name === editing.area_name)?.area_id) || 1,
        capacity: Number(editing.capacity) || 1,
        status: apiStatus
      };

      await updateTableApi(editing.table_id, payload, managerUserId);

      toast("Table updated", "success");
      setEditing(null);
      loadFilteredTables();
    } catch (err) {
      toast(err.message || "Failed to update table", "error");
    }
  };

  const quickStatus = async (t, status) => {
    try {
      const apiStatus = STATUS_SLUG_TO_API[String(status).toLowerCase()] || "Available";
      const payload = {
        table_number: t.table_number,
        area_id: t.area_id || (areas.find(a => a.area_name === t.area_name)?.area_id) || 1,
        capacity: Number(t.capacity) || 1,
        status: apiStatus
      };

      await updateTableApi(t.table_id, payload, managerUserId);
      toast(`${t.table_number} → ${TABLE_STATUS_META[status].label}`, "success");
      loadFilteredTables();
    } catch (err) {
      toast(err.message || "Failed to update status", "error");
    }
  };

  const remove = async () => {
    try {
      await deleteTableApi(confirmDel.table_id, managerUserId);
      toast("Table removed", "success");
      setConfirmDel(null);
      loadFilteredTables();
    } catch (err) {
      toast(err.message || "Failed to remove table", "error");
    }
  };

  return (
    <div className="sfx-stack">
      <TableMapFilterBar
        search={searchInput}
        onSearchChange={setSearchInput}
        areaId={areaId}
        onAreaChange={setAreaId}
        areas={areas}
        areasLoading={areasLoading}
        selectedStatuses={selectedStatuses}
        onToggleStatus={toggleStatusFilter}
        actions={
          isManager ? (
            <Button variant="gold" icon="plus" onClick={() => setAddModalOpen(true)} style={{ height: "40px", display: "inline-flex", alignItems: "center" }}>
              Add Table
            </Button>
          ) : null
        }
      />

      <ContentPanel compact>
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
                  {list.map((t) => {
                    const displayNum = t.combined_names.join(" | ");
                    const canMerge = isJiggling && !t.is_counter;
                    const statusKey = String(t.table_status || t.status || "available").toLowerCase();
                    return (
                      <button
                        key={t.table_id}
                        type="button"
                        draggable={canMerge}
                        onPointerDown={(e) => handlePointerDown(e, t)}
                        onPointerUp={handlePointerUpOrLeave}
                        onPointerLeave={handlePointerUpOrLeave}
                        onDragStart={(e) => handleDragStart(e, t)}
                        onDragOver={(e) => {
                          if (canMerge) e.preventDefault();
                        }}
                        onDrop={(e) => handleDrop(e, t)}
                        className={`sfx-mtile sfx-mtile--${TABLE_STATUS_META[statusKey]?.tone} ${canMerge ? "is-jiggling" : ""}`}
                        onClick={() => !isJiggling && setEditing({ ...t })}
                      >
                        <span className="sfx-mtile__no">{displayNum}</span>
                        <span className="sfx-mtile__cap">{t.combined_capacity} seats</span>
                        <StatusBadge tone={TABLE_STATUS_META[statusKey]?.tone}>
                          {TABLE_STATUS_META[statusKey]?.label}
                        </StatusBadge>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ContentPanel>

      <AddTableModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={handleAddSuccess}
        managerUserId={managerUserId}
      />

      <ManagerModal
        open={Boolean(editing)}
        title={`Edit ${editing?.combined_names?.join(" | ") || editing?.table_number || "Table"}`}
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
              {editing?.child_ids?.length > 0 && isManager && (
                <Button variant="soft" onClick={() => handleUnmerge(editing.table_id)}>
                  Separate Table
                </Button>
              )}
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
            <div style={{ display: "flex", gap: "24px" }}>
              <div style={{ flex: 1 }}>
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
              </div>
              
              {editing.static_qr_code && (
                <div style={{ width: "150px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                  <span className="sfx-muted" style={{ fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap" }}>Static QR - Scan to Order</span>
                  <div id={`qr-wrapper-${editing.table_id}`} style={{ background: "#fff", padding: "8px", borderRadius: "8px", border: "1px solid var(--sfx-border-soft)", display: "flex", justifyContent: "center", alignItems: "center" }}>
                    <QRCode
                      value={`${window.location.origin}/scan/${editing.static_qr_code}`} 
                      size={150} 
                    />
                  </div>
                  <Button 
                    variant="soft" 
                    size="sm" 
                    icon="download"
                    onClick={() => {
                      const wrapper = document.getElementById(`qr-wrapper-${editing.table_id}`);
                      const svg = wrapper?.querySelector("svg");
                      if (!svg) return;
                      const svgData = new XMLSerializer().serializeToString(svg);
                      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `Table-${editing.table_number}-QR.svg`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    Download
                  </Button>
                </div>
              )}
            </div>

            <div className="sfx-field">
              <span>Status</span>
              <div className="sfx-chips">
                {STATUS_KEYS.map((k) => {
                  const s = TABLE_STATUS_META[k];
                  const isActive = (STATUS_SLUG_TO_API[k] || "Available") === editing.status;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() =>
                        setEditing({ ...editing, status: STATUS_SLUG_TO_API[k] || "Available" })
                      }
                      className={`sfx-chip ${isActive ? "is-active" : "sfx-chip--outline"}`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Timeline Section */}
            {timeline.length > 0 && (
              <div className="sfx-detail__block" style={{ marginTop: "16px" }}>
                <span>Timeline</span>
                <ul className="sfx-detail__list">
                  {timeline.map((log) => {
                    const dateStr = new Date(log.created_at).toLocaleString('vi-VN', {
                      day: '2-digit', month: '2-digit', year: '2-digit',
                      hour: '2-digit', minute: '2-digit'
                    });
                    const actionName = log.action_name === 'STAFF_MERGE_TABLES' ? 'ASSEMBLE TABLES' :
                      log.action_name === 'STAFF_UNMERGE_TABLES' ? 'SEPARATE TABLES' :
                        log.action_name === 'SYSTEM_AUTO_UNMERGE_ON_CLEAR' ? 'AUTO UNMERGE' : log.action_name;
                    return (
                      <li key={log.audit_id} style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                        <strong>{actionName}</strong>
                        <small className="sfx-muted">
                          Created: By {log.full_name || log.username || "System"} [{dateStr}]
                        </small>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

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
