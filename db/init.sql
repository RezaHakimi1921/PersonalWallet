CREATE TABLE accounts (
  id SERIAL PRIMARY KEY,
  bank_code TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  balance_rial BIGINT NOT NULL DEFAULT 0,
  card_number TEXT,
  account_number TEXT,
  iban TEXT,
  cvv2 TEXT,
  expiry TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('expense','income')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, direction)
);

CREATE TABLE installments (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('installment','loan')) DEFAULT 'installment',
  total_amount_rial BIGINT,
  installment_amount_rial BIGINT NOT NULL,
  total_count INT NOT NULL,
  paid_count INT NOT NULL DEFAULT 0,
  due_day_of_month INT NOT NULL CHECK (due_day_of_month BETWEEN 1 AND 31),
  status TEXT NOT NULL CHECK (status IN ('active','completed')) DEFAULT 'active',
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE investments (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'other' CHECK (asset_type IN ('gold','coin','dollar','other')),
  quantity NUMERIC,
  purchase_unit_price_rial BIGINT,
  current_unit_price_rial BIGINT,
  invested_amount_rial BIGINT NOT NULL,
  current_value_rial BIGINT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id),
  amount_rial BIGINT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('expense','income')),
  balance_after_rial BIGINT,
  raw_text TEXT NOT NULL,
  bank_reported_time TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','confirmed')) DEFAULT 'pending',
  category_id INT REFERENCES categories(id),
  note TEXT,
  installment_id INT REFERENCES installments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO accounts (bank_code, display_name, balance_rial) VALUES
  ('resalat', 'بانک رسالت', 259203041),
  ('blu', 'بلو', 3859212),
  ('pasargad', 'بانک پاسارگاد', 6326366);

INSERT INTO categories (name, direction) VALUES
  ('رفت و آمد', 'expense'),
  ('خوراکی', 'expense'),
  ('غذا', 'expense'),
  ('خانواده', 'expense'),
  ('شخصی', 'expense'),
  ('وسیله نقلیه', 'expense'),
  ('توسعه شخصی', 'expense'),
  ('هدیه', 'expense'),
  ('آرایشگاه', 'expense'),
  ('قسط', 'expense'),
  ('ناشناخته', 'expense'),
  ('درآمد کار', 'income'),
  ('درآمد شخصی', 'income'),
  ('ناشناخته', 'income');
