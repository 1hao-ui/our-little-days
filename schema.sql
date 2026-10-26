-- 本地初始化 / 远程初始化共用这一份结构。
CREATE TABLE IF NOT EXISTS records (
  date TEXT PRIMARY KEY,
  weight REAL,
  period TEXT,
  symptoms TEXT,
  mood TEXT,
  message TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_records_date_desc
  ON records (date DESC);
