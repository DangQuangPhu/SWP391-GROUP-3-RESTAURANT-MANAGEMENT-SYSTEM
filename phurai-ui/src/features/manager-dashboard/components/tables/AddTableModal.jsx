import { useEffect, useMemo, useRef, useState } from "react";
import { ManagerModal } from "../ManagerOverlay.jsx";
import { Button } from "../ManagerUI.jsx";
import Icon from "../ManagerIcons.jsx";
import { TABLE_STATUS_META } from "../../data/managerDashboardMockData.js";
import {
  createTable,
  fetchAreas,
  fetchFilteredTables,
  fetchNextTableNumber,
} from "../../services/managerApi.js";
import {
  EMPTY_NEW_TABLE,
  STATUS_KEYS,
  STATUS_SLUG_TO_API,
} from "./tableConstants.js";

const DUPLICATE_CHECK_MS = 350;
const AREA_SUGGEST_DEBOUNCE_MS = 300;

function normalizeTableNumber(value) {
  return String(value ?? "").trim().toLowerCase();
}

function isValidAreaId(areaId) {
  const parsed = Number(areaId);
  return Number.isFinite(parsed) && parsed > 0;
}

function isAbortError(error) {
  return error?.name === "AbortError" || error?.code === "ABORT_ERR";
}

function AddTableModal({ open, onClose, onSuccess, managerUserId }) {
  const [form, setForm] = useState({ ...EMPTY_NEW_TABLE });
  const [areas, setAreas] = useState([]);
  const [areasLoading, setAreasLoading] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const [numberConflict, setNumberConflict] = useState(false);
  const [suggestedCapacity, setSuggestedCapacity] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const suggestRequestRef = useRef(0);

  useEffect(() => {
    if (!open || !managerUserId) return undefined;

    let alive = true;
    setAreasLoading(true);
    setFormError("");
    setNumberConflict(false);
    setSuggestedCapacity(null);
    setForm({ ...EMPTY_NEW_TABLE });

    fetchAreas(managerUserId)
      .then((res) => {
        if (!alive) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setAreas(list);
        if (list.length > 0) {
          setForm((prev) => ({ ...prev, area_id: String(list[0].area_id) }));
        }
      })
      .catch(() => {
        if (!alive) return;
        setFormError("Could not load restaurant areas.");
      })
      .finally(() => {
        if (alive) setAreasLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [open, managerUserId]);

  useEffect(() => {
    if (!open || !managerUserId || !isValidAreaId(form.area_id)) {
      setSuggestLoading(false);
      return undefined;
    }

    const requestId = ++suggestRequestRef.current;
    const areaId = String(form.area_id);
    const controller = new AbortController();

    setSuggestLoading(false);

    const timer = window.setTimeout(async () => {
      if (suggestRequestRef.current !== requestId) return;

      setSuggestLoading(true);

      try {
        const data = await fetchNextTableNumber(areaId, managerUserId, {
          signal: controller.signal,
        });

        if (suggestRequestRef.current !== requestId || controller.signal.aborted) return;

        setSuggestedCapacity(data.suggested_capacity ?? null);
        setForm((prev) => ({
          ...prev,
          table_number: data.table_number ?? prev.table_number,
          capacity: data.suggested_capacity ?? prev.capacity,
        }));
        setNumberConflict(false);
      } catch (error) {
        if (
          suggestRequestRef.current !== requestId ||
          controller.signal.aborted ||
          isAbortError(error)
        ) {
          return;
        }
        setFormError(error?.message || "Could not suggest next table number.");
      } finally {
        if (suggestRequestRef.current === requestId) {
          setSuggestLoading(false);
        }
      }
    }, AREA_SUGGEST_DEBOUNCE_MS);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, managerUserId, form.area_id]);

  useEffect(() => {
    if (!open || !managerUserId) return undefined;

    const tableNumber = form.table_number.trim();
    const areaId = form.area_id;

    if (!tableNumber || !areaId) {
      setNumberConflict(false);
      return undefined;
    }

    let alive = true;
    const timer = window.setTimeout(async () => {
      setDuplicateChecking(true);
      try {
        const res = await fetchFilteredTables(
          { search: tableNumber, area_id: areaId },
          managerUserId
        );
        if (!alive) return;

        const exists = (Array.isArray(res.data) ? res.data : []).some(
          (table) => normalizeTableNumber(table.table_number) === normalizeTableNumber(tableNumber)
        );
        setNumberConflict(exists);
        if (exists) setFormError("");
      } catch {
        if (!alive) return;
        setNumberConflict(false);
      } finally {
        if (alive) setDuplicateChecking(false);
      }
    }, DUPLICATE_CHECK_MS);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [open, managerUserId, form.table_number, form.area_id]);

  const handleAreaChange = (nextAreaId) => {
    setFormError("");
    setNumberConflict(false);
    setForm((prev) => ({ ...prev, area_id: nextAreaId }));
  };

  const handleSubmit = async () => {
    if (!managerUserId) {
      setFormError("Manager session required.");
      return;
    }
    if (!form.table_number.trim()) {
      setFormError("Table number is required.");
      return;
    }
    if (numberConflict) {
      return;
    }

    const areaId = Number(form.area_id);
    const capacity = Number(form.capacity);
    const tableStatus = STATUS_SLUG_TO_API[form.status];

    if (!Number.isFinite(areaId) || areaId <= 0) {
      setFormError("Select a valid area.");
      return;
    }
    if (!Number.isFinite(capacity) || capacity <= 0) {
      setFormError("Capacity must be greater than 0.");
      return;
    }
    if (!tableStatus) {
      setFormError("Select a valid table status.");
      return;
    }

    setSaving(true);
    setFormError("");

    try {
      await createTable(
        {
          table_number: form.table_number.trim(),
          area_id: areaId,
          capacity,
          table_status: tableStatus,
        },
        managerUserId
      );
      onSuccess?.();
      onClose?.();
    } catch (error) {
      const message = error?.message || "Could not create table.";
      if (/already exists in this area/i.test(message)) {
        setNumberConflict(true);
        setFormError("");
      } else {
        setFormError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || areasLoading || suggestLoading || duplicateChecking;
  const tableNumberMissing = !form.table_number.trim();
  const canSubmit = !busy && !tableNumberMissing && !numberConflict;

  const duplicateMessage = useMemo(() => {
    if (!numberConflict || !form.table_number.trim()) return "";
    return `Table number ${form.table_number.trim()} already exists in this area.`;
  }, [numberConflict, form.table_number]);

  return (
    <ManagerModal
      open={open}
      title="Add Table"
      onClose={onClose}
      footer={
        <div className="sfx-modal__footacts">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="gold" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? "Adding…" : "Add table"}
          </Button>
        </div>
      }
    >
      <div className="sfx-form">
        {formError ? (
          <div className="sfx-note sfx-note--error" role="alert">
            <Icon name="spark" size={15} />
            <span>{formError}</span>
          </div>
        ) : null}

        <label className="sfx-field">
          <span>Table number</span>
          <input
            className={`sfx-input ${numberConflict ? "sfx-input--error" : ""}`}
            value={form.table_number}
            onChange={(e) => {
              setFormError("");
              setNumberConflict(false);
              setForm((prev) => ({ ...prev, table_number: e.target.value }));
            }}
            placeholder="e.g. K-04"
            disabled={saving || areasLoading || suggestLoading}
            aria-invalid={numberConflict}
          />
          {duplicateMessage ? (
            <span className="sfx-field-error" role="alert">
              {duplicateMessage}
            </span>
          ) : null}
        </label>

        <div className="sfx-form__row">
          <label className="sfx-field">
            <span>Area</span>
            <select
              className="sfx-select"
              value={form.area_id}
              onChange={(e) => handleAreaChange(e.target.value)}
              disabled={saving || areasLoading}
            >
              {areasLoading ? (
                <option value="">Loading areas…</option>
              ) : (
                areas.map((area) => (
                  <option key={area.area_id} value={area.area_id}>
                    {area.area_name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label className="sfx-field">
            <span>Capacity</span>
            <input
              className="sfx-input"
              type="number"
              min="1"
              max="20"
              value={form.capacity}
              onChange={(e) => {
                setFormError("");
                setForm((prev) => ({ ...prev, capacity: e.target.value }));
              }}
              disabled={saving || areasLoading || suggestLoading}
            />
            {suggestedCapacity ? (
              <span className="sfx-field__hint">
                Suggested: {suggestedCapacity} seats (based on this area)
              </span>
            ) : null}
          </label>
        </div>

        <label className="sfx-field">
          <span>Status</span>
          <div className="sfx-chips">
            {STATUS_KEYS.map((slug) => (
              <button
                key={slug}
                type="button"
                className={`sfx-chip ${form.status === slug ? "is-active" : "sfx-chip--outline"}`}
                onClick={() => {
                  setFormError("");
                  setForm((prev) => ({ ...prev, status: slug }));
                }}
                disabled={saving || areasLoading || suggestLoading}
              >
                {TABLE_STATUS_META[slug].label}
              </button>
            ))}
          </div>
        </label>
      </div>
    </ManagerModal>
  );
}

export default AddTableModal;
