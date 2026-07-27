import React from 'react';

export default function AccountActionButtons({
  row,
  accountType = 'staff',
  onReview,
  onDeactivate,
  onEdit,
  disabled = false,
  updating = false,
}) {
  const isDeactivated = row?.employment_status === 'Resigned' || row?.is_active === 0 || row?.account_is_active === 0;

  return (
    <div className="adm-action-pills sfx-staff__actions-container">
      {onEdit && (
        <button
          type="button"
          onClick={() => onEdit && onEdit(row)}
          disabled={disabled || updating}
          className="adm-pill-btn adm-pill-btn--edit sfx-staff__btn-action"
        >
          Edit
        </button>
      )}

      {onReview && (
        <button
          type="button"
          onClick={() => onReview && onReview(row)}
          disabled={disabled || updating}
          className="adm-pill-btn adm-pill-btn--review sfx-staff__btn-action"
        >
          Review
        </button>
      )}

      {onDeactivate && (
        <button
          type="button"
          onClick={() => onDeactivate && onDeactivate(row)}
          disabled={disabled || updating || isDeactivated}
          className="adm-pill-btn adm-pill-btn--delete sfx-staff__btn-delete"
          style={{
            opacity: isDeactivated ? 0.5 : 1,
            cursor: isDeactivated ? 'not-allowed' : 'pointer',
          }}
          title={isDeactivated ? 'Account is already inactive/resigned' : 'Deactivate account'}
        >
          {updating ? '...' : isDeactivated ? 'Inactive' : 'Delete'}
        </button>
      )}
    </div>
  );
}
