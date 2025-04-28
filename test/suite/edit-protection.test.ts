import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import {
  createTestFile,
  createTestDocument,
  waitForVirtualIncludeProcessed,
  deleteTestFile,
} from "../testUtils";

suite("Edit Protection Tests", () => {
  test("Protected region cannot be edited", async () => {
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

    // Find the protected region
    const text = editor.document.getText();
    const lines = text.split("\n");
    let protectedLineIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("function helper()")) {
        protectedLineIndex = i;
        break;
      }
    }

    assert.notStrictEqual(protectedLineIndex, -1, "Protected line not found");

    // Try to edit the protected line
    const originalContent = lines[protectedLineIndex];
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      editor.document.uri,
      new vscode.Range(
        new vscode.Position(protectedLineIndex, 0),
        new vscode.Position(
          protectedLineIndex,
          lines[protectedLineIndex].length,
        ),
      ),
      "// This edit should be prevented",
    );

    await vscode.workspace.applyEdit(edit);

    // Wait for protection mechanism to react
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify the protected line hasn't changed
    const updatedText = editor.document.getText();
    const updatedLines = updatedText.split("\n");
    assert.strictEqual(
      updatedLines[protectedLineIndex],
      originalContent,
      "Edit protection failed",
    );

    // Clean up
    await deleteTestFile(sourceUri);
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });
});
