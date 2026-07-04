import { getRawPool } from '../db.js';
import { RESERVATION_STATUS } from '../constants/reservationStatus.js';

export const purgeMockData = async (req, res) => {
    try {
        const pool = await getRawPool();

        // Delete all mock reservations (where contact_name starts with 'Mock Customer')
        await pool.request().query(`
            DELETE FROM dbo.ReservationTables WHERE reservation_id IN (SELECT reservation_id FROM dbo.Reservations WHERE contact_name LIKE 'Mock Customer %');
            DELETE FROM dbo.Reservations 
            WHERE contact_name LIKE 'Mock Customer %';
        `);

        return res.status(200).json({
            success: true,
            message: "All mock data successfully purged from database."
        });
    } catch (error) {
        console.error('[mockDataController] purgeMockData error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const seedMockData = async (req, res) => {
    try {
        const pool = await getRawPool();

        // 1. Implicitly purge existing mock data to prevent stacking
        await pool.request().query(`
            DELETE FROM dbo.ReservationTables WHERE reservation_id IN (SELECT reservation_id FROM dbo.Reservations WHERE contact_name LIKE 'Mock Customer %');
            DELETE FROM dbo.Reservations 
            WHERE contact_name LIKE 'Mock Customer %';
        `);

        // 2. Fetch some valid table IDs to associate the mock data with
        const tablesResult = await pool.request().query(`
            SELECT TOP 5 table_id FROM dbo.RestaurantTables WHERE table_status != N'Inactive'
        `);
        const tables = tablesResult.recordset;
        const fallbackTableId = tables.length > 0 ? tables[0].table_id : null;

        // Fetch a staff ID for checked_in_by_staff_id
        const staffResult = await pool.request().query(`
            SELECT TOP 1 user_id FROM dbo.UserAccounts WHERE role_id = 2 AND is_active = 1
        `);
        const staffId = staffResult.recordset.length > 0 ? staffResult.recordset[0].user_id : null;

        // 3. Generate 10 records
        const statuses = [RESERVATION_STATUS.CHECK_OUT, RESERVATION_STATUS.SEATED, RESERVATION_STATUS.COMPLETED];

        for (let i = 1; i <= 10; i++) {
            let status, tableId, checkedInBy;

            if (i <= 3) {
                // First 3 are Pending Payment
                status = RESERVATION_STATUS.PENDING_PAYMENT;
                tableId = null;
                checkedInBy = null;
            } else {
                // Next 7 are random
                status = statuses[Math.floor(Math.random() * statuses.length)];
                tableId = tables.length > 0 ? tables[i % tables.length].table_id : fallbackTableId;
                checkedInBy = (status === RESERVATION_STATUS.SEATED || status === RESERVATION_STATUS.COMPLETED || status === RESERVATION_STATUS.CHECK_OUT) ? staffId : null;
            }

            const request = pool.request();
            const startAt = new Date(Date.now() + i * 3600000);
            const endAt = new Date(startAt.getTime() + 7200000); // +2 hours

            request.input('contactName', `Mock Customer ${i}`);
            request.input('contactPhone', `09000000${i.toString().padStart(2, '0')}`);
            request.input('guestCount', Math.floor(Math.random() * 4) + 1);
            request.input('reservationStart', startAt);
            request.input('reservationEnd', endAt);
            request.input('reservationStatus', status);
            request.input('checkedInBy', checkedInBy);

            const insertRes = await request.query(`
                INSERT INTO dbo.Reservations 
                (contact_name, contact_phone, guest_count, reservation_start_at, reservation_end_at, reservation_status, checked_in_at, reservation_source)
                OUTPUT INSERTED.reservation_id
                VALUES 
                (@contactName, @contactPhone, @guestCount, @reservationStart, @reservationEnd, @reservationStatus, ${checkedInBy ? 'SYSDATETIME()' : 'NULL'}, N'Online');
            `);

            const newId = insertRes.recordset[0].reservation_id;

            if (tableId) {
                await pool.request()
                    .input('resId', newId)
                    .input('tblId', tableId)
                    .query(`
                        INSERT INTO dbo.ReservationTables (reservation_id, table_id)
                        VALUES (@resId, @tblId)
                    `);
            }
        }

        return res.status(201).json({
            success: true,
            message: "10 mock records successfully seeded into SQL Database."
        });

    } catch (error) {
        console.error('[mockDataController] seedMockData error:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
};
