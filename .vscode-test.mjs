import { defineConfig } from "@vscode/test-cli";

export default defineConfig({
  files: "dist/test/**/*.test.js",
  workspaceFolder: ".",
  extensionDevelopmentPath: ".",
  extensionTestsPath: "./dist/test/suite/index.js",
  launchArgs: ["--disable-gpu", "--disable-workspace-trust", "--no-sandbox"],
});
