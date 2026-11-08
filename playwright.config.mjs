// Responsive QA (site#62): the matrix runs in WebKit, Safari's engine. `npm run qa` builds, then runs this.
// Never use headless Chrome --window-size for a phone shot: it floors the viewport at 500px.
import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./test/qa",
  testMatch: "*.spec.mjs",
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  timeout: 120_000,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { baseURL: `http://127.0.0.1:${PORT}` },
  webServer: { command: `node test/qa/serve.mjs ${PORT}`, url: `http://127.0.0.1:${PORT}/`, reuseExistingServer: !process.env.CI },
  projects: [{ name: "webkit", use: { ...devices["Desktop Safari"] } }],
});
