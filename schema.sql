-- 本地初始化 / 远程初始化共用这一份结构。
CREATE TABLE IF NOT EXISTS records (
  date TEXT NOT NULL,
  owner TEXT NOT NULL,
  weight REAL,
  period TEXT,
  symptoms TEXT,
  mood TEXT,
  message TEXT,
  breakfast INTEGER,
  nuts INTEGER,
  milk INTEGER,
  positives TEXT,
  muscle INTEGER,
  cut INTEGER,
  updated_at TEXT,
  PRIMARY KEY (date, owner)
);

CREATE INDEX IF NOT EXISTS idx_records_owner_date
  ON records (owner, date DESC);
