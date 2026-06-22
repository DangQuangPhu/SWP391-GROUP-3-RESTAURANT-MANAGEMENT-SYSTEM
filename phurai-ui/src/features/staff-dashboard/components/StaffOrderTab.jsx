import { useCallback, useEffect, useMemo, useState } from "react";
import {
  SectionHead,
  Button,
  EmptyState,
  NotConnectedNote,
} from "./StaffUI.jsx";
import StaffAddItemModal from "./StaffAddItemModal.jsx";
import StaffItemNotesModal from "./StaffItemNotesModal.jsx";
import {
  addStaffOrderItem,
  fetchStaffMenuDishes,
  updateStaffOrderItemStatus,
  voidStaffOrderItem,
} from "../services/staffApi.js";
import { DEMO_NOTICE } from "@/shared/constants.js";
import { asArray } from "@/utils/asArray.js";
import "../styles/staff-order-tab.css";

const STATUS_LABELS = {
  Pending: "Pending",
  Cooking: "Cooking",
  Ready: "Ready",
  Served: "Served",
};

function formatItemCount(count) {
  const value = Number(count) || 0;
  return `${value} item${value === 1 ? "" : "s"}`;
}

function formatReadyShort(count) {
  const value = Number(count) || 0;
  return value ? `${value} ready` : "";
}

function formatReadyDetail(count) {
  const value = Number(count) || 0;
  return value ? `${value} item${value === 1 ? "" : "s"} ready` : "";
}

function isManagerUser(user) {
  return Number(user?.roleId ?? user?.role_id) === 4;
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="staff-order-action__lock">
      <path
        d="M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusChip({ status }) {
  const key = status || "Pending";
  const slug = key.toLowerCase();
  return (
    <span className={`staff-order-status staff-order-status--${slug}`}>
      {STATUS_LABELS[key] || key}
    </span>
  );
}

function StaffOrderTab({
  orderTables,
  setOrderTables,
  dataSource,
  user,
  toast,
  refreshing,
  onRefresh,
}) {
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [dishes, setDishes] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [notesItem, setNotesItem] = useState(null);
  const [busyKey, setBusyKey] = useState(null);

  const userId = user?.userId ?? user?.user_id ?? user?.id;
  const manager = isManagerUser(user);

  useEffect(() => {
    let cancelled = false;
    fetchStaffMenuDishes().then((res) => {
      if (!cancelled) setDishes(Array.isArray(res.data) ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const tables = useMemo(
    () => (Array.isArray(orderTables) ? orderTables : []),
    [orderTables]
  );

  useEffect(() => {
    if (!tables.length) {
      setSelectedTableId(null);
      return;
    }
    if (!tables.some((t) => t.table_id === selectedTableId)) {
      setSelectedTableId(tables[0].table_id);
    }
  }, [tables, selectedTableId]);

  const selectedTable = useMemo(
    () => tables.find((t) => t.table_id === selectedTableId) ?? null,
    [tables, selectedTableId]
  );

  const patchTableItems = useCallback(
    (tableId, updater) => {
      setOrderTables((prev) =>
        prev.map((table) => {
          if (table.table_id !== tableId) return table;
          const items = updater(table.items || []);
          return { ...table, items };
        })
      );
    },
    [setOrderTables]
  );

  const handleAddItem = async (payload) => {
    if (!selectedTable) return;
    setBusyKey("add");
    try {
      const res = await addStaffOrderItem(selectedTable.table_id, userId, payload);
      const item = res?.data?.item;
      const orderId = res?.data?.order_id;

      if (item) {
        setOrderTables((prev) =>
          prev.map((table) => {
            if (table.table_id !== selectedTable.table_id) return table;
            const items = [...(table.items || []), item];
            return {
              ...table,
              order_id: orderId ?? table.order_id,
              items,
            };
          })
        );
        toast(`Added ${item.dish_name}`, "success");
        setAddOpen(false);
      }
    } catch (error) {
      toast(error.message || "Could not add item", "error");
    } finally {
      setBusyKey(null);
    }
  };

  const handleSaveNotes = async (notes) => {
    if (!notesItem || !selectedTable) return;
    setBusyKey(`notes-${notesItem.order_item_id}`);
    try {
      const res = await updateStaffOrderItemStatus(
        notesItem.order_item_id,
        userId,
        { notes }
      );
      const item = res?.data?.item;
      if (item) {
        patchTableItems(selectedTable.table_id, (items) =>
          items.map((row) =>
            row.order_item_id === item.order_item_id ? { ...row, ...item } : row
          )
        );
        toast("Notes updated", "success");
        setNotesItem(null);
      }
    } catch (error) {
      toast(error.message || "Could not save notes", "error");
    } finally {
      setBusyKey(null);
    }
  };

  const handleMarkServed = async (item) => {
    if (!selectedTable) return;
    setBusyKey(`serve-${item.order_item_id}`);
    try {
      const res = await updateStaffOrderItemStatus(item.order_item_id, userId, {
        item_status: "Served",
      });
      const updated = res?.data?.item;
      if (updated) {
        patchTableItems(selectedTable.table_id, (items) =>
          items.map((row) =>
            row.order_item_id === updated.order_item_id ? { ...row, ...updated } : row
          )
        );
        toast(`${item.dish_name} — marked as served`, "success");
      }
    } catch (error) {
      toast(error.message || "Could not update item status", "error");
    } finally {
      setBusyKey(null);
    }
  };

  const handleVoid = async (item) => {
    if (!manager || !selectedTable) return;
    const confirmed = window.confirm(
      `Void "${item.dish_name}" from table ${selectedTable.table_number} bill?`
    );
    if (!confirmed) return;

    setBusyKey(`void-${item.order_item_id}`);
    try {
      await voidStaffOrderItem(item.order_item_id, userId);
      patchTableItems(selectedTable.table_id, (items) =>
        items.filter((row) => row.order_item_id !== item.order_item_id)
      );
      toast("Item voided", "info");
    } catch (error) {
      toast(error.message || "Could not void item", "error");
    } finally {
      setBusyKey(null);
    }
  };

  const readyCount = (selectedTable?.items || []).filter(
    (i) => i.display_status === "Ready"
  ).length;

  return (
    <div className={`staff-order-wrap${refreshing ? " is-loading" : ""}`}>
      <div className="staff-card staff-order-intro">
        <SectionHead
          title="Order Management"
          subtitle="Monitor items for occupied tables, add manual orders, and confirm service."
          actions={
            <Button
              variant="ghost"
              icon="refresh"
              onClick={onRefresh}
              disabled={refreshing}
            >
              Refresh
            </Button>
          }
        />

        {dataSource === "mock" ? (
          <NotConnectedNote>{DEMO_NOTICE}</NotConnectedNote>
        ) : null}
      </div>

      {!tables.length ? (
        <div className="staff-card">
          <EmptyState
            icon="table"
            title="No occupied tables"
            hint="Check in a table from Table Management to start an order."
          />
        </div>
      ) : (
        <div className="staff-order-layout">
          <aside className="staff-order-sidebar staff-card staff-card--compact staff-card--flush">
            <p className="staff-order-sidebar__title">ACTIVE TABLES</p>
            <div className="staff-order-pills" role="tablist" aria-label="Select table">
              {tables.map((table) => {
                const count = table.items?.length ?? 0;
                const ready = (table.items || []).filter(
                  (i) => i.display_status === "Ready"
                ).length;
                return (
                  <button
                    key={table.table_id}
                    type="button"
                    role="tab"
                    aria-selected={table.table_id === selectedTableId}
                    className={`staff-order-pill${
                      table.table_id === selectedTableId ? " is-active" : ""
                    }`}
                    onClick={() => setSelectedTableId(table.table_id)}
                  >
                    <span className="staff-order-pill__no">{table.table_number}</span>
                    <span className="staff-order-pill__meta">{table.area_name}</span>
                    <span className="staff-order-pill__count">
                      {formatItemCount(count)}
                      {ready ? ` · ${formatReadyShort(ready)}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="staff-order-main staff-card staff-card--compact staff-card--flush">
            {selectedTable ? (
              <>
                <div className="staff-order-main__head">
                  <div>
                    <h3 className="staff-order-main__title">
                      Table {selectedTable.table_number}
                    </h3>
                    <p className="staff-order-main__sub">
                      {selectedTable.area_name} · {selectedTable.capacity} seats
                      {readyCount ? ` · ${formatReadyDetail(readyCount)}` : ""}
                    </p>
                  </div>
                  <Button variant="primary" icon="plus" onClick={() => setAddOpen(true)}>
                    Add Item
                  </Button>
                </div>

                <div className="sfx-table-wrap">
                  <table className="sfx-table sfx-table--hover staff-order-table">
                    <thead>
                      <tr>
                        <th>ITEM</th>
                        <th>QTY</th>
                        <th>NOTES</th>
                        <th>STATUS</th>
                        <th className="sfx-table__right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedTable.items || []).length === 0 ? (
                        <tr>
                          <td colSpan={5}>
                            <EmptyState
                              icon="receipt"
                              title="No items on this bill"
                              hint='Click "Add Item" to place an order for the guest.'
                            />
                          </td>
                        </tr>
                      ) : (
                        (selectedTable.items || []).map((item) => {
                          const display = item.display_status || "Pending";
                          const isServed = display === "Served";
                          const isPending = display === "Pending";
                          const isReady = display === "Ready";
                          const rowBusy = busyKey?.includes(String(item.order_item_id));

                          return (
                            <tr
                              key={item.order_item_id}
                              className={isServed ? "staff-order-row--served" : ""}
                            >
                              <td>{item.dish_name}</td>
                              <td>{item.quantity}</td>
                              <td>
                                {item.notes ? (
                                  <span className="staff-order-notes">{item.notes}</span>
                                ) : (
                                  <span className="staff-order-notes staff-order-notes--empty">
                                    —
                                  </span>
                                )}
                              </td>
                              <td>
                                <StatusChip status={display} />
                              </td>
                              <td className="sfx-table__right">
                                <div className="staff-order-actions">
                                  {isPending ? (
                                    <button
                                      type="button"
                                      className="staff-order-action"
                                      disabled={rowBusy}
                                      onClick={() => setNotesItem(item)}
                                    >
                                      Notes
                                    </button>
                                  ) : null}
                                  {isReady ? (
                                    <button
                                      type="button"
                                      className="staff-order-action staff-order-action--primary"
                                      disabled={rowBusy}
                                      onClick={() => handleMarkServed(item)}
                                    >
                                      Mark as Served
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    className="staff-order-action staff-order-action--danger"
                                    disabled={!manager || isServed || rowBusy}
                                    title={
                                      manager
                                        ? "Void item from bill"
                                        : "Only managers can void items"
                                    }
                                    onClick={() => handleVoid(item)}
                                  >
                                    {!manager ? <LockIcon /> : null}
                                    Void
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}
          </section>
        </div>
      )}

      <StaffAddItemModal
        open={addOpen}
        dishes={dishes}
        busy={busyKey === "add"}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddItem}
      />

      <StaffItemNotesModal
        open={Boolean(notesItem)}
        item={notesItem}
        busy={busyKey?.startsWith("notes-")}
        onClose={() => setNotesItem(null)}
        onSubmit={handleSaveNotes}
      />
    </div>
  );
}

export default StaffOrderTab;
