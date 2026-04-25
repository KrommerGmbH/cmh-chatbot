/**
 * dev-cleanup.cjs
 * dev:chat 실행 전 기존 llama-server / engine / vite 프로세스를 정리한다.
 * llama-server 중복 실행 방지.
 */
const { execSync } = require('child_process');

const ports = [8080, 4000, 5200];

for (const port of ports) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
      { encoding: 'utf8', timeout: 5000 },
    ).trim();
    const pids = out.split(/\r?\n/).map(Number).filter(Boolean);
    for (const pid of pids) {
      try {
        process.kill(pid, 'SIGTERM');
        console.log(`[dev-cleanup] killed PID ${pid} on port ${port}`);
      } catch { /* already dead */ }
    }
  } catch { /* no process on port */ }
}

// llama-server.exe 직접 kill (포트 바인딩 전 좀비 방지)
try {
  execSync('taskkill /F /IM llama-server.exe 2>nul', { encoding: 'utf8', timeout: 5000 });
  console.log('[dev-cleanup] killed remaining llama-server.exe');
} catch { /* none running */ }

console.log('[dev-cleanup] done');
