/**
 * Idempotent patch: creates reservation-related tables missing from a partial DB.
 * Mirrors definitions + seed data from server/database/System_Restaurant.sql
 * without dropping existing auth tables.
 *
 * Usage: node scripts/apply-reservation-schema.js
 */
import pool from "../db.js";

async function tableExists(name) {
  const [rows] = await pool.query(
    `SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = ?`,
    [name]
  );
  return rows.length > 0;
}

async function rowCount(table) {
  const [rows] = await pool.query(`SELECT COUNT(*) AS n FROM dbo.${table}`);
  return Number(rows[0]?.n || 0);
}

async function exec(sqlText) {
  await pool.query(sqlText);
}

const DDL = [
  `CREATE TABLE dbo.RestaurantAreas (
    area_id       SMALLINT IDENTITY(1,1) NOT NULL,
    area_name     NVARCHAR(80) NOT NULL,
    area_type     NVARCHAR(20) NOT NULL CONSTRAINT DF_RestaurantAreas_type DEFAULT N'Regular',
    description   NVARCHAR(255) NULL,
    is_active     BIT NOT NULL CONSTRAINT DF_RestaurantAreas_is_active DEFAULT 1,
    created_at    DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantAreas_created_at DEFAULT SYSDATETIME(),
    updated_at    DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantAreas_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_RestaurantAreas PRIMARY KEY (area_id),
    CONSTRAINT UQ_RestaurantAreas_area_name UNIQUE (area_name),
    CONSTRAINT CK_RestaurantAreas_type CHECK (area_type IN (N'Regular', N'VIP', N'Outdoor', N'Bar', N'Private'))
  )`,
  `CREATE TABLE dbo.RestaurantTables (
    table_id       SMALLINT IDENTITY(1,1) NOT NULL,
    area_id        SMALLINT NOT NULL,
    table_number   NVARCHAR(20) NOT NULL,
    capacity       TINYINT NOT NULL,
    table_status   NVARCHAR(20) NOT NULL CONSTRAINT DF_RestaurantTables_status DEFAULT N'Available',
    static_qr_code  NVARCHAR(120) NULL,
    notes           NVARCHAR(255) NULL,
    created_at      DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantTables_created_at DEFAULT SYSDATETIME(),
    updated_at      DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantTables_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_RestaurantTables PRIMARY KEY (table_id),
    CONSTRAINT UQ_RestaurantTables_table_number UNIQUE (table_number),
    CONSTRAINT UQ_RestaurantTables_static_qr_code UNIQUE (static_qr_code),
    CONSTRAINT FK_RestaurantTables_RestaurantAreas FOREIGN KEY (area_id) REFERENCES dbo.RestaurantAreas(area_id),
    CONSTRAINT CK_RestaurantTables_capacity CHECK (capacity > 0),
    CONSTRAINT CK_RestaurantTables_status CHECK (table_status IN
        (N'Available', N'Reserved', N'Occupied', N'Cleaning', N'Inactive'))
  )`,
  `CREATE TABLE dbo.MenuCategories (
    category_id     SMALLINT IDENTITY(1,1) NOT NULL,
    category_name   NVARCHAR(80) NOT NULL,
    display_order   TINYINT NOT NULL CONSTRAINT DF_MenuCategories_display DEFAULT 0,
    is_active       BIT NOT NULL CONSTRAINT DF_MenuCategories_is_active DEFAULT 1,
    created_at      DATETIME2(0) NOT NULL CONSTRAINT DF_MenuCategories_created_at DEFAULT SYSDATETIME(),
    updated_at      DATETIME2(0) NOT NULL CONSTRAINT DF_MenuCategories_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_MenuCategories PRIMARY KEY (category_id),
    CONSTRAINT UQ_MenuCategories_category_name UNIQUE (category_name)
  )`,
  `CREATE TABLE dbo.Dishes (
    dish_id          INT IDENTITY(1,1) NOT NULL,
    category_id      SMALLINT NOT NULL,
    dish_name        NVARCHAR(150) NOT NULL,
    description      NVARCHAR(1000) NULL,
    price            DECIMAL(12,2) NOT NULL,
    cost_price       DECIMAL(12,2) NULL,
    is_available     BIT NOT NULL CONSTRAINT DF_Dishes_is_available DEFAULT 1,
    is_recommended   BIT NOT NULL CONSTRAINT DF_Dishes_is_recommended DEFAULT 0,
    spicy_level      TINYINT NOT NULL CONSTRAINT DF_Dishes_spicy DEFAULT 0,
    prep_time_min    SMALLINT NULL,
    created_at       DATETIME2(0) NOT NULL CONSTRAINT DF_Dishes_created_at DEFAULT SYSDATETIME(),
    updated_at       DATETIME2(0) NOT NULL CONSTRAINT DF_Dishes_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Dishes PRIMARY KEY (dish_id),
    CONSTRAINT FK_Dishes_MenuCategories FOREIGN KEY (category_id) REFERENCES dbo.MenuCategories(category_id),
    CONSTRAINT CK_Dishes_price CHECK (price >= 0),
    CONSTRAINT CK_Dishes_cost_price CHECK (cost_price IS NULL OR cost_price >= 0),
    CONSTRAINT CK_Dishes_spicy_level CHECK (spicy_level BETWEEN 0 AND 5),
    CONSTRAINT CK_Dishes_prep_time CHECK (prep_time_min IS NULL OR prep_time_min > 0)
  )`,
  `CREATE TABLE dbo.Reservations (
    reservation_id        INT IDENTITY(1,1) NOT NULL,
    customer_id           INT NULL,
    created_by_staff_id   INT NULL,
    preferred_area_id     SMALLINT NULL,
    reservation_start_at  DATETIME2(0) NOT NULL,
    reservation_end_at    DATETIME2(0) NOT NULL,
    guest_count           TINYINT NOT NULL,
    special_request       NVARCHAR(1000) NULL,
    reservation_status    NVARCHAR(20) NOT NULL CONSTRAINT DF_Reservations_status DEFAULT N'Pending',
    reservation_source    NVARCHAR(20) NOT NULL CONSTRAINT DF_Reservations_source DEFAULT N'Online',
    confirmed_by_staff_id INT NULL,
    confirmed_at          DATETIME2(0) NULL,
    checked_in_at         DATETIME2(0) NULL,
    cancelled_at          DATETIME2(0) NULL,
    cancel_reason         NVARCHAR(255) NULL,
    reminder_sent         BIT NOT NULL CONSTRAINT DF_Reservations_reminder DEFAULT 0,
    created_at            DATETIME2(0) NOT NULL CONSTRAINT DF_Reservations_created_at DEFAULT SYSDATETIME(),
    updated_at            DATETIME2(0) NOT NULL CONSTRAINT DF_Reservations_updated_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_Reservations PRIMARY KEY (reservation_id),
    CONSTRAINT FK_Reservations_Customer FOREIGN KEY (customer_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_Reservations_CreatedByStaff FOREIGN KEY (created_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT FK_Reservations_PreferredArea FOREIGN KEY (preferred_area_id) REFERENCES dbo.RestaurantAreas(area_id),
    CONSTRAINT FK_Reservations_ConfirmedByStaff FOREIGN KEY (confirmed_by_staff_id) REFERENCES dbo.UserAccounts(user_id),
    CONSTRAINT CK_Reservations_guest_count CHECK (guest_count > 0),
    CONSTRAINT CK_Reservations_time CHECK (reservation_end_at > reservation_start_at),
    CONSTRAINT CK_Reservations_status CHECK (reservation_status IN
        (N'Pending', N'Confirmed', N'Checked In', N'Completed', N'Cancelled', N'No Show')),
    CONSTRAINT CK_Reservations_source CHECK (reservation_source IN (N'Online', N'Walk-in', N'Phone'))
  )`,
  `CREATE TABLE dbo.ReservationTables (
    reservation_id   INT NOT NULL,
    table_id         SMALLINT NOT NULL,
    assigned_by_staff_id INT NULL,
    assigned_at      DATETIME2(0) NOT NULL CONSTRAINT DF_ReservationTables_assigned_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_ReservationTables PRIMARY KEY (reservation_id, table_id),
    CONSTRAINT FK_ReservationTables_Reservations FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id) ON DELETE CASCADE,
    CONSTRAINT FK_ReservationTables_RestaurantTables FOREIGN KEY (table_id) REFERENCES dbo.RestaurantTables(table_id),
    CONSTRAINT FK_ReservationTables_AssignedBy FOREIGN KEY (assigned_by_staff_id) REFERENCES dbo.UserAccounts(user_id)
  )`,
  `CREATE TABLE dbo.PreorderItems (
    preorder_item_id  INT IDENTITY(1,1) NOT NULL,
    reservation_id    INT NOT NULL,
    dish_id           INT NOT NULL,
    quantity          SMALLINT NOT NULL CONSTRAINT DF_PreorderItems_quantity DEFAULT 1,
    unit_price        DECIMAL(12,2) NOT NULL,
    notes             NVARCHAR(255) NULL,
    created_at        DATETIME2(0) NOT NULL CONSTRAINT DF_PreorderItems_created_at DEFAULT SYSDATETIME(),
    CONSTRAINT PK_PreorderItems PRIMARY KEY (preorder_item_id),
    CONSTRAINT FK_PreorderItems_Reservations FOREIGN KEY (reservation_id) REFERENCES dbo.Reservations(reservation_id) ON DELETE CASCADE,
    CONSTRAINT FK_PreorderItems_Dishes FOREIGN KEY (dish_id) REFERENCES dbo.Dishes(dish_id),
    CONSTRAINT CK_PreorderItems_quantity CHECK (quantity > 0),
    CONSTRAINT CK_PreorderItems_unit_price CHECK (unit_price >= 0)
  )`,
];

const TABLE_ORDER = [
  "RestaurantAreas",
  "RestaurantTables",
  "MenuCategories",
  "Dishes",
  "Reservations",
  "ReservationTables",
  "PreorderItems",
];

async function ensureTables() {
  for (let i = 0; i < TABLE_ORDER.length; i += 1) {
    const name = TABLE_ORDER[i];
    if (await tableExists(name)) {
      console.log(`✓ ${name} already exists`);
      continue;
    }
    console.log(`+ Creating ${name}...`);
    await exec(DDL[i]);
    console.log(`  Created ${name}`);
  }
}

async function ensureRestaurantSettings() {
  if (!(await tableExists("RestaurantSettings"))) {
    console.log("+ Creating RestaurantSettings...");
    await exec(`CREATE TABLE dbo.RestaurantSettings (
      setting_key     NVARCHAR(100) NOT NULL,
      setting_value   NVARCHAR(1000) NOT NULL,
      description     NVARCHAR(255) NULL,
      updated_by      INT NULL,
      updated_at      DATETIME2(0) NOT NULL CONSTRAINT DF_RestaurantSettings_updated_at DEFAULT SYSDATETIME(),
      CONSTRAINT PK_RestaurantSettings PRIMARY KEY (setting_key),
      CONSTRAINT FK_RestaurantSettings_UserAccounts FOREIGN KEY (updated_by) REFERENCES dbo.UserAccounts(user_id)
    )`);
  }
  if ((await rowCount("RestaurantSettings")) === 0) {
    await exec(`INSERT INTO dbo.RestaurantSettings (setting_key, setting_value, description, updated_by) VALUES
      (N'restaurant_name',  N'Phūrai Premium Restaurant', N'Display name', 1),
      (N'open_time',        N'10:00',                     N'Opening time', 1),
      (N'close_time',       N'22:00',                     N'Closing time', 1),
      (N'table_hold_min',   N'15',                        N'Minutes to hold reserved table', 1),
      (N'service_charge',   N'5',                         N'Service charge percent', 1),
      (N'max_guests',       N'12',                        N'Max guests per reservation', 1),
      (N'cancel_deadline_h',N'2',                         N'Hours before reservation to cancel', 1)`);
    console.log("  Seeded RestaurantSettings");
  }
}

async function seedIfEmpty() {
  if ((await rowCount("RestaurantAreas")) === 0) {
    await exec(`SET IDENTITY_INSERT dbo.RestaurantAreas ON;
      INSERT INTO dbo.RestaurantAreas (area_id, area_name, area_type, description) VALUES
      (1, N'Main Dining',    N'Regular', N'Ground floor open seating'),
      (2, N'VIP Lounge',     N'VIP',     N'Private VIP booths with dedicated waiter'),
      (3, N'Garden Terrace', N'Outdoor', N'Outdoor seating with garden view'),
      (4, N'Wine Bar',       N'Bar',     N'Bar seating near the wine cellar'),
      (5, N'Private Room A', N'Private', N'Bookable private room for events');
      SET IDENTITY_INSERT dbo.RestaurantAreas OFF`);
    console.log("  Seeded RestaurantAreas");
  }

  if ((await rowCount("RestaurantTables")) === 0) {
    await exec(`SET IDENTITY_INSERT dbo.RestaurantTables ON;
      INSERT INTO dbo.RestaurantTables (table_id, area_id, table_number, capacity, table_status, static_qr_code) VALUES
      (1,  1, N'T01', 2,  N'Available', N'qr-t01-abc123'),
      (2,  1, N'T02', 4,  N'Available', N'qr-t02-def456'),
      (3,  1, N'T03', 4,  N'Occupied',  N'qr-t03-ghi789'),
      (4,  1, N'T04', 6,  N'Reserved',  N'qr-t04-jkl012'),
      (5,  2, N'V01', 4,  N'Available', N'qr-v01-vip001'),
      (6,  2, N'V02', 6,  N'Available', N'qr-v02-vip002'),
      (7,  3, N'G01', 4,  N'Available', N'qr-g01-gar001'),
      (8,  3, N'G02', 4,  N'Cleaning',  N'qr-g02-gar002'),
      (9,  4, N'B01', 2,  N'Available', N'qr-b01-bar001'),
      (10, 5, N'P01', 12, N'Available', N'qr-p01-pvt001');
      SET IDENTITY_INSERT dbo.RestaurantTables OFF`);
    console.log("  Seeded RestaurantTables (10 tables)");
  }

  if ((await rowCount("MenuCategories")) === 0) {
    await exec(`SET IDENTITY_INSERT dbo.MenuCategories ON;
      INSERT INTO dbo.MenuCategories (category_id, category_name, display_order) VALUES
      (1, N'Sushi & Sashimi', 1), (2, N'Noodle & Rice', 2), (3, N'Signature Dish', 3),
      (4, N'Seafood', 4), (5, N'Barbecue & Grill', 5), (6, N'Desserts', 6),
      (7, N'Beverages', 7), (8, N'Chef''s Set Menu', 8);
      SET IDENTITY_INSERT dbo.MenuCategories OFF`);
    console.log("  Seeded MenuCategories");
  }

  if ((await rowCount("Dishes")) === 0) {
    await exec(`SET IDENTITY_INSERT dbo.Dishes ON;
      INSERT INTO dbo.Dishes (dish_id, category_id, dish_name, description, price, cost_price, is_available, is_recommended, spicy_level, prep_time_min) VALUES
      (9,  3, N'BLACK COD WITH MISO', N'tender black cod marinated for three days in a sweet miso glaze', 499000, 175000, 1, 1, 0, 22),
      (10, 3, N'ROCK SHRIMP TEMPURA', N'served with either creamy spicy sauce or butter ponzu', 690000, 240000, 1, 1, 1, 18),
      (11, 4, N'LOBSTER WASABI PEPPER', N'whole lobster sautéed with black pepper, wasabi, and seasonal greens', 690000, 240000, 1, 1, 2, 25),
      (13, 5, N'JAPANESE A5 WAGYU', N'the pinnacle of beef quality, flame-grilled over binchotan charcoal', 890000, 310000, 1, 1, 0, 20),
      (18, 7, N'LYCHEE MARTINI', N'vodka, lychee liqueur, fresh lychee juice', 89000, 31000, 1, 1, 0, 3);
      SET IDENTITY_INSERT dbo.Dishes OFF`);
    console.log("  Seeded Dishes (preorder subset)");
  }
}

async function verifyAvailability() {
  const slotStart = new Date(2026, 5, 10, 18, 0, 0);
  const slotEnd = new Date(slotStart.getTime() + 120 * 60000);
  const [rows] = await pool.query(
    `SELECT t.table_number, t.capacity, t.table_status,
            CASE WHEN t.table_status IN (N'Occupied', N'Cleaning', N'Inactive', N'Reserved') THEN t.table_status
                 ELSE N'Available' END AS availability_at_slot
     FROM dbo.RestaurantTables t
     JOIN dbo.RestaurantAreas a ON t.area_id = a.area_id
     WHERE a.is_active = 1
     ORDER BY t.table_number`,
    []
  );
  console.log(`\nAvailability check: ${rows.length} tables loaded`);
  rows.forEach((r) => console.log(`  ${r.table_number} · ${r.capacity}p · ${r.availability_at_slot}`));
}

async function main() {
  console.log("Applying reservation schema patch...\n");
  await ensureRestaurantSettings();
  await ensureTables();
  await seedIfEmpty();
  await verifyAvailability();
  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Patch failed:", err.message);
  process.exit(1);
});
