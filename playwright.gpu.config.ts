import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * The same suite on the real GPU.
 *
 * Headless Chromium falls back to SwiftShader — WebGL rendered on the CPU —
 * which makes the astrolabe look several times more expensive than it is on
 * any visitor's machine. Performance numbers are only meaningful here.
 */
export default defineConfig({
  ...base,
  use: {
    ...base.use,
    launchOptions: {
      args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"],
    },
  },
});
