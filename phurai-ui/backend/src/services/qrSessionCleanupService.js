import sql from "mssql";

/**
 * End every active QR ordering session belonging to a completed checkout.
 * Authentication sessions are deliberately not touched; only table-ordering
 * sessions are cleared so the next seated party starts cleanly.
 */
export async function closeQrSessionsForCheckout({ transaction, tableId, reservationId = null }) {
  const request = new sql.Request(transaction);
  request.input("tableId", sql.SmallInt, tableId);
  request.input("reservationId", sql.Int, reservationId);

  const result = await request.query(`
    DECLARE @Closed TABLE (qr_session_id INT);
    UPDATE dbo.QROrderSessions
    SET session_status = N'Closed',
        closed_at = SYSDATETIME(),
        -- generated_at is stored with the SQL server's local clock in some
        -- legacy flows.  Derive expiry from it so the expiry constraint stays
        -- valid regardless of the server/API timezone.
        expires_at = COALESCE(expires_at, DATEADD(second, 1, generated_at))
    OUTPUT INSERTED.qr_session_id INTO @Closed
    WHERE session_status IN (N'Active', N'Pending')
      AND (
        table_id = @tableId
        OR (@reservationId IS NOT NULL AND reservation_id = @reservationId)
      );
    SELECT qr_session_id FROM @Closed;
  `);

  return result.recordset.map((row) => Number(row.qr_session_id));
}
