import { useCallback, useEffect, useState } from "react";
import {
  SectionHead,
  Button,
  EmptyState,
  NotConnectedNote,
} from "./StaffUI.jsx";
import {
  fetchKdsDelayedItems,
  fetchKdsReadyQueue,
  updateStaffOrderItemStatus,
} from "../services/staffApi.js";
import { DEMO_NOTICE } from "../data/staffDashboardMockData.js";
import "../styles/staff-kds-tab.css";

const POLL_MS = 12000;

function formatWait(minutes) {
  const value = Number(minutes) || 0;
  if (value < 60) return `${value} min`;
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  return mins ? `${hours}h ${mins}m` : `${hours} hr`;
}

function ReadyCard({ item, busy, onServe }) {
  return (
    <article className="staff-kds-card staff-kds-card--ready">
      <div className="staff-kds-card__main">
        <p className="staff-kds-card__dish">{item.dish_name}</p>
        <p className="staff-kds-card__meta">
          <span className="staff-kds-card__table">Table {item.table_number}</span>
          <span className="staff-kds-card__qty">×{item.quantity}</span>
        </p>
        <p className="staff-kds-card__wait">Waiting {formatWait(item.wait_minutes)}</p>
      </div>
      <Button
        variant="primary"
        size="sm"
        onClick={() => onServe(item)}
        disabled={busy === item.order_item_id}
      >
        {busy === item.order_item_id ? "Saving…" : "Served"}
      </Button>
    </article>
  );
}

function DelayedCard({ item }) {
  const statusLabel =
    item.display_status === "Cooking"
      ? "Cooking"
      : item.display_status === "Pending"
        ? "Pending kitchen"
        : item.display_status || item.item_status;

  return (
    <article className="staff-kds-card staff-kds-card--delayed">
      <div className="staff-kds-card__main">
        <p className="staff-kds-card__dish">{item.dish_name}</p>
        <p className="staff-kds-card__meta">
          <span className="staff-kds-card__table">Table {item.table_number}</span>
          <span className="staff-kds-card__qty">×{item.quantity}</span>
          <span className="staff-kds-card__status">{statusLabel}</span>
        </p>
        <p className="staff-kds-card__wait staff-kds-card__wait--alert">
          Over {formatWait(item.wait_minutes)}
        </p>
      </div>
    </article>
  );
}

function StaffKdsTab({ user, toast, onRefresh, refreshing }) {
  const [readyItems, setReadyItems] = useState([]);
  const [delayedItems, setDelayedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dataSource, setDataSource] = useState("mock");

  const userId = user?.userId ?? user?.user_id ?? user?.id;

  const loadQueues = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [readyRes, delayedRes] = await Promise.all([
        fetchKdsReadyQueue(),
        fetchKdsDelayedItems(),
      ]);
      setReadyItems(Array.isArray(readyRes.data) ? readyRes.data : []);
      setDelayedItems(Array.isArray(delayedRes.data) ? delayedRes.data : []);
      setDataSource(
        readyRes.source === "api" || delayedRes.source === "api" ? "api" : "mock"
      );
      setLastUpdated(new Date());
    } catch {
      toast?.("Could not load KDS data", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadQueues(false);
  }, [loadQueues]);

  useEffect(() => {
    const timer = setInterval(() => loadQueues(true), POLL_MS);
    return () => clearInterval(timer);
  }, [loadQueues]);

  const handleServe = async (item) => {
    if (!userId) {
      toast?.("Sign in to update items", "error");
      return;
    }

    setBusyItemId(item.order_item_id);
    try {
      const res = await updateStaffOrderItemStatus(item.order_item_id, userId, {
        item_status: "Served",
      });
      if (!res?.success) {
        toast?.(res?.message || "Could not mark as served", "error");
        return;
      }
      setReadyItems((prev) =>
        prev.filter((row) => row.order_item_id !== item.order_item_id)
      );
      toast?.(`Served ${item.dish_name} — table ${item.table_number}`, "success");
      onRefresh?.();
    } catch {
      toast?.("Could not mark as served", "error");
    } finally {
      setBusyItemId(null);
    }
  };

  const handleManualRefresh = () => {
    onRefresh?.();
    loadQueues(false);
  };

  return (
    <div className="staff-kds-tab">
      <SectionHead
        title="Alerts & KDS"
        subtitle="Track ready items and long-wait alerts — auto-refreshes every 12 seconds"
        actions={
          <Button
            variant="ghost"
            size="sm"
            icon="refresh"
            onClick={handleManualRefresh}
            disabled={refreshing || loading}
          >
            Refresh
          </Button>
        }
      />

      {dataSource === "mock" ? (
        <NotConnectedNote>{DEMO_NOTICE}</NotConnectedNote>
      ) : null}

      {lastUpdated ? (
        <p className="staff-kds-tab__sync">
          Updated at {lastUpdated.toLocaleTimeString("en-US")}
        </p>
      ) : null}

      {loading ? (
        <div className="sfx-loading staff-kds-tab__loading">
          <span className="sfx-spinner" />
          <p>Loading KDS queue…</p>
        </div>
      ) : (
        <div className="staff-kds-layout">
          <section className="staff-kds-panel staff-kds-panel--ready">
            <header className="staff-kds-panel__head">
              <h3>Ready to serve</h3>
              <span className="staff-kds-panel__count">{readyItems.length}</span>
            </header>
            <div className="staff-kds-panel__body">
              {readyItems.length ? (
                readyItems.map((item) => (
                  <ReadyCard
                    key={item.order_item_id}
                    item={item}
                    busy={busyItemId}
                    onServe={handleServe}
                  />
                ))
              ) : (
                <EmptyState
                  icon="check"
                  title="No items waiting to serve"
                  hint="Ready items appear here when the kitchen marks them complete"
                />
              )}
            </div>
          </section>

          <section className="staff-kds-panel staff-kds-panel--delayed">
            <header className="staff-kds-panel__head staff-kds-panel__head--alert">
              <h3>Long-wait alerts</h3>
              <span className="staff-kds-panel__count staff-kds-panel__count--alert">
                {delayedItems.length}
              </span>
            </header>
            <div className="staff-kds-panel__body">
              {delayedItems.length ? (
                delayedItems.map((item) => (
                  <DelayedCard key={item.order_item_id} item={item} />
                ))
              ) : (
                <EmptyState
                  icon="spark"
                  title="No alerts"
                  hint="Pending or cooking items over 15 minutes appear here"
                />
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default StaffKdsTab;
