import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

// Create a test directory in the extension directory
const testWorkspacePath = path.resolve(__dirname, "../../test-workspace");

// Ensure the test workspace exists
export function ensureTestWorkspace() {
  if (!fs.existsSync(testWorkspacePath)) {
    fs.mkdirSync(testWorkspacePath, { recursive: true });
  }
}

/**
 * Creates a temporary test file with the specified content
 */
export async function createTestFile(
  content: string,
  extension: string = ".py",
): Promise<vscode.Uri> {
  ensureTestWorkspace();

  // Create a random filename
  const fileName = `test-${Math.random()
    .toString(36)
    .substring(2, 15)}${extension}`;
  const filePath = path.join(testWorkspacePath, fileName);

  // Write the test content to the file
  fs.writeFileSync(filePath, content);

  return vscode.Uri.file(filePath);
}

/**
 * Cleans up a test file
 */
export async function deleteTestFile(uri: vscode.Uri): Promise<void> {
  try {
    fs.unlinkSync(uri.fsPath);
  } catch (error) {
    console.error(`Failed to delete test file: ${error}`);
  }
}

/**
 * Creates a test document and opens it in an editor
 */
export async function createTestDocument(
  content: string,
  extension: string = ".py",
): Promise<vscode.TextEditor> {
  const uri = await createTestFile(content, extension);
  const document = await vscode.workspace.openTextDocument(uri);
  return vscode.window.showTextDocument(document);
}

/**
 * A helper to wait for a specific condition
 */
export async function waitForCondition(
  condition: () => boolean,
  timeout: number = 3000,
  interval: number = 100,
): Promise<boolean> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (condition()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  return false;
}

/**
 * Wait for the virtual include to be processed
 */
export async function waitForVirtualIncludeProcessed(
  editor: vscode.TextEditor,
  timeout: number = 5000,
): Promise<boolean> {
  return waitForCondition(() => {
    const text = editor.document.getText();
    console.log("Current text:", text); // Add logging to debug
    return (
      text.includes("virtualIncludeStart") && text.includes("virtualIncludeEnd")
    );
  }, timeout);
}
