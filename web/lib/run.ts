import { spawn } from "node:child_process";

export interface RunOptions {
  timeoutMs?: number;
}

export interface RunResult {
  stdout: string;
  stderr: string;
}

// Spawn wrapper ported verbatim from the original server.js `run()`.
export function run(command: string, args: string[], options: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = options.timeoutMs
      ? setTimeout(() => {
          child.kill("SIGTERM");
          reject(new Error(`${command} timed out.`));
        }, options.timeoutMs)
      : null;

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} failed: ${stderr || stdout}`));
    });
  });
}

export async function commandExists(command: string): Promise<boolean> {
  try {
    await run("which", [command], { timeoutMs: 5000 });
    return true;
  } catch {
    return false;
  }
}
