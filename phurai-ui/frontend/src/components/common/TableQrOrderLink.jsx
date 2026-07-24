import React, { useState } from 'react';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { Copy, Check, Link2, Download } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * TableQrOrderLink — displays static QR code, download SVG button, and copyable ordering URL link.
 * Dynamically resolves merged table URLs when tables are combined.
 */
export default function TableQrOrderLink({
  table,
  allTables = [],
  wrapperIdPrefix = 'qr-wrapper-',
  qrSize = 150,
}) {
  const [copied, setCopied] = useState(false);

  if (!table) return null;

  // Resolve parent table if merged
  const parentTable = table?.merged_into_table_id
    ? allTables.find(
        (t) =>
          Number(t.table_id || t.id) === Number(table.merged_into_table_id)
      )
    : null;

  const rawQrCode =
    parentTable?.static_qr_code ||
    parentTable?.qr_code ||
    table?.static_qr_code ||
    table?.qr_code;

  if (!rawQrCode) return null;

  const orderUrl = `${window.location.origin}/scan/${rawQrCode}`;
  const isMerged = Boolean(
    table.merged_into_table_id ||
      table.is_merged ||
      table.combined_table_name ||
      parentTable
  );

  const displayTableName =
    table.combined_table_name ||
    (parentTable
      ? `${parentTable.table_number || parentTable.table_id} + ${table.table_number || table.table_id}`
      : table.table_number || table.table_id);

  const handleCopy = () => {
    try {
      navigator.clipboard.writeText(orderUrl);
      setCopied(true);
      toast.success(`Đã sao chép link bàn ${displayTableName}!`);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('Không thể sao chép liên kết.');
    }
  };

  const handleDownload = () => {
    const wrapper = document.getElementById(
      `${wrapperIdPrefix}${table.table_id || table.id}`
    );
    const svg = wrapper?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Table-${table.table_number || 'QR'}-QR.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div
      style={{
        flex: '0 0 200px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        width: '100%',
      }}
    >
      <span
        className="sfx-muted"
        style={{
          fontSize: '12px',
          fontWeight: '700',
          whiteSpace: 'nowrap',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          color: isMerged ? '#d97706' : '#554b3d',
        }}
      >
        <Link2 size={13} style={{ color: isMerged ? '#d97706' : '#9b845e' }} />
        {isMerged
          ? `Link Bàn Ghép (${displayTableName})`
          : 'Static QR - Scan to Order'}
      </span>

      <div
        id={`${wrapperIdPrefix}${table.table_id || table.id}`}
        style={{
          background: '#fff',
          padding: '12px',
          borderRadius: '12px',
          border: isMerged ? '2px solid #f59e0b' : '1px solid var(--sfx-border-soft, #e5e0d8)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
        }}
      >
        <QRCode value={orderUrl} size={qrSize} />
      </div>

      {/* URL bar & Copy Button */}
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f9f8f6',
            border: '1px solid #e6e1da',
            borderRadius: '8px',
            padding: '4px 6px',
            gap: '4px',
          }}
        >
          <input
            type="text"
            readOnly
            value={orderUrl}
            onClick={(e) => e.target.select()}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#554b3d',
              outline: 'none',
              textOverflow: 'ellipsis',
            }}
          />
          <button
            type="button"
            onClick={handleCopy}
            style={{
              background: copied ? '#ecfdf5' : '#ffffff',
              color: copied ? '#059669' : '#342716',
              border: copied ? '1px solid #a7f3d0' : '1px solid #dcd6cd',
              borderRadius: '6px',
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s ease',
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Đã copy' : 'Copy'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleDownload}
          style={{
            width: '100%',
            padding: '6px 12px',
            borderRadius: '6px',
            border: '1px solid #e0d8cd',
            background: '#ffffff',
            fontSize: '12px',
            fontWeight: 600,
            color: '#4d4438',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Download size={13} />
          <span>Tải mã QR (Download)</span>
        </button>
      </div>
    </div>
  );
}
