export default function ConfirmDeleteModal({ accountName, onCancel, onConfirm }) {
  return (
    <div className="afm-overlay">
      <div className="afm-modal" style={{ width: 360 }}>
        <p className="afm-title">Delete account</p>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
          Are you sure you want to delete the account <strong>{accountName}</strong>? This action cannot be undone.
        </p>
        <div className="afm-actions">
          <button className="afm-btn-outline" onClick={onCancel}>Cancel</button>
          <button className="afm-btn-primary" style={{ background: '#a32d2d' }} onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
