import pool from './server/db.js';

async function alterTable() {
    try {
        const query = `
            IF NOT EXISTS (
                SELECT * FROM sys.columns 
                WHERE Name = N'applicable_to' 
                AND Object_ID = Object_ID(N'dbo.Promotions')
            )
            BEGIN
                ALTER TABLE dbo.Promotions ADD applicable_to NVARCHAR(50) DEFAULT 'Both' NOT NULL;
                PRINT 'Column applicable_to added successfully.';
            END
            ELSE
            BEGIN
                PRINT 'Column applicable_to already exists.';
            END
        `;
        const result = await pool.query(query);
        console.log("Migration result:", result);
    } catch (e) {
        console.error("Migration error:", e);
    } finally {
        process.exit(0);
    }
}

alterTable();
