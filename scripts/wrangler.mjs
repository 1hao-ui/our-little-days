import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// Windows 上个别环境会让 workerd 在系统临时目录创建文件失败。
// 统一把临时文件放进项目内的 .tmp，既好清理，也不影响系统目录。
const tempDir = path.resolve('.tmp');
mkdirSync(tempDir, { recursive: true });
const wranglerBin = path.resolve('node_modules/wrangler/bin/wrangler.js');

const child = spawn(process.execPath, [wranglerBin, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    TEMP: tempDir,
    TMP: tempDir,
    TMPDIR: tempDir,
  },
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on('error', (error) => {
  console.error('没有启动 Wrangler，请先运行 npm install。');
  console.error(error);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  process.exitCode = code ?? 0;
});
