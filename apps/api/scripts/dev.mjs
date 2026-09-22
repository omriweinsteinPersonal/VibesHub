import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const compilerPath = require.resolve('typescript/bin/tsc');
const compiler = spawn(
  process.execPath,
  [compilerPath, '-p', 'tsconfig.build.json', '--watch', '--pretty', 'false'],
  { cwd: new URL('..', import.meta.url), stdio: ['inherit', 'pipe', 'inherit'] },
);

let api;
let compilerOutput = '';

compiler.stdout.setEncoding('utf8');
compiler.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  compilerOutput += chunk;
  const lines = compilerOutput.split(/\r?\n/);
  compilerOutput = lines.pop() ?? '';
  if (
    !api &&
    lines.some((line) => /Found 0 errors\. Watching for file changes\./.test(line))
  ) {
    api = spawn(process.execPath, ['--env-file=.env', '--watch', 'dist/main.js'], {
      cwd: new URL('..', import.meta.url),
      stdio: 'inherit',
    });
  }
});

function stop() {
  compiler.kill();
  api?.kill();
  process.exit(0);
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
compiler.on('exit', (code) => {
  api?.kill();
  process.exitCode = code ?? 1;
});
