import { defineConfig, devices } from "@playwright/test";

const web = process.env.LIVE_WEB_URL;
const api = process.env.LIVE_API_URL;
for (const value of [web, api]) {
  if (!value || new URL(value).hostname !== "127.0.0.1") {
    throw new Error(
      "Live integration requires an isolated loopback API and web server.",
    );
  }
}
export default defineConfig({
  testDir: "./test/live",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 150_000,
  reporter: "list",
  use: {
    baseURL: web,
    timezoneId: "UTC",
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  projects: [
    { name: "live-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "live-mobile", use: { ...devices["Pixel 7"] } },
  ],
});
