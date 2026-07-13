import sql from 'mssql';
import { getRawPool } from '../src/db.js';

export async function seedTestVouchers() {
  try {
    const pool = await getRawPool();
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // 1. Insert a Promotion
      const pResult = await transaction.request()
        .query(`
          INSERT INTO dbo.Promotions (promotion_name, description, discount_type, discount_value, min_order_value, max_discount, start_at, end_at, is_active)
          OUTPUT inserted.promotion_id
          VALUES (
            N'Weekend Special', N'10% off for weekend reservations', N'Percent', 10, 0, 50000, 
            DATEADD(day, -1, SYSDATETIME()), DATEADD(year, 1, SYSDATETIME()), 1
          )
        `);
      
      const promoId = pResult.recordset[0].promotion_id;

      // 2. Insert a Voucher for the promotion
      await transaction.request()
        .input('promoId', sql.Int, promoId)
        .query(`
          INSERT INTO dbo.Vouchers (promotion_id, voucher_code, usage_limit, times_used, is_active)
          VALUES (@promoId, N'WEEKEND10', 100, 0, 1)
        `);

      // 3. Insert a Fixed promotion
      const pResult2 = await transaction.request()
        .query(`
          INSERT INTO dbo.Promotions (promotion_name, description, discount_type, discount_value, min_order_value, max_discount, start_at, end_at, is_active)
          OUTPUT inserted.promotion_id
          VALUES (
            N'Fixed 20k Off', N'20,000 VND off your order', N'Fixed', 20000, 50000, NULL, 
            DATEADD(day, -1, SYSDATETIME()), DATEADD(year, 1, SYSDATETIME()), 1
          )
        `);
      
      const promoId2 = pResult2.recordset[0].promotion_id;

      await transaction.request()
        .input('promoId', sql.Int, promoId2)
        .query(`
          INSERT INTO dbo.Vouchers (promotion_id, voucher_code, usage_limit, times_used, is_active)
          VALUES (@promoId, N'FIXED20K', 50, 0, 1)
        `);

      await transaction.commit();
      console.log('✅ Successfully seeded test Promotions and Vouchers (WEEKEND10, FIXED20K)');
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  } catch (error) {
    console.error('❌ Failed to seed test vouchers:', error);
  } finally {
    
  }
}

