-- 双人档案升级：
-- 1. 新增 owner 字段，之后一天可以有潘潘和猪猪各一条记录；
-- 2. 新增猪猪的增肌 / 减脂两项；
-- 3. 现有全部记录自动归到潘潘名下。
CREATE TABLE records_v3 (
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

INSERT INTO records_v3 (
  date, owner, weight, period, symptoms, mood, message,
  breakfast, nuts, milk, positives, muscle, cut, updated_at
)
SELECT
  date, 'panpan', weight, period, symptoms, mood, message,
  breakfast, nuts, milk, positives, NULL, NULL, updated_at
FROM records;

DROP TABLE records;
ALTER TABLE records_v3 RENAME TO records;

CREATE INDEX idx_records_owner_date
  ON records (owner, date DESC);
