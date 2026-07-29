import { useMemo, useState, useRef } from "react";
import {
  SectionHead,
  Toolbar,
  StatusBadge,
  Button,
  NotConnectedNote,
} from "../StaffUI.jsx";
import {
  STAFF_AREAS,
  TABLE_STATUS_META,
  DEMO_NOTICE,
} from "@/shared/constants.js";
import { mergeTablesApi, unmergeTableApi } from "../../services/staffApi.js";
import { asArray } from "@/core/utils/asArray.js";

const STATUS_KEYS = Object.keys(TABLE_STATUS_META);

function TableMapSection({ tables, setTables, dataSource, toast }) {
  const tableList = asArray(tables);
  const [areaFilter, setAreaFilter] = useState("all");

  const [isJiggling, setIsJiggling] = useState(false);
  const pressTimer = useRef(null);

  const grouped = useMemo(() => {
    const list =
      areaFilter === "all"
        ? tableList
        : tableList.filter((t) => t.area_name === areaFilter);

    // 1. Natural Sort
    const sorted = [...list].sort((a, b) => {
      const cmp = a.area_name.localeCompare(b.area_name);
      if (cmp !== 0) return cmp;
      return a.table_number.localeCompare(b.table_number, undefined, { numeric: true });
    });

    // 2. Resolve Merges
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
  }, [tableList, areaFilter]);

  const quickStatus = (table, status) => {
    setTables((prev) =>
      asArray(prev).map((x) => (x.table_id === table.table_id ? { ...x, status } : x))
    );
    toast(`${table.table_number} → ${TABLE_STATUS_META[status].label} (local only)`, "info");
  };

  const handlePointerDown = (e, t) => {
    if (t.is_counter) return;
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

      await mergeTablesApi(data.id, targetTable.table_id);
      toast("Tables merged successfully", "success");
      // UI refresh is handled by Socket.io since we don't have loadFilteredTables here directly, or reload via parent.
    } catch (err) {
      toast(err.message || "Merge failed", "error");
    }
  };

  const handleUnmerge = async (tableId) => {
    try {
      await unmergeTableApi(tableId);
      toast("Tables separated", "success");
    } catch (err) {
      toast(err.message || "Failed to separate tables", "error");
    }
  };

  return (
    <div className="sfx-stack">
      <SectionHead
        title="Table Map"
        subtitle={`${tableList.length} tables across ${STAFF_AREAS.length} areas`}
      />



      <Toolbar>
        <div className="sfx-legend">
          {STATUS_KEYS.map((k) => (
            <span key={k} className="sfx-legend__item">
              <i className={`sfx-dot sfx-dot--${TABLE_STATUS_META[k].tone}`} />
              {TABLE_STATUS_META[k].label}
            </span>
          ))}
        </div>
        <select
          className="sfx-select"
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
        >
          <option value="all">All areas</option>
          {STAFF_AREAS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </Toolbar>

      {Object.entries(grouped).map(([areaName, list]) => (
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
                  <article
                    key={t.table_id}
                    draggable={canMerge}
                    onPointerDown={(e) => handlePointerDown(e, t)}
                    onPointerUp={handlePointerUpOrLeave}
                    onPointerLeave={handlePointerUpOrLeave}
                    onDragStart={(e) => handleDragStart(e, t)}
                    onDragOver={(e) => {
                      if (canMerge) e.preventDefault();
                    }}
                    onDrop={(e) => handleDrop(e, t)}
                    className={`sfx-mtile sfx-mtile--${(t.upcoming_count > 0 && TABLE_STATUS_META[statusKey]?.tone === "green") ? "amber" : (TABLE_STATUS_META[statusKey]?.tone || "muted")} ${canMerge ? "is-jiggling" : ""}`}
                  >
                    {t.upcoming_count > 0 && (
                      <div className="sfx-mtile__notif-badge" title={`${t.upcoming_count} upcoming reservation(s) queued`}>
                        <span>🔔</span>
                        <span>{t.upcoming_count}</span>
                      </div>
                    )}
                    <span className="sfx-mtile__no">{displayNum}</span>
                    <span className="sfx-mtile__cap">{t.combined_capacity} seats</span>
                    <StatusBadge tone={TABLE_STATUS_META[statusKey]?.tone}>
                      {TABLE_STATUS_META[statusKey]?.label}
                    </StatusBadge>
                    <div className="sfx-tabletile__actions">
                      {statusKey !== "available" && !isJiggling ? (
                        <Button size="sm" onClick={() => quickStatus(t, "available")}>
                          Available
                        </Button>
                      ) : null}
                      {statusKey !== "occupied" && !isJiggling ? (
                        <Button size="sm" onClick={() => quickStatus(t, "occupied")}>
                          Occupied
                        </Button>
                      ) : null}
                      {statusKey !== "cleaning" && !isJiggling ? (
                        <Button size="sm" onClick={() => quickStatus(t, "cleaning")}>
                          Cleaning
                        </Button>
                      ) : null}
                      {t.child_ids?.length > 0 && !isJiggling ? (
                        <Button size="sm" variant="soft" onClick={() => handleUnmerge(t.table_id)}>
                          Separate
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TableMapSection;
