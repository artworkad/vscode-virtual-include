import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as path from 'path';
import { DiagnosticsManager } from '../../src/diagnostics';
import { createTestFile, ensureTestWorkspace, deleteTestFile } from '../testUtils';

suite('Diagnostics Tests', function () {
  this.timeout(10000); // Increase timeout for all tests in this suite

  let diagnosticsManager: DiagnosticsManager;
  let diagnosticCollectionStub: any;

  // Set up the test environment
  setup(function () {
    // Create a stub for the diagnostic collection
    diagnosticCollectionStub = {
      set: sinon.stub(),
      delete: sinon.stub(),
      dispose: sinon.stub(),
      get: sinon.stub().returns([])
    };

    // Stub the vscode.languages.createDiagnosticCollection method
    const createDiagnosticCollectionStub = sinon.stub(vscode.languages, 'createDiagnosticCollection').returns(diagnosticCollectionStub);

    // Create the diagnostics manager
    diagnosticsManager = new DiagnosticsManager();

    // Restore the original method
    createDiagnosticCollectionStub.restore();

    // Ensure test workspace exists
    ensureTestWorkspace();
  });

  // Clean up after each test
  teardown(function () {
    sinon.restore();
  });

  test('Should report diagnostics for missing files', async function () {
    // Create a test document with an include to a non-existent file
    const content = '# Test file\n# virtualInclude "non-existent-file.py"\n\ndef main():\n    pass';
    const uri = await createTestFile(content);
    const document = await vscode.workspace.openTextDocument(uri);

    // Check the document for include issues
    const issueCount = diagnosticsManager.checkDocument(document);

    // Verify diagnostics were created
    assert.strictEqual(issueCount, 1, 'One diagnostic should be reported');

    // Verify the diagnostic collection was updated
    assert.strictEqual(diagnosticCollectionStub.set.callCount, 1, 'Diagnostic collection should be updated');

    // Verify the diagnostic details
    const [setUri, diagnostics] = diagnosticCollectionStub.set.args[0];
    assert.ok(uri.fsPath === setUri.fsPath, 'Diagnostics should be cleared for the correct URI');
    assert.strictEqual(diagnostics.length, 1, 'One diagnostic should be created');
    assert.strictEqual(diagnostics[0].severity, vscode.DiagnosticSeverity.Error, 'Diagnostic should be an error');
    assert.strictEqual(diagnostics[0].source, 'Virtual Include', 'Diagnostic source should be set');

    // Clean up
    await deleteTestFile(uri);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('Should not report diagnostics for existing files', async function () {
    // Create a source file that will be included
    const sourceContent = '# Source file content';
    const sourceUri = await createTestFile(sourceContent);
    const sourcePath = path.basename(sourceUri.fsPath);

    // Create a main file that includes the source file
    const mainContent = `# Test file\n# virtualInclude "${sourcePath}"\n\ndef main():\n    pass`;
    const mainUri = await createTestFile(mainContent);
    const document = await vscode.workspace.openTextDocument(mainUri);

    // Check the document for include issues
    const issueCount = diagnosticsManager.checkDocument(document);

    // Verify no diagnostics were created
    assert.strictEqual(issueCount, 0, 'No diagnostics should be reported');

    // Verify the diagnostic collection was updated with an empty array
    assert.strictEqual(diagnosticCollectionStub.set.callCount, 1, 'Diagnostic collection should be updated');

    // Verify the diagnostic details
    const [setUri, diagnostics] = diagnosticCollectionStub.set.args[0];
    assert.ok(mainUri.fsPath === setUri.fsPath, 'Diagnostic should be set for the correct URI');
    assert.strictEqual(diagnostics.length, 0, 'No diagnostics should be created');

    // Clean up
    await deleteTestFile(sourceUri);
    await deleteTestFile(mainUri);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('Should clear diagnostics for a document', async function () {
    // Create a test document
    const content = '# Test file\n# virtualInclude "file.py"\n\ndef main():\n    pass';
    const uri = await createTestFile(content);
    const document = await vscode.workspace.openTextDocument(uri);

    // Clear diagnostics for the document
    diagnosticsManager.clearDiagnostics(document);

    // Verify the diagnostic collection was cleared
    assert.strictEqual(diagnosticCollectionStub.delete.callCount, 1, 'Diagnostic collection should be cleared');

    // Verify the correct URI was cleared
    const [deleteUri] = diagnosticCollectionStub.delete.args[0];
    assert.strictEqual(deleteUri.toString(), uri.toString(), 'Diagnostics should be cleared for the correct URI');

    // Clean up
    await deleteTestFile(uri);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });

  test('Should properly dispose resources', function () {
    // Dispose the diagnostics manager
    diagnosticsManager.dispose();

    // Verify the diagnostic collection was disposed
    assert.strictEqual(diagnosticCollectionStub.dispose.callCount, 1, 'Diagnostic collection should be disposed');
  });

  test('Should create diagnostic with correct range', async function () {
    // Create a test document with an include directive
    const content = '# Test file\n# virtualInclude "non-existent-file.py"\n\ndef main():\n    pass';
    const uri = await createTestFile(content);
    const document = await vscode.workspace.openTextDocument(uri);

    // Check the document for include issues
    diagnosticsManager.checkDocument(document);

    // Get the diagnostics that were created
    const [, diagnostics] = diagnosticCollectionStub.set.args[0];
    const diagnostic = diagnostics[0];

    // Verify the diagnostic range covers the include directive
    const expectedLine = 1; // Zero-based, so this is the second line
    assert.strictEqual(diagnostic.range.start.line, expectedLine, 'Diagnostic start line should match include directive');
    assert.strictEqual(diagnostic.range.end.line, expectedLine, 'Diagnostic end line should match include directive');

    // Verify the range covers the entire include directive
    const line = document.lineAt(expectedLine);
    assert.strictEqual(diagnostic.range.start.character, line.text.indexOf('# virtual'), 'Diagnostic should start at include directive');
    assert.strictEqual(diagnostic.range.end.character, line.text.length, 'Diagnostic should end at line end');

    // Clean up
    await deleteTestFile(uri);
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
  });
});
