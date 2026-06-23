import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const envPath = path.join(process.cwd(), ".env.local");

async function readHidden(prompt) {
  if (!process.stdin.isTTY) {
    let value = "";
    for await (const chunk of process.stdin) {
      value += chunk;
    }
    return value.trim();
  }

  return new Promise((resolve, reject) => {
    let value = "";

    function cleanup() {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
    }

    function onData(buffer) {
      const input = buffer.toString("utf8");

      for (const character of input) {
        if (character === "\u0003") {
          cleanup();
          reject(new Error("Canceled."));
          return;
        }

        if (character === "\r" || character === "\n") {
          cleanup();
          resolve(value.trim());
          return;
        }

        if (character === "\u007f") {
          value = value.slice(0, -1);
          continue;
        }

        value += character;
      }
    }

    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", onData);
  });
}

function updateEnv(existing, apiKey) {
  const lines = existing
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "" && !line.startsWith("GEMINI_API_KEY="));

  lines.push(`GEMINI_API_KEY=${apiKey}`);
  return `${lines.join("\n")}\n`;
}

try {
  const key = await readHidden("Enter Gemini API key: ");

  if (!key) {
    console.error("No key entered. .env.local was not changed.");
    process.exit(1);
  }

  const existing = await readFile(envPath, "utf8").catch(() => "");
  await writeFile(envPath, updateEnv(existing, key), { mode: 0o600 });
  console.log("Saved GEMINI_API_KEY to .env.local.");
  console.log("Restart the dev server if it is already running.");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Setup failed.");
  process.exit(1);
}
