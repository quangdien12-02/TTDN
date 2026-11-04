require("dotenv").config();
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
});
(async () => {
  try {
    const schema = fs.readFileSync(
      path.join(__dirname, "..", "db", "schema.sql"),
      "utf8",
    );
    await pool.query(schema);
    await pool.query(`INSERT INTO departments(code,name,description) VALUES
      ('HCNS','Hành chính - Nhân sự','Quản lý hồ sơ và công tác nhân sự'),
      ('CNTT','Công nghệ thông tin','Phát triển và vận hành hệ thống'),
      ('KD','Kinh doanh','Phát triển khách hàng và kinh doanh') ON CONFLICT (code) DO NOTHING`);
    await pool.query(`INSERT INTO positions(code,name,description) VALUES
      ('GD','Giám đốc','Điều hành doanh nghiệp'),('TP','Trưởng phòng','Quản lý phòng ban'),
      ('DEV','Nhân viên phát triển phần mềm','Phát triển và bảo trì phần mềm'),('NV','Nhân viên','Nhân sự nghiệp vụ') ON CONFLICT (code) DO NOTHING`);
    const exists = await pool.query(
      "SELECT id FROM accounts WHERE username=$1",
      ["admin"],
    );
    if (!exists.rowCount) {
      const hash = await bcrypt.hash("123456", 12);
      await pool.query(
        "INSERT INTO accounts(username,password_hash,role) VALUES($1,$2,$3)",
        ["admin", hash, "admin"],
      );
    }
    const emp = await pool.query(
      "SELECT id FROM employees WHERE employee_code=$1",
      ["RBC0001"],
    );
    if (!emp.rowCount) {
      const dept = await pool.query(
        "SELECT id FROM departments WHERE code='CNTT'",
      );
      const pos = await pool.query("SELECT id FROM positions WHERE code='DEV'");
      const r = await pool.query(
        `INSERT INTO employees(employee_code,full_name,gender,phone,email,hire_date,department_id,position_id,status)
        VALUES('RBC0001','Nguyễn Văn An','Nam','0912345678','an@example.com',CURRENT_DATE,$1,$2,'Đang làm việc') RETURNING id`,
        [dept.rows[0].id, pos.rows[0].id],
      );
      await pool.query(
        "INSERT INTO contracts(contract_code,employee_id,contract_type,start_date,end_date,salary,status) VALUES($1,$2,$3,CURRENT_DATE,NULL,$4,$5) ON CONFLICT (contract_code) DO NOTHING",
        [
          "HD-RBC-0001",
          r.rows[0].id,
          "Hợp đồng lao động xác định thời hạn",
          15000000,
          "Đang hiệu lực",
        ],
      );
    }
    console.log("Đã khởi tạo schema và dữ liệu mẫu. Tài khoản: admin / 123456");
  } catch (e) {
    console.error("Không thể khởi tạo CSDL:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
