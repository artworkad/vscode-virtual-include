import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as path from 'path';
import { UIHandler } from '../../src/ui-handler';
import { createTestFile, ensureTestWorkspace, deleteTestFile } from '../testUtils';

suite('UI Handler Tests', function () {
  this.timeout(10000); // Increase timeout for all tests in this suite

  let uiHandler: UIHandler;
  let mockManager: any;

  // Explicitly type all stubs
  let showInfoStub: sinon.SinonStub;
  let showWarningStub: sinon.SinonStub;
  let showErrorStub: sinon.SinonStub;
  let showQuickPickStub: sinon.SinonStub;
  let withProgressStub: sinon.SinonStub;

  // Set up the test environment
  setup(function () {
    // Create stubs for vscode.window methods with explicit typing
    showInfoStub = sinon.stub(vscode.window, 'showInformationMessage') as sinon.SinonStub;
    showWarningStub = sinon.stub(vscode.window, 'showWarningMessage') as sinon.SinonStub;
    showErrorStub = sinon.stub(vscode.window, 'showErrorMessage') as sinon.SinonStub;
    showQuickPickStub = sinon.stub(vscode.window, 'showQuickPick') as sinon.SinonStub;
    withProgressStub = sinon.stub(vscode.window, 'withProgress') as sinon.SinonStub;

    // Create a mock manager with the necessary properties
    mockManager = {
      sourceToDocuments: new Map<string, Set<string>>()
    };

    // Create the UI handler with the mock manager
    uiHandler = new UIHandler(mockManager);

    // Ensure test workspace exists
    ensureTestWorkspace();
  });

  // Clean up after each test
  teardown(function () {
    sinon.restore();
  });

  test('Should show information message', function () {
    // Show an information message
    const message = 'Test info message';
    uiHandler.showInfoMessage(message);

    // Verify the message was shown using sinon assertions
    sinon.assert.calledOnce(showInfoStub);
    sinon.assert.calledWith(showInfoStub, message);
  });

  test('Should show warning message', function () {
    // Show a warning message
    const message = 'Test warning message';
    uiHandler.showWarningMessage(message);

    // Verify the message was shown
    sinon.assert.calledOnce(showWarningStub);
    sinon.assert.calledWith(showWarningStub, message);
  });

  test('Should show error message', function () {
    // Show an error message
    const message = 'Test error message';
    uiHandler.showErrorMessage(message);

    // Verify the message was shown
    sinon.assert.calledOnce(showErrorStub);
    sinon.assert.calledWith(showErrorStub, message);
  });

  test('Should show affected files notification', async function () {
    // Create a test source file
    const sourceContent = '# Source content';
    const sourceUri = await createTestFile(sourceContent);
    const sourcePath = sourceUri.fsPath;

    // Set up affected documents
    const affectedDocs = new Set<string>(['file:///test/doc1.py', 'file:///test/doc2.py']);
    mockManager.sourceToDocuments.set(sourcePath, affectedDocs);

    // Set up the showInformationMessage stub to simulate user clicking "Show affected files"
    showInfoStub.resolves('Show affected files');

    // Set up the showQuickPick stub to simulate user selecting a file
    showQuickPickStub.resolves({ label: 'doc1.py', detail: 'file:///test/doc1.py' });

    // Show the notification
    await uiHandler.showAffectedFilesNotification(sourcePath);

    // Verify the notification was shown
    const expectedMessage = `${path.basename(sourcePath)} changed, affecting 2 files (changes are not automatically saved)`;
    sinon.assert.calledWith(showInfoStub, expectedMessage, 'Show affected files', 'Save all');

    // Clean up
    await deleteTestFile(sourceUri);
  });

  test('Should save affected files when requested', async function () {
    // Create a test source file
    const sourceContent = '# Source content';
    const sourceUri = await createTestFile(sourceContent);
    const sourcePath = sourceUri.fsPath;

    // Set up affected documents (two documents)
    const affectedDocs = new Set<string>(['file:///test/doc1.py', 'file:///test/doc2.py']);
    mockManager.sourceToDocuments.set(sourcePath, affectedDocs);

    // Create properly typed mocks for documents
    const createMockDocument = (uri: string, isDirty: boolean) => {
      const saveStub = sinon.stub().resolves(true);

      // Create a partial document with the properties we need
      const mockDoc = {
        isDirty,
        save: saveStub,
        isClosed: false,
        uri: {
          toString: () => uri,
          fsPath: uri.replace('file://', ''),
          scheme: 'file'
        },
        fileName: uri.replace('file://', ''),
        isUntitled: false,
        languageId: 'python',
        version: 1,
        lineCount: 1,
        lineAt: () => ({ text: '# Mock line' }),
        getText: () => '# Mock content',
        offsetAt: () => 0,
        positionAt: () => new vscode.Position(0, 0),
        validateRange: (range: vscode.Range) => range,
        validatePosition: (position: vscode.Position) => position,
        eol: vscode.EndOfLine.LF
      };

      // Cast it properly using 'as unknown as' pattern
      return mockDoc as unknown as vscode.TextDocument;
    };

    const mockDocument1 = createMockDocument('file:///test/doc1.py', true);
    const mockDocument2 = createMockDocument('file:///test/doc2.py', true);

    // Make openTextDocument return different documents based on URI
    const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument');

    // Use a function for matching to handle different URI formats
    openTextDocumentStub.callsFake((uri) => {
      const uriString = typeof uri === 'string' ? uri : uri!.toString();
      if (uriString.includes('doc1')) {
        return Promise.resolve(mockDocument1);
      } else if (uriString.includes('doc2')) {
        return Promise.resolve(mockDocument2);
      }
      return Promise.resolve(mockDocument1); // Default fallback
    });

    // Mock the withProgress function to execute the callback
    withProgressStub.callsFake((options, callback) => {
      return callback({
        report: () => { }
      });
    });

    // Call saveAffectedFiles
    await uiHandler.saveAffectedFiles(sourcePath);

    // Verify each document was saved once
    sinon.assert.calledOnce(mockDocument1.save as sinon.SinonStub);
    sinon.assert.calledOnce(mockDocument2.save as sinon.SinonStub);

    // Verify info message shows correct count
    sinon.assert.calledWith(showInfoStub, 'Successfully saved 2 file(s)');

    // Clean up
    await deleteTestFile(sourceUri);
  });

  test('Should handle case with no affected files', async function () {
    // Create a test source file
    const sourceContent = '# Source content';
    const sourceUri = await createTestFile(sourceContent);
    const sourcePath = sourceUri.fsPath;

    // Set up empty affected documents
    mockManager.sourceToDocuments.set(sourcePath, new Set<string>());

    // Call showAffectedFilesQuickPick
    await uiHandler.showAffectedFilesQuickPick(sourcePath);

    // Verify info message was shown
    assert.strictEqual(showInfoStub.callCount, 1, 'Info message should be shown');
    assert.strictEqual(showInfoStub.args[0][0], 'No affected files found', 'Correct message should be shown');

    // Verify quick pick was not shown
    assert.strictEqual(showQuickPickStub.callCount, 0, 'Quick pick should not be shown');

    // Clean up
    await deleteTestFile(sourceUri);
  });

  test('Should show error when file open fails', async function () {
    // Create a test source file
    const sourceContent = '# Source content';
    const sourceUri = await createTestFile(sourceContent);
    const sourcePath = sourceUri.fsPath;

    // Set up affected documents
    const affectedDocs = new Set<string>(['file:///test/doc1.py']);
    mockManager.sourceToDocuments.set(sourcePath, affectedDocs);

    // Set up the showQuickPick stub to simulate user selecting a file
    showQuickPickStub.resolves({ label: 'doc1.py', detail: 'file:///test/doc1.py' });

    // Make the document open fail
    const openTextDocumentStub = sinon.stub(vscode.workspace, 'openTextDocument').rejects(new Error('Test error'));

    // Call showAffectedFilesQuickPick
    await uiHandler.showAffectedFilesQuickPick(sourcePath);

    // Verify error message was shown
    assert.strictEqual(showErrorStub.callCount, 1, 'Error message should be shown');
    assert.strictEqual(showErrorStub.args[0][0].includes('Failed to open document'), true, 'Error message should mention document open failure');

    // Clean up
    await deleteTestFile(sourceUri);
  });
});
