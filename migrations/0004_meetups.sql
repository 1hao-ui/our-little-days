-- 见面日是两个人共享的日期标记；备注按人分开保存。
CREATE TABLE IF NOT EXISTS meetups (
  date TEXT PRIMARY KEY,
  panpan_note TEXT,
  zhuzhu_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
