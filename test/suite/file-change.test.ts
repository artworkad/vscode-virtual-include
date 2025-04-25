import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { createTestFile, createTestDocument, waitForVirtualIncludeProcessed, deleteTestFile } from '../testUtils';

suite('File Change Tests', () => {
    test('Updates when source file changes', async function () {
        this.timeout(10000);

        // Create a source file
        const sourceContent = 'function helper() {\n  return "Original content";\n}';
        const sourceUri = await createTestFile(sourceContent, '.js');
        const sourcePath = path.basename(sourceUri.fsPath);

        // Create main file with include
        const mainContent = `// Main file\n// virtualInclude "${sourcePath}"\n\nfunction main() {\n  console.log("Main");\n}`;
        const editor = await createTestDocument(mainContent, '.js');

        // Process the include
        await vscode.commands.executeCommand('virtualInclude.process');

        // Wait for processing to complete
        const processed = await waitForVirtualIncludeProcessed(editor);
        assert.strictEqual(processed, true, 'Virtual include was not processed');

        // Verify original content is included
        const originalText = editor.document.getText();
        assert.ok(originalText.includes('Original content'), 'Original content not found');

        // Modify the source file
        const updatedSourceContent = 'function helper() {\n  return "Updated content";\n}';
        fs.writeFileSync(sourceUri.fsPath, updatedSourceContent);

        // Wait for the include to be updated (this may take some time)
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verify the included content is updated
        const updatedText = editor.document.getText();
        assert.ok(updatedText.includes('Updated content'), 'Updated content not found');

        // Clean up
        await deleteTestFile(sourceUri);
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });
});
