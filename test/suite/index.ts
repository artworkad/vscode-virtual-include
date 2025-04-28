import * as path from "path";
import Mocha from "mocha";
const { globSync } = require("glob");

export function run(): Promise<void> {
  const mocha = new Mocha({
    ui: "tdd",
    color: true,
  });

  const testsRoot = path.resolve(__dirname, ".");

  return new Promise<void>((resolve, reject) => {
    try {
      // Use synchronous glob for simplicity
      const files = globSync("**/**.test.js", { cwd: testsRoot });

      // Add files to the test suite
      files.forEach((f: any) => mocha.addFile(path.resolve(testsRoot, f)));

      // Run the mocha test
      mocha.run((failures) => {
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });
    } catch (err) {
      console.error("Error during test execution:", err);
      reject(err);
    }
  });
}
