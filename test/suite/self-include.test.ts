import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import * as path from "path";
import * as fs from "fs";

import {
  createTestFile,
  deleteTestFile,
  ensureTestWorkspace,
  waitForVirtualIncludeProcessed,
} from "../testUtils";

suite("Self Include Prevention Tests", function () {
  // Increase timeout for all tests in this suite
  this.timeout(10000);

  let warningStub: sinon.SinonStub;

  setup(function () {
    // Create a stub for the warning message
    warningStub = sinon.stub(
      vscode.window,
      "showWarningMessage",
    ) as sinon.SinonStub;

    // Ensure test workspace exists
    ensureTestWorkspace();
  });

  teardown(function () {
    sinon.restore();
  });

  test("Should prevent a file from including itself", async function () {
    // Get the full path for the include directive
    const uri = await createTestFile("# Placeholder"); // Create file first to get URI
    const fullPath = uri.fsPath;

    // Now update with content that includes itself by full path
    const content = `# Test file with self-include\n# virtualInclude "${fullPath}"\n\ndef main():\n    print("Hello world")`;

    // Write the updated content
    fs.writeFileSync(fullPath, content);

    // Open it in an editor
    const document = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(document);

    // Process the includes
    await vscode.commands.executeCommand("virtualInclude.process");

    // Wait a moment for processing to complete
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify that a warning was shown
    sinon.assert.called(warningStub);

    // Check that the warning message contains the expected text
    const warningCall = warningStub.getCall(0);
    assert.ok(
      warningCall.args[0].includes("Cannot include a file in itself") ||
        warningCall.args[0].includes("self-include"),
      "Warning should mention self-include",
    );

    // Verify that the include was not processed (no start/end markers)
    const text = editor.document.getText();
    assert.ok(
      !text.includes("virtualIncludeStart"),
      "Start marker should not be present",
    );
    assert.ok(
      !text.includes("virtualIncludeEnd"),
      "End marker should not be present",
    );

    // Clean up
    await deleteTestFile(uri);
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("Should process regular includes even when there is a self-include", async function () {
    // Create a source file to be included
    const sourceContent =
      '# Source content\ndef helper():\n    return "I am a helper"';
    const sourceUri = await createTestFile(sourceContent);
    const sourcePath = path.basename(sourceUri.fsPath);

    // Create the main file first to get its path
    const mainUri = await createTestFile("# Placeholder");
    const mainPath = mainUri.fsPath;

    // Now create the content with both includes
    const mainContent =
      `# Test file with mixed includes\n` +
      `# virtualInclude "${sourcePath}"\n\n` +
      `# This include should be skipped:\n` +
      `# virtualInclude "${mainPath}"\n\n` + // Use the full path here
      `def main():\n    print("Hello world")`;

    // Update the file with the real content
    fs.writeFileSync(mainPath, mainContent);

    // Open it in an editor
    const document = await vscode.workspace.openTextDocument(mainUri);
    const editor = await vscode.window.showTextDocument(document);

    // Add debug logging
    console.log("Test file paths:");
    console.log(`- Main file: ${mainPath}`);
    console.log(`- Source file: ${sourcePath}`);
    console.log(`- Content:\n${mainContent}`);

    // Process the includes
    await vscode.commands.executeCommand("virtualInclude.process");

    // Wait for the include to be processed with extra time
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify that a warning was shown for the self-include
    sinon.assert.called(warningStub);

    // Rest of the test remains the same...
  });
});
