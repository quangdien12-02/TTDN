require("dotenv").config();
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const methodOverride = require("method-override");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");
const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
});
const PORT = Number(process.env.PORT || 3000);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(methodOverride("_method"));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "dev-only-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  res.locals.currentPath = req.path;
  next();
});
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  if (req.session.user.role !== "admin") {
    req.session.flash = {
      type: "danger",
      message: "Bạn không có quyền thực hiện thao tác này.",
    };
    return res.redirect("/");
  }
  next();
}
function flash(req, type, message) {
  req.session.flash = { type, message };
}
function clean(v) {
  return typeof v === "string" ? v.trim() : "";
}
function validId(v) {
  return /^\d+$/.test(String(v)) && Number(v) > 0;
}
function filterId(v) {
  const id = Number(v);
  return /^\d+$/.test(String(v)) &&
    Number.isSafeInteger(id) &&
    id > 0 &&
    id <= 2147483647
    ? String(id)
    : "";
}
function createCaptcha(req, scope) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  req.session.captchaAnswers = req.session.captchaAnswers || {};
  req.session.captchaAnswers[scope] = Array.from(
    { length: 5 },
    () => alphabet[crypto.randomInt(alphabet.length)],
  ).join("");
}
function validCaptcha(req, scope) {
  const expected = req.session.captchaAnswers?.[scope];
  if (req.session.captchaAnswers) delete req.session.captchaAnswers[scope];
  return (
    typeof expected === "string" &&
    clean(req.body.captcha).toUpperCase() === expected
  );
}
function captchaSvg(code) {
  const glyphs = Array.from(code, (character, index) => {
    const x = 37 + index * 42,
      y = 54 + crypto.randomInt(-7, 8),
      angle = crypto.randomInt(-24, 25);
    return `<text x="${x}" y="${y}" transform="rotate(${angle} ${x} ${y})">${character}</text>`;
  }).join("");
  const interference = Array.from(
    { length: 5 },
    () =>
      `<path d="M${crypto.randomInt(0, 280)} ${crypto.randomInt(0, 82)} Q${crypto.randomInt(0, 280)} ${crypto.randomInt(0, 82)} ${crypto.randomInt(0, 280)} ${crypto.randomInt(0, 82)}"/>`,
  ).join("");
  const seed = crypto.randomInt(1, 1000);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="82" viewBox="0 0 280 82"><defs><filter id="warp"><feTurbulence type="fractalNoise" baseFrequency=".025 .08" numOctaves="2" seed="${seed}" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="4"/></filter></defs><rect width="280" height="82" rx="4" fill="#acd8d8"/><g fill="none" stroke="#528f96" stroke-opacity=".35" stroke-width="1.5">${interference}</g><g filter="url(#warp)" fill="#112d79" font-family="Georgia,serif" font-size="40" font-weight="bold" font-style="italic" letter-spacing="2">${glyphs}</g></svg>`;
}
app.get("/captcha.svg", (req, res) => {
  const scope = req.query.scope === "forgot" ? "forgot" : "login";
  if (scope === "login" && !req.session.loginCaptchaRequired)
    return res.sendStatus(404);
  if (!req.session.captchaAnswers?.[scope]) createCaptcha(req, scope);
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.type("image/svg+xml").send(captchaSvg(req.session.captchaAnswers[scope]));
});
app.post("/captcha/refresh", (req, res) => {
  const scope = req.body.scope;
  if (
    scope !== "forgot" &&
    (scope !== "login" || !req.session.loginCaptchaRequired)
  )
    return res.sendStatus(400);
  createCaptcha(req, scope);
  res.set("Cache-Control", "no-store");
  res.json({ ok: true });
});
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.get("/login", (req, res) => {
  if (req.session.user) return res.redirect("/");
  if (req.session.loginCaptchaRequired && !req.session.captchaAnswers?.login)
    createCaptcha(req, "login");
  res.render("auth/login", {
    title: "Đăng nhập",
    error: null,
    username: "",
    captchaRequired: Boolean(req.session.loginCaptchaRequired),
  });
});
app.post(
  "/login",
  asyncHandler(async (req, res) => {
    if (req.session.loginCaptchaRequired && !validCaptcha(req, "login")) {
      createCaptcha(req, "login");
      return res.status(400).render("auth/login", {
        title: "Đăng nhập",
        error: "Mã xác nhận không chính xác. Vui lòng thử lại.",
        username: clean(req.body.username),
        captchaRequired: true,
      });
    }
    const username = clean(req.body.username),
      password = String(req.body.password || "");
    const r = await pool.query(
      "SELECT id,username,password_hash,role,employee_id,is_active FROM accounts WHERE username=$1 LIMIT 1",
      [username],
    );
    if (
      !r.rowCount ||
      !r.rows[0].is_active ||
      !(await bcrypt.compare(password, r.rows[0].password_hash))
    ) {
      req.session.loginCaptchaRequired = true;
      createCaptcha(req, "login");
      return res.status(401).render("auth/login", {
        title: "Đăng nhập",
        error: "Tên đăng nhập hoặc mật khẩu không chính xác.",
        username,
        captchaRequired: true,
      });
    }
    const a = r.rows[0];
    req.session.regenerate((err) => {
      if (err) return res.status(500).send("Không thể tạo phiên đăng nhập.");
      req.session.user = {
        id: a.id,
        username: a.username,
        role: a.role,
        employeeId: a.employee_id,
      };
      req.session.save(() => res.redirect("/"));
    });
  }),
);
app.get("/forgot-password", (req, res) => {
  if (req.session.user) return res.redirect("/");
  createCaptcha(req, "forgot");
  res.render("auth/forgot-password", {
    title: "Quên mật khẩu",
    error: null,
    message: null,
  });
});
app.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    if (!validCaptcha(req, "forgot")) {
      createCaptcha(req, "forgot");
      return res.status(400).render("auth/forgot-password", {
        title: "Quên mật khẩu",
        error: "Mã xác nhận không chính xác. Vui lòng thử lại.",
        message: null,
      });
    }
    const username = clean(req.body.username).slice(0, 80);
    if (username) {
      const account = await pool.query(
        "SELECT id FROM accounts WHERE username=$1",
        [username],
      );
      if (account.rowCount)
        await pool.query(
          "INSERT INTO password_reset_requests(account_id) VALUES($1) ON CONFLICT(account_id) DO UPDATE SET requested_at=NOW()",
          [account.rows[0].id],
        );
    }
    createCaptcha(req, "forgot");
    res.render("auth/forgot-password", {
      title: "Quên mật khẩu",
      error: null,
      message:
        "Yêu cầu đã được gửi nếu tài khoản tồn tại. Vui lòng liên hệ quản trị viên để nhận mật khẩu mới.",
    });
  }),
);
app.post("/logout", (req, res) =>
  req.session.destroy(() => res.redirect("/login")),
);
app.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const [e, d, p, c, latest] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS n FROM employees"),
      pool.query("SELECT COUNT(*)::int AS n FROM departments"),
      pool.query("SELECT COUNT(*)::int AS n FROM positions"),
      pool.query(
        "SELECT COUNT(*)::int AS n FROM contracts WHERE status='Đang hiệu lực'",
      ),
      pool.query(
        `SELECT e.employee_code,e.full_name,e.status,d.name AS department_name,p.name AS position_name FROM employees e LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN positions p ON p.id=e.position_id ORDER BY e.created_at DESC LIMIT 6`,
      ),
    ]);
    let own = null;
    if (req.session.user.role !== "admin" && req.session.user.employeeId) {
      const q = await pool.query(
        `SELECT e.*,d.name AS department_name,p.name AS position_name FROM employees e LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN positions p ON p.id=e.position_id WHERE e.id=$1`,
        [req.session.user.employeeId],
      );
      own = q.rows[0] || null;
    }
    res.render("dashboard", {
      title: "Tổng quan",
      stats: {
        employees: e.rows[0].n,
        departments: d.rows[0].n,
        positions: p.rows[0].n,
        contracts: c.rows[0].n,
      },
      latest: latest.rows,
      own,
    });
  }),
);
const resources = {
  employees: {
    table: "employees",
    title: "Nhân viên",
    base: "/employees",
    admin: true,
    fields: [
      ["employee_code", "Mã nhân viên", "text", true],
      ["full_name", "Họ và tên", "text", true],
      ["date_of_birth", "Ngày sinh", "date", false],
      ["gender", "Giới tính", "select", true, ["Nam", "Nữ", "Khác"]],
      ["phone", "Số điện thoại", "text", false],
      ["email", "Email", "email", false],
      ["address", "Địa chỉ", "textarea", false],
      ["hire_date", "Ngày vào làm", "date", true],
      ["department_id", "Phòng ban", "department", false],
      ["position_id", "Chức vụ", "position", false],
      [
        "status",
        "Trạng thái",
        "select",
        true,
        ["Đang làm việc", "Tạm nghỉ", "Đã nghỉ việc"],
      ],
    ],
  },
  departments: {
    table: "departments",
    title: "Phòng ban",
    base: "/departments",
    admin: true,
    fields: [
      ["code", "Mã phòng ban", "text", true],
      ["name", "Tên phòng ban", "text", true],
      ["description", "Mô tả", "textarea", false],
    ],
  },
  positions: {
    table: "positions",
    title: "Chức vụ",
    base: "/positions",
    admin: true,
    fields: [
      ["code", "Mã chức vụ", "text", true],
      ["name", "Tên chức vụ", "text", true],
      ["description", "Mô tả", "textarea", false],
    ],
  },
  contracts: {
    table: "contracts",
    title: "Hợp đồng lao động",
    base: "/contracts",
    admin: true,
    fields: [
      ["contract_code", "Mã hợp đồng", "text", true],
      ["employee_id", "Nhân viên", "employee", true],
      [
        "contract_type",
        "Loại hợp đồng",
        "select",
        true,
        [
          "Thử việc",
          "Không xác định thời hạn",
          "Hợp đồng lao động xác định thời hạn",
          "Cộng tác viên",
        ],
      ],
      ["start_date", "Ngày bắt đầu", "date", true],
      ["end_date", "Ngày kết thúc", "date", false],
      ["salary", "Mức lương (VNĐ)", "number", true],
      [
        "status",
        "Trạng thái",
        "select",
        true,
        ["Đang hiệu lực", "Hết hạn", "Đã chấm dứt"],
      ],
      ["notes", "Ghi chú", "textarea", false],
    ],
  },
};
async function optionsFor() {
  const [d, p, e] = await Promise.all([
    pool.query("SELECT id,name FROM departments ORDER BY name"),
    pool.query("SELECT id,name FROM positions ORDER BY name"),
    pool.query(
      "SELECT id,employee_code,full_name FROM employees ORDER BY full_name",
    ),
  ]);
  return { departments: d.rows, positions: p.rows, employees: e.rows };
}
function selectSql(resource, search, filters) {
  if (resource === "employees")
    return {
      sql: `SELECT e.*,d.name AS department_name,p.name AS position_name FROM employees e LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN positions p ON p.id=e.position_id WHERE ($1='' OR e.employee_code ILIKE '%'||$1||'%' OR e.full_name ILIKE '%'||$1||'%' OR COALESCE(e.email,'') ILIKE '%'||$1||'%' OR COALESCE(e.phone,'') ILIKE '%'||$1||'%' OR COALESCE(d.name,'') ILIKE '%'||$1||'%' OR COALESCE(p.name,'') ILIKE '%'||$1||'%') AND ($2::int IS NULL OR e.department_id=$2) AND ($3::int IS NULL OR e.position_id=$3) AND ($4='' OR e.status=$4) ORDER BY e.created_at DESC`,
      params: [
        search,
        filters.department_id || null,
        filters.position_id || null,
        filters.status,
      ],
    };
  if (resource === "departments")
    return {
      sql: `SELECT d.*, (SELECT COUNT(*)::int FROM employees e WHERE e.department_id=d.id) AS employee_count FROM departments d WHERE ($1='' OR d.code ILIKE '%'||$1||'%' OR d.name ILIKE '%'||$1||'%' OR COALESCE(d.description,'') ILIKE '%'||$1||'%') ORDER BY d.name`,
      params: [search],
    };
  if (resource === "positions")
    return {
      sql: `SELECT p.*, (SELECT COUNT(*)::int FROM employees e WHERE e.position_id=p.id) AS employee_count FROM positions p WHERE ($1='' OR p.code ILIKE '%'||$1||'%' OR p.name ILIKE '%'||$1||'%' OR COALESCE(p.description,'') ILIKE '%'||$1||'%') ORDER BY p.name`,
      params: [search],
    };
  return {
    sql: `SELECT c.*,e.employee_code,e.full_name FROM contracts c JOIN employees e ON e.id=c.employee_id WHERE ($1='' OR c.contract_code ILIKE '%'||$1||'%' OR e.full_name ILIKE '%'||$1||'%' OR e.employee_code ILIKE '%'||$1||'%' OR c.contract_type ILIKE '%'||$1||'%') AND ($2='' OR c.status=$2) AND ($3='' OR c.contract_type=$3) ORDER BY c.created_at DESC`,
    params: [search, filters.status, filters.contract_type],
  };
}
for (const [key, r] of Object.entries(resources)) {
  app.get(
    r.base,
    requireAuth,
    asyncHandler(async (req, res) => {
      if (r.admin && req.session.user.role !== "admin" && key !== "employees")
        return res.redirect("/");
      const search = clean(req.query.q);
      const filters = {
        department_id: filterId(req.query.department_id),
        position_id: filterId(req.query.position_id),
        status: clean(req.query.status),
        contract_type: clean(req.query.contract_type),
      };
      const employeeStatuses = resources.employees.fields.find(
        (f) => f[0] === "status",
      )[4];
      const contractStatuses = resources.contracts.fields.find(
        (f) => f[0] === "status",
      )[4];
      const contractTypes = resources.contracts.fields.find(
        (f) => f[0] === "contract_type",
      )[4];
      if (key === "employees" && !employeeStatuses.includes(filters.status))
        filters.status = "";
      if (key === "contracts") {
        if (!contractStatuses.includes(filters.status)) filters.status = "";
        if (!contractTypes.includes(filters.contract_type))
          filters.contract_type = "";
      }
      let { sql, params } = selectSql(key, search, filters);
      if (key === "employees" && req.session.user.role !== "admin") {
        if (!req.session.user.employeeId)
          return res.status(403).render("error", {
            title: "Không có hồ sơ",
            message: "Tài khoản chưa được liên kết với hồ sơ nhân viên.",
          });
        sql = `SELECT e.*,d.name AS department_name,p.name AS position_name FROM employees e LEFT JOIN departments d ON d.id=e.department_id LEFT JOIN positions p ON p.id=e.position_id WHERE e.id=$1 AND ($2='' OR e.employee_code ILIKE '%'||$2||'%' OR e.full_name ILIKE '%'||$2||'%')`;
        params = [req.session.user.employeeId, search];
      }
      const [result, departments, positions] =
        key === "employees" && req.session.user.role === "admin"
          ? await Promise.all([
              pool.query(sql, params),
              pool.query("SELECT id,name FROM departments ORDER BY name"),
              pool.query("SELECT id,name FROM positions ORDER BY name"),
            ])
          : [await pool.query(sql, params), null, null];
      res.render("resource-list", {
        title: r.title,
        resource: key,
        config: r,
        rows: result.rows,
        search,
        filters,
        filterOptions: {
          departments: departments?.rows || [],
          positions: positions?.rows || [],
          employeeStatuses,
          contractStatuses,
          contractTypes,
        },
      });
    }),
  );
  app.get(
    r.base + "/new",
    requireAdmin,
    asyncHandler(async (req, res) =>
      res.render("resource-form", {
        title: "Thêm " + r.title,
        resource: key,
        config: r,
        item: {},
        options: await optionsFor(),
        error: null,
        action: r.base,
      }),
    ),
  );
  app.post(
    r.base,
    requireAdmin,
    asyncHandler(async (req, res) => {
      const vals = r.fields.map((f) => clean(req.body[f[0]]) || null);
      const columns = r.fields.map((f) => f[0]);
      if (r.fields.some((f, i) => f[3] && !vals[i]))
        return res.status(400).render("resource-form", {
          title: "Thêm " + r.title,
          resource: key,
          config: r,
          item: req.body,
          options: await optionsFor(),
          error: "Vui lòng nhập đầy đủ các trường bắt buộc.",
          action: r.base,
        });
      const sql = `INSERT INTO ${r.table} (${columns.join(",")}) VALUES (${vals.map((_, i) => "$" + (i + 1)).join(",")}) RETURNING id`;
      const result = await pool.query(sql, vals);
      flash(req, "success", "Đã thêm dữ liệu thành công.");
      res.redirect(r.base);
    }),
  );
  app.get(
    r.base + "/:id/edit",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!validId(req.params.id)) return res.sendStatus(400);
      const q = await pool.query(`SELECT * FROM ${r.table} WHERE id=$1`, [
        req.params.id,
      ]);
      if (!q.rowCount) return res.sendStatus(404);
      res.render("resource-form", {
        title: "Cập nhật " + r.title,
        resource: key,
        config: r,
        item: q.rows[0],
        options: await optionsFor(),
        error: null,
        action: r.base + "/" + q.rows[0].id + "?_method=PUT",
      });
    }),
  );
  app.put(
    r.base + "/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!validId(req.params.id)) return res.sendStatus(400);
      const vals = r.fields.map((f) => clean(req.body[f[0]]) || null);
      const columns = r.fields.map((f) => f[0]);
      if (r.fields.some((f, i) => f[3] && !vals[i]))
        return res.status(400).render("resource-form", {
          title: "Cập nhật " + r.title,
          resource: key,
          config: r,
          item: { ...req.body, id: req.params.id },
          options: await optionsFor(),
          error: "Vui lòng nhập đầy đủ các trường bắt buộc.",
          action: r.base + "/" + req.params.id + "?_method=PUT",
        });
      const sets = columns.map((c, i) => `${c}=$${i + 1}`).join(",");
      await pool.query(
        `UPDATE ${r.table} SET ${sets} WHERE id=$${vals.length + 1}`,
        [...vals, req.params.id],
      );
      flash(req, "success", "Đã cập nhật dữ liệu.");
      res.redirect(r.base);
    }),
  );
  app.delete(
    r.base + "/:id",
    requireAdmin,
    asyncHandler(async (req, res) => {
      if (!validId(req.params.id)) return res.sendStatus(400);
      try {
        await pool.query(`DELETE FROM ${r.table} WHERE id=$1`, [req.params.id]);
        flash(req, "success", "Đã xóa dữ liệu.");
      } catch (e) {
        flash(req, "danger", "Không thể xóa dữ liệu đang được sử dụng.");
      }
      res.redirect(r.base);
    }),
  );
}
app.get(
  "/accounts",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const q = clean(req.query.q);
    const role = ["admin", "employee"].includes(clean(req.query.role))
      ? clean(req.query.role)
      : "";
    const status = ["active", "inactive"].includes(clean(req.query.status))
      ? clean(req.query.status)
      : "";
    const active =
      status === "active" ? true : status === "inactive" ? false : null;
    const r = await pool.query(
      `SELECT a.id,a.username,a.role,a.is_active,a.created_at,e.employee_code,e.full_name FROM accounts a LEFT JOIN employees e ON e.id=a.employee_id WHERE ($1='' OR a.username ILIKE '%'||$1||'%' OR COALESCE(e.full_name,'') ILIKE '%'||$1||'%' OR COALESCE(e.employee_code,'') ILIKE '%'||$1||'%') AND ($2='' OR a.role=$2) AND ($3::boolean IS NULL OR a.is_active=$3) ORDER BY a.created_at DESC`,
      [q, role, active],
    );
    res.render("accounts/list", {
      title: "Tài khoản",
      rows: r.rows,
      search: q,
      filters: { role, status },
    });
  }),
);
app.get(
  "/accounts/reset-requests",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const requests = await pool.query(
      `SELECT r.id,a.username,r.requested_at,e.employee_code,e.full_name FROM password_reset_requests r JOIN accounts a ON a.id=r.account_id LEFT JOIN employees e ON e.id=a.employee_id ORDER BY r.requested_at DESC`,
    );
    res.render("accounts/reset-requests", {
      title: "Yêu cầu đặt lại mật khẩu",
      requests: requests.rows,
    });
  }),
);
app.post(
  "/accounts/reset-requests/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id)) return res.sendStatus(400);
    const password = clean(req.body.password);
    if (password.length < 6) {
      flash(req, "danger", "Mật khẩu mới phải có ít nhất 6 ký tự.");
      return res.redirect("/accounts/reset-requests");
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const request = await client.query(
        "SELECT account_id FROM password_reset_requests WHERE id=$1 FOR UPDATE",
        [req.params.id],
      );
      if (!request.rowCount) {
        await client.query("ROLLBACK");
        flash(
          req,
          "warning",
          "Yêu cầu này đã được xử lý hoặc không còn tồn tại.",
        );
        return res.redirect("/accounts/reset-requests");
      }
      const hash = await bcrypt.hash(password, 12);
      await client.query("UPDATE accounts SET password_hash=$1 WHERE id=$2", [
        hash,
        request.rows[0].account_id,
      ]);
      await client.query("DELETE FROM password_reset_requests WHERE id=$1", [
        req.params.id,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    flash(
      req,
      "success",
      "Đã đổi mật khẩu. Hãy gửi mật khẩu mới cho người dùng qua kênh liên hệ an toàn.",
    );
    res.redirect("/accounts/reset-requests");
  }),
);
app.get(
  "/accounts/new",
  requireAdmin,
  asyncHandler(async (req, res) =>
    res.render("accounts/form", {
      title: "Tạo tài khoản",
      item: { role: "employee", is_active: true },
      employees: (await optionsFor()).employees,
      error: null,
    }),
  ),
);
app.post(
  "/accounts",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const username = clean(req.body.username),
      password = String(req.body.password || ""),
      role = req.body.role === "admin" ? "admin" : "employee",
      employeeId = clean(req.body.employee_id) || null;
    if (username.length < 3 || password.length < 6)
      return res.status(400).render("accounts/form", {
        title: "Tạo tài khoản",
        item: req.body,
        employees: (await optionsFor()).employees,
        error: "Tên đăng nhập tối thiểu 3 ký tự, mật khẩu tối thiểu 6 ký tự.",
      });
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      "INSERT INTO accounts(username,password_hash,role,employee_id,is_active) VALUES($1,$2,$3,$4,$5)",
      [username, hash, role, employeeId, req.body.is_active === "on"],
    );
    flash(req, "success", "Đã tạo tài khoản.");
    res.redirect("/accounts");
  }),
);
app.post(
  "/accounts/:id/toggle",
  requireAdmin,
  asyncHandler(async (req, res) => {
    if (!validId(req.params.id)) return res.sendStatus(400);
    if (Number(req.params.id) === req.session.user.id) {
      flash(req, "danger", "Không thể tự khóa tài khoản đang đăng nhập.");
      return res.redirect("/accounts");
    }
    await pool.query(
      "UPDATE accounts SET is_active=NOT is_active WHERE id=$1",
      [req.params.id],
    );
    flash(req, "success", "Đã cập nhật trạng thái tài khoản.");
    res.redirect("/accounts");
  }),
);
app.use((req, res) =>
  res.status(404).render("error", {
    title: "Không tìm thấy trang",
    message: "Địa chỉ bạn truy cập không tồn tại.",
  }),
);
app.use((err, req, res, next) => {
  console.error(err);
  const msg =
    process.env.NODE_ENV === "production"
      ? "Đã xảy ra lỗi máy chủ. Hãy kiểm tra dữ liệu và cấu hình."
      : err.message;
  res.status(500).render("error", { title: "Lỗi hệ thống", message: msg });
});
app.listen(PORT, () =>
  console.log(`RBC HRM đang chạy tại http://localhost:${PORT}`),
);
