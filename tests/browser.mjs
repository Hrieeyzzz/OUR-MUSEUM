import { chromium } from "@playwright/test";
import chromiumBinary from "@sparticuz/chromium";
import fs from "node:fs";
import zlib from "node:zlib";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
export async function launchBrowser() {
  const libs = path.join(tmpdir(), "museum-browser-libs");
  if (
    process.platform === "linux" &&
    !fs.existsSync(libs + "/lib/libnspr4.so")
  ) {
    fs.mkdirSync(libs, { recursive: true });
    const tar = path.join(libs, "al2023.tar");
    fs.writeFileSync(
      tar,
      zlib.brotliDecompressSync(
        fs.readFileSync("node_modules/@sparticuz/chromium/bin/al2023.tar.br"),
      ),
    );
    execFileSync("tar", ["xf", tar, "-C", libs]);
    fs.unlinkSync(tar);
  }
  return chromium.launch({
    executablePath: await chromiumBinary.executablePath(),
    args: [...chromiumBinary.args, "--enable-unsafe-swiftshader"],
    headless: true,
    env: {
      ...process.env,
      LD_LIBRARY_PATH: libs + "/lib:" + (process.env.LD_LIBRARY_PATH || ""),
    },
  });
}
