import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config({ path: '/Volumes/Kingston/Github/SWP391-GROUP-3-RESTAURANT-MANAGEMENT-SYSTEM/phurai-ui/.env' });

const config = {
  server: "127.0.0.1",
  port: 1433,
  database: "System_Restaurant",
  user: "sa",
  password: "PhuraiLocal@2026",
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

async function seed() {
  try {
    const pool = await sql.connect(config);
    console.log("Connected to SQL Server.");

    const staffData = [
      { full_name: 'Nguyen Van An', email: 'an.nv@phurai.vn', phone: '0901000011', job_title_id: 4, salary: 11000000, title: 'Waiter' },
      { full_name: 'Tran Thi Binh', email: 'binh.tt@phurai.vn', phone: '0901000012', job_title_id: 4, salary: 11000000, title: 'Waiter' },
      { full_name: 'Le Van Cuong', email: 'cuong.lv@phurai.vn', phone: '0901000013', job_title_id: 7, salary: 13000000, title: 'Bartender' },
      { full_name: 'Pham Thi Dung', email: 'dung.pt@phurai.vn', phone: '0901000014', job_title_id: 8, salary: 12000000, title: 'Host/Hostess' },
      { full_name: 'Ngo Thi Giang', email: 'giang.nt@phurai.vn', phone: '0901000016', job_title_id: 13, salary: 11000000, title: 'Server' },
      { full_name: 'Vu Van Hai', email: 'hai.vv@phurai.vn', phone: '0901000017', job_title_id: 4, salary: 11000000, title: 'Waiter' },
      { full_name: 'Do Thi Khanh', email: 'khanh.dt@phurai.vn', phone: '0901000018', job_title_id: 7, salary: 13000000, title: 'Bartender' },
      { full_name: 'Bui Van Lam', email: 'lam.bv@phurai.vn', phone: '0901000019', job_title_id: 10, salary: 10000000, title: 'Kitchen Porter' },
      { full_name: 'Phan Thi Mai', email: 'mai.pt@phurai.vn', phone: '0901000020', job_title_id: 12, salary: 11500000, title: 'Line Cook' },
    ];

    for (const s of staffData) {
      const check = await pool.request()
        .input('email', sql.NVarChar, s.email)
        .query('SELECT 1 FROM dbo.StaffProfiles WHERE email = @email');

      if (check.recordset.length === 0) {
        const staffCode = 'STF' + String(Math.floor(100 + Math.random() * 900));
        await pool.request()
          .input('fullName', sql.NVarChar, s.full_name)
          .input('email', sql.NVarChar, s.email)
          .input('phone', sql.VarChar, s.phone)
          .input('jobTitleId', sql.Int, s.job_title_id)
          .input('jobTitle', sql.NVarChar, s.title)
          .input('salary', sql.Decimal(18, 2), s.salary)
          .input('staffCode', sql.VarChar, staffCode)
          .query(`
            INSERT INTO dbo.StaffProfiles (user_id, staff_code, job_title, job_title_id, hire_date, employment_status, base_salary, has_system_account, full_name, email, phone)
            VALUES (NULL, @staffCode, @jobTitle, @jobTitleId, CAST(GETDATE() AS DATE), N'Active', @salary, 0, @fullName, @email, @phone)
          `);
        console.log(`Inserted staff: ${s.full_name}`);
      } else {
        console.log(`Staff already exists: ${s.full_name}`);
      }
    }
    console.log("Seeding without-account staff completed successfully.");
  } catch (err) {
    console.error("Error seeding:", err.message);
  } finally {
    process.exit(0);
  }
}

seed();
