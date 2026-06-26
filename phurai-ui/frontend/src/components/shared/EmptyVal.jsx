import React from 'react';

export default function EmptyVal({ val, fallback = "Require Update" }) {
  if (val == null || val === "" || val === "—" || val === "---") {
    return <span style={{ color: "var(--sfx-muted, #9ca3af)", fontStyle: "italic", fontSize: "0.95em", fontWeight: "normal" }}>{fallback}</span>;
  }
  return <>{val}</>;
}
