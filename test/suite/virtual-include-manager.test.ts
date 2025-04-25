import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { VirtualIncludeManager } from '../../src/virtual-include-manager';
import { createTestFile, deleteTestFile } from '../testUtils';

suite('Virtual Include Manager Tests', function () {
    this.timeout(15000);

    // Create stubs for the dependencies
    let documentProcessorStub: any;
    let fileWatcherStub: any;
    let editProtectionStub: any;
    let uiHandlerStub: any;
    let manager: VirtualIncludeManager;

    setup(function () {
        // Create stubs for all the components
        documentProcessorStub = {
            processDocument: sinon.stub().resolves(),
            updateDocument: sinon.stub().resolves()
        };

        fileWatcherStub = {
            createWatcher: sinon.stub().returns({}),
            handleSourceFileChange: sinon.stub().resolves()
        };

        editProtectionStub = {
            handleProtectedEdits: sinon.stub().resolves(),
            preventProtectedEdits: sinon.stub().resolves([])
        };

        uiHandlerStub = {
            showInfoMessage: sinon.stub(),
            showWarningMessage: sinon.stub(),
            showErrorMessage: sinon.stub(),
            showAffectedFilesNotification: sinon.stub()
        };

        // Mock the component factory (you'll need to adjust this based on your implementation)
        const mockComponentFactory = {
            createDocumentProcessor: () => documentProcessorStub,
            createFileWatcher: () => fileWatcherStub,
            createEditProtection: () => editProtectionStub,
            createUIHandler: () => uiHandlerStub
        };

        // Create the manager with mocked dependencies
        manager = new VirtualIncludeManager();
        // Inject mocked components (adjust based on your implementation)
        manager['_documentProcessor'] = documentProcessorStub;
        manager['_fileWatcher'] = fileWatcherStub;
        manager['_editProtection'] = editProtectionStub;
        manager['_uiHandler'] = uiHandlerStub;
    });

    teardown(function () {
        sinon.restore();
    });

    test('Should delegate document processing to DocumentProcessor', async function () {
        // Create a test document
        const uri = await createTestFile('# Test content');
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);

        // Process the document
        await manager.processDocument(editor);

        // Verify DocumentProcessor was called
        sinon.assert.calledOnce(documentProcessorStub.processDocument);
        sinon.assert.calledWith(documentProcessorStub.processDocument, editor);

        // Clean up
        await deleteTestFile(uri);
    });

    test('Should handle errors during document processing', async function () {
        // Create a test document
        const uri = await createTestFile('# Test content');
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);

        // Make the processor throw an error
        documentProcessorStub.processDocument.rejects(new Error('Test error'));

        // Process the document
        await manager.processDocument(editor);

        // Verify error was handled and reported
        sinon.assert.calledOnce(uiHandlerStub.showErrorMessage);

        // Clean up
        await deleteTestFile(uri);
    });

    test('Should process all open documents', async function () {
        // Create test documents
        const uri1 = await createTestFile('# Test content 1');
        const uri2 = await createTestFile('# Test content 2');
        const doc1 = await vscode.workspace.openTextDocument(uri1);
        const doc2 = await vscode.workspace.openTextDocument(uri2);
        const editor1 = await vscode.window.showTextDocument(doc1);

        // Stub the visibleTextEditors property
        const editorsStub = sinon.stub(vscode.window, 'visibleTextEditors').get(() => [editor1]);

        // Process all open documents
        await manager.processAllOpenDocuments();

        // Verify DocumentProcessor was called for the visible editor
        sinon.assert.called(documentProcessorStub.processDocument);

        // Restore the stub
        editorsStub.restore();

        // Clean up
        await deleteTestFile(uri1);
        await deleteTestFile(uri2);
    });

    test('Should properly initialize and dispose resources', function () {
        // Create an array to track disposables
        const mockDisposable = { dispose: sinon.stub() };
        manager['_disposables'] = [mockDisposable];

        // Stub the vscode.workspace.onDidOpenTextDocument method
        const onDocumentOpenStub = sinon.stub(vscode.workspace, 'onDidOpenTextDocument').returns({
            dispose: sinon.stub()
        });

        // Initialize the manager
        manager.initialize();

        // Verify that event handlers were registered
        sinon.assert.called(onDocumentOpenStub);

        // Stub for document watcher
        const mockWatcher = {
            dispose: sinon.stub(),
            ignoreCreateEvents: false,
            ignoreChangeEvents: false,
            ignoreDeleteEvents: false,
            onDidCreate: sinon.stub(),
            onDidChange: sinon.stub(),
            onDidDelete: sinon.stub()
        } as vscode.FileSystemWatcher;

        manager['_documentWatchers'].set('test', [mockWatcher]);

        // Dispose the manager
        manager.dispose();

        // Verify that resources were disposed
        sinon.assert.called(mockDisposable.dispose);
        assert.strictEqual(manager['_documentIncludes'].size, 0, 'Document includes should be cleared');
        assert.strictEqual(manager['_documentWatchers'].size, 0, 'Document watchers should be cleared');
        assert.strictEqual(manager['_sourceToDocuments'].size, 0, 'Source to documents map should be cleared');

        // Restore the stub
        onDocumentOpenStub.restore();
    });
});
