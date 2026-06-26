export async function writeAudit(txFn, {
  userId,
  action,
  table,
  targetId,
  oldValue = null,
  newValue = null,
  ip       = null,
}) {
  const toJson = (val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'string') {
      try { JSON.parse(val); return val; } catch { /* fall through */ }
    }
    try { return JSON.stringify(val); } catch { return null; }
  };

  await txFn(
    `INSERT INTO dbo.AuditLogs
       (user_id, action_name, target_table, target_id,
        old_value_json, new_value_json, ip_address, created_at)
     VALUES
       (@UserId, @Action, @Table, @TargetId,
        @OldJson, @NewJson, @Ip, SYSDATETIME())`,
    {
      UserId:   userId   || null,
      Action:   String(action),
      Table:    table    || null,
      TargetId: targetId || null,
      OldJson:  toJson(oldValue),
      NewJson:  toJson(newValue),
      Ip:       ip       || null,
    }
  );
}

export const ACTION = {
  RESERVATION_CREATED:          'RESERVATION_CREATED',
  RESERVATION_EDITED:           'RESERVATION_EDITED',
  CONFIRM_RESERVATION:          'CONFIRM_RESERVATION',
  REJECT_RESERVATION:           'REJECT_RESERVATION',
  CHECK_IN_RESERVATION:         'CHECK_IN_RESERVATION',
  REJECT_CHECKIN:               'REJECT_CHECKIN',
  MANAGER_CANCELLED_RESERVATION:'MANAGER_CANCELLED_RESERVATION',
  CUSTOMER_CANCELLED_RESERVATION:'CUSTOMER_CANCELLED_RESERVATION',
};
