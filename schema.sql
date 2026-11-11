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

-- 见面日是两个人共享的日期标记；备注按人分开保存。
CREATE TABLE IF NOT EXISTS meetups (
  date TEXT PRIMARY KEY,
  panpan_note TEXT,
  zhuzhu_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
