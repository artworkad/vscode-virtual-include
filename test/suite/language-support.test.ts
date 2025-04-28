import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import {
  createTestFile,
  createTestDocument,
  waitForVirtualIncludeProcessed,
  deleteTestFile,
} from "../testUtils";

suite("Language Support Tests", () => {
  const testCases = [
    { language: "javascript", extension: ".js", commentStyle: "//" },
    { language: "python", extension: ".py", commentStyle: "#" },
    { language: "ruby", extension: ".rb", commentStyle: "#" },
  ];

  testCases.forEach(({ language, extension, commentStyle }) => {
    test(`Support for ${language} comment style`, async function () {
      this.timeout(10000);
      // Create a source file
      const sourceContent = `${commentStyle} This is a ${language} file`;
      const sourceUri = await createTestFile(sourceContent, extension);
      const sourcePath = path.basename(sourceUri.fsPath);

      // Create main file with include using language-specific comment style
      const mainContent = `${commentStyle} Main file\n${commentStyle} virtualInclude "${sourcePath}"\n\n${commentStyle} Main function`;
      const editor = await createTestDocument(mainContent, extension);

      try {
        // Process the include
        await vscode.commands.executeCommand("virtualInclude.process");

        // Wait for processing to complete
        const processed = await waitForVirtualIncludeProcessed(editor);
        assert.strictEqual(
          processed,
          true,
          `Virtual include for ${language} was not processed`,
        );

        // Verify the include was processed with correct comment style
        const text = editor.document.getText();
        assert.ok(
          text.includes(`${commentStyle} virtualIncludeStart`),
          "Language-specific start marker not found",
        );
        assert.ok(
          text.includes(`${commentStyle} virtualIncludeEnd`),
          "Language-specific end marker not found",
        );

        // Clean up
        await deleteTestFile(sourceUri);
        await vscode.commands.executeCommand(
          "workbench.action.closeActiveEditor",
        );
      } catch (err) {
        console.error("Error during test:", err);
        throw err;
      }
    });
  });
});
