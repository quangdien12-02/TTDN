CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS positions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  employee_code VARCHAR(20) NOT NULL UNIQUE,
  full_name VARCHAR(150) NOT NULL,
  date_of_birth DATE,
  gender VARCHAR(20) NOT NULL DEFAULT 'Khác',
  phone VARCHAR(30),
  email VARCHAR(150) UNIQUE,
  address TEXT,
  hire_date DATE NOT NULL DEFAULT CURRENT_DATE,
  department_id INTEGER REFERENCES departments(id) ON UPDATE CASCADE ON DELETE SET NULL,
  position_id INTEGER REFERENCES positions(id) ON UPDATE CASCADE ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'Đang làm việc',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'employee' CHECK (role IN ('admin','employee')),
  employee_id INTEGER UNIQUE REFERENCES employees(id) ON UPDATE CASCADE ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS password_reset_requests (
  id SERIAL PRIMARY KEY,
  account_id INTEGER NOT NULL UNIQUE REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE CASCADE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS contracts (
  id SERIAL PRIMARY KEY,
  contract_code VARCHAR(30) NOT NULL UNIQUE,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON UPDATE CASCADE ON DELETE CASCADE,
  contract_type VARCHAR(80) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  salary NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (salary >= 0),
  status VARCHAR(30) NOT NULL DEFAULT 'Đang hiệu lực',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees (full_name);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees (department_id);
CREATE INDEX IF NOT EXISTS idx_contracts_employee ON contracts (employee_id);
