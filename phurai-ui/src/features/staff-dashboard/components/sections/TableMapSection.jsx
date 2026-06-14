import { useMemo, useState } from "react";
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
} from "../../data/staffDashboardMockData.js";

const STATUS_KEYS = Object.keys(TABLE_STATUS_META);

function TableMapSection({ tables, setTables, dataSource, toast }) {
  const [areaFilter, setAreaFilter] = useState("all");

  const grouped = useMemo(() => {
    const list =
      areaFilter === "all" ? tables : tables.filter((t) => t.area_name === areaFilter);
    const map = {};
    list.forEach((t) => {
      (map[t.area_name] = map[t.area_name] || []).push(t);
    });
    return map;
  }, [tables, areaFilter]);

  const quickStatus = (table, status) => {
    setTables((prev) =>
      prev.map((x) => (x.table_id === table.table_id ? { ...x, status } : x))
    );
    toast(`${table.table_number} → ${TABLE_STATUS_META[status].label} (local only)`, "info");
  };

  return (
    <div className="sfx-stack">
      <SectionHead
        title="Table Map"
        subtitle={`${tables.length} tables across ${STAFF_AREAS.length} areas`}
      />

      {dataSource === "mock" ? <NotConnectedNote>{DEMO_NOTICE}</NotConnectedNote> : null}

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
              {list.map((t) => (
                <article
                  key={t.table_id}
                  className={`sfx-mtile sfx-mtile--${TABLE_STATUS_META[t.status]?.tone || "muted"}`}
                >
                  <span className="sfx-mtile__no">{t.table_number}</span>
                  <span className="sfx-mtile__cap">{t.capacity} seats</span>
                  <StatusBadge tone={TABLE_STATUS_META[t.status]?.tone}>
                    {TABLE_STATUS_META[t.status]?.label}
                  </StatusBadge>
                  <div className="sfx-tabletile__actions">
                    {t.status !== "available" ? (
                      <Button size="sm" onClick={() => quickStatus(t, "available")}>
                        Available
                      </Button>
                    ) : null}
                    {t.status !== "occupied" ? (
                      <Button size="sm" onClick={() => quickStatus(t, "occupied")}>
                        Occupied
                      </Button>
                    ) : null}
                    {t.status !== "cleaning" ? (
                      <Button size="sm" onClick={() => quickStatus(t, "cleaning")}>
                        Cleaning
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default TableMapSection;
