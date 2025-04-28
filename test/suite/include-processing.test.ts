import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import {
  createTestFile,
  createTestDocument,
  waitForVirtualIncludeProcessed,
  deleteTestFile,
} from "../testUtils";

suite("Include Processing Tests", () => {
  test("Basic include detection and processing", async () => {
    // Create a source file
    const sourceContent = 'function helper() {\n  return "I am included";\n}';
    const sourceUri = await createTestFile(sourceContent, ".js");
    const sourcePath = path.basename(sourceUri.fsPath);

    // Create main file with include
    const mainContent = `// Main file\n// virtualInclude "${sourcePath}"\n\nfunction main() {\n  console.log("Main");\n}`;
    const editor = await createTestDocument(mainContent, ".js");

    // Process the include
    await vscode.commands.executeCommand("virtualInclude.process");

    // Wait for processing to complete
    const processed = await waitForVirtualIncludeProcessed(editor);
    assert.strictEqual(processed, true, "Virtual include was not processed");

    // Verify the include was processed correctly
    const text = editor.document.getText();
    assert.ok(text.includes("virtualIncludeStart"), "Start marker not found");
    assert.ok(text.includes("virtualIncludeEnd"), "End marker not found");
    assert.ok(text.includes("function helper()"), "Included content not found");

    // Clean up
    await deleteTestFile(sourceUri);
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });
});
