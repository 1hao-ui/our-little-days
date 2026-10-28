-- 已有数据库升级：新增三个每日小习惯和正面身体感受。
-- 新数据库请直接使用仓库根目录的 schema.sql，不需要执行本文件。
ALTER TABLE records ADD COLUMN breakfast INTEGER;
ALTER TABLE records ADD COLUMN nuts INTEGER;
ALTER TABLE records ADD COLUMN milk INTEGER;
ALTER TABLE records ADD COLUMN positives TEXT;
