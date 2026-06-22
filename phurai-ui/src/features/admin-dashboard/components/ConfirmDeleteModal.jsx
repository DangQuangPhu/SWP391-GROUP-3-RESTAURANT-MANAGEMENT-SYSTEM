export default function ConfirmDeleteModal({ accountName, onCancel, onConfirm }) {
  return (
    <div className="afm-overlay">
      <div className="afm-modal" style={{ width: 360 }}>
        <p className="afm-title">Delete account</p>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 20 }}>
          Bạn chắc chắn muốn xoá tài khoản <strong>{accountName}</strong>? Hành động này không thể hoàn tác.
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
