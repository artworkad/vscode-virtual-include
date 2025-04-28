import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { createTestFile, createTestDocument, waitForVirtualIncludeProcessed, deleteTestFile } from '../testUtils';

suite('Nested Includes Tests', () => {
    test('Nested include directives are neutralized', async () => {
        // Create a deeply nested file
        const deepContent = 'function deepHelper() {\n  return "I am deeply nested";\n}';
        const deepUri = await createTestFile(deepContent, '.js');
        const deepPath = path.basename(deepUri.fsPath);

        // Create a source file with an include directive
        const sourceContent = `// Source file\n// virtualInclude "${deepPath}"\n\nfunction sourceHelper() {\n  return "I am a source helper";\n}`;
        const sourceUri = await createTestFile(sourceContent, '.js');
        const sourcePath = path.basename(sourceUri.fsPath);

        // Create main file that includes the source file
        const mainContent = `// Main file\n// virtualInclude "${sourcePath}"\n\nfunction main() {\n  console.log("Main");\n}`;
        const editor = await createTestDocument(mainContent, '.js');

        // Process the include
        await vscode.commands.executeCommand('virtualInclude.process');

        // Wait for processing to complete
        const processed = await waitForVirtualIncludeProcessed(editor);
        assert.strictEqual(processed, true, 'Virtual include was not processed');

        // Verify the include was processed correctly
        const text = editor.document.getText();
        assert.ok(text.includes('virtualIncludeStart'), 'Start marker not found');
        assert.ok(text.includes('virtualIncludeEnd'), 'End marker not found');
        assert.ok(text.includes('function sourceHelper()'), 'Included content not found');
        
        // Verify that the nested include directive was neutralized
        assert.ok(text.includes('virtualInclude-nested'), 'Nested include directive was not neutralized');
        assert.ok(!text.includes('deepHelper()'), 'Nested file content should not be included');

        // Clean up
        await deleteTestFile(sourceUri);
        await deleteTestFile(deepUri);
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });

    test('Changes to source files with nested includes propagate correctly', async () => {
        // Create a deeply nested file
        const deepContent = 'function deepHelper() {\n  return "I am deeply nested";\n}';
        const deepUri = await createTestFile(deepContent, '.js');
        const deepPath = path.basename(deepUri.fsPath);

        // Create a source file with an include directive
        const sourceContent = `// Source file\n// virtualInclude "${deepPath}"\n\nfunction sourceHelper() {\n  return "I am a source helper";\n}`;
        const sourceUri = await createTestFile(sourceContent, '.js');
        const sourcePath = path.basename(sourceUri.fsPath);

        // Create main file that includes the source file
        const mainContent = `// Main file\n// virtualInclude "${sourcePath}"\n\nfunction main() {\n  console.log("Main");\n}`;
        const editor = await createTestDocument(mainContent, '.js');

        // Process the include
        await vscode.commands.executeCommand('virtualInclude.process');
        await waitForVirtualIncludeProcessed(editor);

        // Now modify the source file and verify the changes propagate to the main file
        const updatedSourceContent = `// Updated source file\n// virtualInclude "${deepPath}"\n\nfunction sourceHelper() {\n  return "I am an updated source helper";\n}`;
        await vscode.workspace.fs.writeFile(sourceUri, Buffer.from(updatedSourceContent));
        
        // Wait for the file watcher to detect the change and update
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Process includes again
        await vscode.commands.executeCommand('virtualInclude.process');
        await waitForVirtualIncludeProcessed(editor);
        
        // Verify the updated content is present
        const updatedText = editor.document.getText();
        assert.ok(updatedText.includes('I am an updated source helper'), 'Updated source content not found');
        assert.ok(updatedText.includes('virtualInclude-nested'), 'Nested include directive was not neutralized after update');

        // Clean up
        await deleteTestFile(sourceUri);
        await deleteTestFile(deepUri);
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    });
});
