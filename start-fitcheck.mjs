import http from 'node:http';
import {spawn} from 'node:child_process';
import {handleRequest} from './server.mjs';

const port = Number(process.env.PORT) || 3000;
const address = `http://127.0.0.1:${port}`;
function openApp() {
  if (process.argv.includes('--no-open')) return;
  if (process.platform === 'win32') {
    const child = spawn('cmd.exe', ['/d', '/c', 'start', '', address], {windowsHide:true, stdio:'ignore'});
    child.on('error', () => console.log(`Open ${address} in your browser.`));
  }
}
let running = false;
try {
  const response = await fetch(`${address}/api/health`, {signal:AbortSignal.timeout(1500)});
  running = response.ok && (await response.json()).ok === true;
} catch {}
if (running) {
  console.log(`Fitcheck is already running at ${address}`);
  openApp();
} else {
  const server = http.createServer(handleRequest);
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE'
      ? `Port ${port} is used by another app. Close it or choose another PORT.`
      : error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Fitcheck is ready at ${address}\nKeep this window open while using product links. Close it to stop Fitcheck.`);
    openApp();
  });
}
