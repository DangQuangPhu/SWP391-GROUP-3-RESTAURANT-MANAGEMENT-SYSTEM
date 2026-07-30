import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { isSameDay } from "date-fns";
import DashboardDateRangePicker from "../shared/DashboardDateRangePicker.jsx";
import { useSearchParams } from "react-router-dom";
import RevenueChart from "../RevenueChart.jsx";
import KpiCard from "../KpiCard.jsx";
import Icon from "../ManagerIcons.jsx";
import {
  SectionHead,
  ContentPanel,
  Card,
} from "../ManagerUI.jsx";
import {
  deriveKpisForRange,
  filterDailyRevenue,
  formatDateRangeLabel,
  getDefaultDateRange,
  getDateRangePresets,
  prepareChartSeries,
} from "@/shared/constants.js";
import { asArray } from "@/core/utils/asArray.js";
import { formatVND } from "@/core/utils/formatCurrency.js";
import { getReportsTabFromSearch, REPORT_TAB_IDS } from "../../config/managerRoutes.js";
import { fetchBestSellers, exportReport, uploadReviewedReport } from "../../services/managerApi.js";

const TABS = [
  { id: "revenue", label: "Revenue Dashboard" },
  { id: "stats", label: "Reservation Statistics" },
  { id: "top-dishes", label: "Top Dishes" },
  { id: "export", label: "Export & View" },
];

function ReportsSection({
  kpis,
  reservations,
  bestSellers,
  stats,
  utilization,
  revenue,
  toast,
}) {
  const utilizationList = asArray(utilization);
  const statsByArea = asArray(stats?.byArea);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = useMemo(
    () => getReportsTabFromSearch(`?${searchParams.toString()}`),
    [searchParams]
  );

  const today = useMemo(() => new Date(), []);
  const [dateRange, setDateRange] = useState(() => getDefaultDateRange(today));
  const [draftRange, setDraftRange] = useState(() => getDefaultDateRange(today));
  const [activePresetId, setActivePresetId] = useState("last30");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerAnchorRef = useRef(null);
  // Use real API revenue series — no mock generation
  const dailyRevenueSeries = useMemo(
    () => asArray(revenue?.series ?? revenue ?? []),
    [revenue]
  );
  const chartSeries = useMemo(() => {
    const filtered = filterDailyRevenue(dailyRevenueSeries, dateRange);
    return prepareChartSeries(filtered);
  }, [dailyRevenueSeries, dateRange]);
  const dateRangeLabel = useMemo(() => formatDateRangeLabel(dateRange), [dateRange]);
  const rangeKpis = useMemo(
    () => deriveKpisForRange(kpis, dailyRevenueSeries, dateRange, reservations),
    [kpis, dailyRevenueSeries, dateRange, reservations]
  );

  const chartTotal = useMemo(
    () => asArray(chartSeries).reduce((sum, point) => sum + (point.revenue ?? 0), 0),
    [chartSeries]
  );

  const openPicker = useCallback(() => {
    setDraftRange({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      key: "selection",
    });
    setPickerOpen(true);
  }, [dateRange]);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
  }, []);

  const handleApply = useCallback(({ startDate, endDate }) => {
    const next = { startDate, endDate, key: "selection" };
    setDateRange(next);

    const presets = getDateRangePresets(today);
    const matched = presets.find((preset) => {
      if (!preset.range.startDate && !next.startDate) return true;
      if (!preset.range.startDate || !next.startDate) return false;
      return isSameDay(preset.range.startDate, next.startDate) && isSameDay(preset.range.endDate, next.endDate);
    });
    setActivePresetId(matched?.id ?? "custom");
    setPickerOpen(false);
  }, [today]);

  const handlePresetSelect = useCallback((preset) => {
    const range = preset.range || { startDate: preset.startDate, endDate: preset.endDate, key: "selection" };
    setDraftRange(range);
    setActivePresetId(preset.id);
    setDateRange(range);
    setPickerOpen(false);
  }, []);

  const [topDishesFilter, setTopDishesFilter] = useState("month");
  const [topDishes, setTopDishes] = useState([]);
  const [loadingTopDishes, setLoadingTopDishes] = useState(false);

  // --- AI Report State ---
  const [currentIntent, setCurrentIntent] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [grandTotalRow, setGrandTotalRow] = useState(null);

  // Confirm-Before-Run Step State
  const [pendingFormat, setPendingFormat] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Upload State
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleExport = useCallback(async (format, intent = currentIntent) => {
    if (!intent) {
      toast("Please enter a report request first (e.g., Revenue report for this month)", "warning");
      return;
    }
    toast(`Exporting ${format.toUpperCase()} (Draft for review)...`, "info");
    try {
      await exportReport(intent, format);
      toast(`Draft ${format.toUpperCase()} report downloaded successfully!`, "success");
      setShowConfirm(false);
    } catch (err) {
      toast(err.message || `Export error ${format.toUpperCase()}`, "error");
    }
  }, [currentIntent, toast, setShowConfirm]);

  const requestExportWithConfirm = useCallback((format, intent = currentIntent) => {
    if (!intent) {
      toast("Please enter a report request first (e.g., Revenue report for this month)", "warning");
      return;
    }
    setPendingFormat(format);
    setShowConfirm(true);
  }, [currentIntent, toast, setShowConfirm]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    toast("Uploading report to Admin...", "info");
    try {
      const res = await uploadReviewedReport(file, currentIntent);
      if (res?.success) {
        toast("✅ Reviewed report submitted to Admin successfully!", "success");
      }
    } catch (err) {
      toast(err.message || "Failed to submit report to Admin", "error");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    const handleReportUpdate = (e) => {
      if (e.detail) {
        setCurrentIntent(e.detail.intent);
        setReportData(e.detail.data);
        setGrandTotalRow(e.detail.grandTotalRow);
      }
    };
    window.addEventListener("phurai_report_updated", handleReportUpdate);
    return () => window.removeEventListener("phurai_report_updated", handleReportUpdate);
  }, []);

  useEffect(() => {
    let alive = true;
    setLoadingTopDishes(true);
    fetchBestSellers(topDishesFilter)
      .then(res => {
        if (alive) setTopDishes(res.data || []);
      })
      .catch(console.error)
      .finally(() => {
        if (alive) setLoadingTopDishes(false);
      });
    return () => { alive = false; };
  }, [topDishesFilter]);

  const selectTab = (nextTab) => {
    if (!REPORT_TAB_IDS.includes(nextTab)) return;
    if (nextTab === "revenue") {
      setSearchParams({}, { replace: true });
      return;
    }
    setSearchParams({ tab: nextTab }, { replace: true });
  };

  const revenueKpis = asArray(rangeKpis).filter((k) =>
    ["revenue", "reservations", "promos", "rating"].includes(k.id)
  );

  return (
    <div className="sfx-stack">
      <SectionHead title="Reports" subtitle="Revenue, statistics and exports" />

      <ContentPanel compact className="sfx-card--overflow-visible">
      <div className="sfx-tabs" role="tablist" aria-label="Report sections" style={{ marginBottom: '24px' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`sfx-tab ${tab === t.id ? "is-active" : ""}`}
            onClick={() => selectTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "revenue" ? (
        <div className="sfx-stack">
          <div className="sfx-kpis">
            {revenueKpis.map((c, i) => (
              <KpiCard key={c.id} card={c} index={i} />
            ))}
          </div>
          <Card className="sfx-card--overflow-visible">
            <div className="sfx-chart-anchor">
              <div className="sfx-chart__head">
                <div>
                  <h3 className="sfx-card__title">Revenue Overview</h3>
                  <p className="sfx-chart__sub">
                    {dateRangeLabel} · {formatVND(chartTotal)} total
                  </p>
                </div>
                <div className="sfx-chart__actions">
                  <div
                    className={`sfx-chart__picker-anchor${pickerOpen ? " is-open" : ""}`}
                    ref={pickerAnchorRef}
                    style={{ position: "relative" }}
                  >
                    <button
                      type="button"
                      className="sfx-kpi__icon sfx-kpi__icon--trigger"
                      onClick={() => (pickerOpen ? closePicker() : openPicker())}
                      aria-label="Choose date range"
                      aria-expanded={pickerOpen}
                    >
                      <Icon name="calendar" size={18} />
                    </button>
                    {pickerOpen && (
                      <div style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        marginTop: "8px",
                        zIndex: 100
                      }}>
                        <DashboardDateRangePicker
                          inline={true}
                          draftRange={draftRange}
                          activePresetId={activePresetId}
                          onDraftChange={(selection) => {
                            setDraftRange(selection);
                            setActivePresetId("custom");
                          }}
                          onPresetSelect={handlePresetSelect}
                          onApply={() => handleApply(draftRange)}
                          onCancel={closePicker}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: "24px" }}>
                <RevenueChart
                  data={chartSeries}
                  dateRange={dateRange}
                  rangeLabel={dateRangeLabel}
                  showHeader={false}
                />
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "top-dishes" ? (
        <Card
          title="Top dishes by revenue"
          action={
            <select
              className="sfx-select sfx-select--sm"
              value={topDishesFilter}
              onChange={(e) => setTopDishesFilter(e.target.value)}
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          }
        >
          {loadingTopDishes ? (
            <p className="sfx-muted" style={{ padding: 16 }}>Loading...</p>
          ) : topDishes.length === 0 ? (
            <p className="sfx-muted" style={{ padding: 16 }}>No data</p>
          ) : (
            <ul className="sfx-rank">
              {topDishes.map((d) => (
                <li key={d.rank} className="sfx-rank__row">
                  <span className="sfx-rank__no">{d.rank}</span>
                  <span className="sfx-rank__main">
                    <strong>{d.dish_name}</strong>
                    <small>{d.qty_sold} sold</small>
                  </span>
                  <span className="sfx-rank__rev">{formatVND(d.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      {tab === "stats" ? (
        <div className="sfx-stack">
          <div className="sfx-statgrid">
            <div className="sfx-statcard">
              <span className="sfx-statcard__val">{stats.totalThisMonth}</span>
              <span className="sfx-statcard__lbl">Reservations this month</span>
            </div>
            <div className="sfx-statcard">
              <span className="sfx-statcard__val">{stats.completionRate}%</span>
              <span className="sfx-statcard__lbl">Completion rate</span>
            </div>
            <div className="sfx-statcard">
              <span className="sfx-statcard__val">{stats.noShowRate}%</span>
              <span className="sfx-statcard__lbl">No-show rate</span>
            </div>
            <div className="sfx-statcard">
              <span className="sfx-statcard__val">{stats.avgPartySize}</span>
              <span className="sfx-statcard__lbl">Avg party size</span>
            </div>
          </div>

          <div className="sfx-grid sfx-grid--2">
            <Card title="Reservations by area">
              <ul className="sfx-barlist">
                {statsByArea.map((a) => {
                  const max = Math.max(...statsByArea.map((x) => x.count));
                  return (
                    <li key={a.area}>
                      <span className="sfx-barlist__label">{a.area}</span>
                      <span className="sfx-bar">
                        <span className="sfx-bar__fill" style={{ width: `${(a.count / max) * 100}%` }} />
                      </span>
                      <span className="sfx-barlist__val">{a.count}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card title="Table utilization">
              <ul className="sfx-barlist">
                {utilizationList.map((u) => (
                  <li key={u.area}>
                    <span className="sfx-barlist__label">{u.area}</span>
                    <span className="sfx-bar">
                      <span className="sfx-bar__fill sfx-bar__fill--green" style={{ width: `${u.utilization}%` }} />
                    </span>
                    <span className="sfx-barlist__val">{u.utilization}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      ) : null}

      {tab === "export" ? (
        <Card title="Export & View Reports">
          {/* Hidden File Input for Upload */}
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".xlsx,.pdf"
            onChange={handleFileUpload}
          />

          {/* Confirm-before-run Step Banner (only when active) */}
          {showConfirm && currentIntent && (
            <div style={{ marginBottom: "24px", padding: "16px", background: "#fefce8", borderRadius: "8px", border: "1px solid #fef08a" }}>
              <h5 style={{ margin: "0 0 8px 0", color: "#854d0e", fontSize: "14px" }}>⚠️ Confirm details before generating {pendingFormat?.toUpperCase()} file</h5>
              <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#713f12" }}>
                Exporting <strong>{pendingFormat?.toUpperCase()}</strong>: Report type <strong>{currentIntent.report_type}</strong>, 
                From <strong>{currentIntent.date_range?.from}</strong> to <strong>{currentIntent.date_range?.to}</strong>, 
                Area: <strong>{currentIntent.filters?.area_name || "All"}</strong>, 
                Customer: <strong>{currentIntent.filters?.customer_type || currentIntent.customer_type_filter || "All"}</strong>.
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="sfx-btn sfx-btn--gold sfx-btn--sm"
                  onClick={() => handleExport(pendingFormat || "excel")}
                >
                  Confirm & Download Draft
                </button>
                <button
                  type="button"
                  style={{ padding: "6px 12px", borderRadius: "4px", border: "1px solid #d1d5db", background: "white", cursor: "pointer", fontSize: "13px" }}
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel / Rephrase
                </button>
              </div>
            </div>
          )}

          {/* Action Grid: Download Draft & Upload Reviewed File */}
          <div className="sfx-exportgrid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <button type="button" className="sfx-export" onClick={() => requestExportWithConfirm("excel")}>
              <Icon name="download" size={20} />
              <strong>Download Excel (Draft)</strong>
              <small>Download Excel file for offline review & editing</small>
            </button>
            <button type="button" className="sfx-export" onClick={() => requestExportWithConfirm("pdf")}>
              <Icon name="report" size={20} />
              <strong>Download PDF (Draft)</strong>
              <small>Download pre-formatted PDF file</small>
            </button>
            <button 
              type="button" 
              className="sfx-export" 
              style={{ borderColor: "#10b981", background: "rgba(16, 185, 129, 0.05)" }}
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              <Icon name="eye" size={20} />
              <strong style={{ color: "#059669" }}>Upload Reviewed Report</strong>
              <small>Submit edited .xlsx / .pdf file to Admin</small>
            </button>
          </div>

          {/* Data Grid View */}
          {reportData && reportData.length > 0 && (
            <div id="report-data-view" style={{ marginTop: "32px", overflowX: "auto" }}>
              <h4 style={{ marginBottom: "16px" }}>Preview Data ({reportData.length} rows)</h4>
              <table className="sfx-table">
                <thead>
                  <tr>
                    {Object.keys(reportData[0]).map(key => (
                      <th key={key}>{key}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((row, idx) => (
                    <tr key={idx}>
                      {Object.keys(reportData[0]).map((colKey, colIdx) => {
                        const val = row[colKey];
                        let displayVal = (val !== null && val !== undefined) ? String(val) : "";
                        if (typeof val === 'number' && colKey === 'total_amount') {
                          displayVal = formatVND(val);
                        } else if (typeof val === 'number') {
                          displayVal = val.toLocaleString("vi-VN");
                        }
                        return <td key={colIdx}>{displayVal}</td>;
                      })}
                    </tr>
                  ))}
                  {grandTotalRow && (
                    <tr style={{ fontWeight: "bold", background: "#fef9c3", color: "#854d0e" }}>
                      {Object.keys(reportData[0]).map((key, idx) => {
                        let val = grandTotalRow[key];
                        if (idx === 0 && (val === undefined || val === null || val === "")) val = "TỔNG CỘNG";
                        let displayVal = (val !== null && val !== undefined) ? String(val) : "";
                        if (typeof val === 'number' && key === 'total_amount') {
                          displayVal = formatVND(val);
                        } else if (typeof val === 'number') {
                          displayVal = val.toLocaleString("vi-VN");
                        }
                        return <td key={key}>{displayVal}</td>;
                      })}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : null}
      </ContentPanel>
    </div>
  );
}

export default ReportsSection;
