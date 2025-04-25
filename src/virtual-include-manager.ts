import * as vscode from 'vscode';
import { DocumentProcessor } from './document-processor';
import { FileWatcher } from './file-watcher';
import { EditProtection } from './edit-protection';
import { UIHandler } from './ui-handler';
import { Constants } from './constants';
import { StatusBarManager } from './status-bar';
import { DiagnosticsManager } from './diagnostics';

/**
 * The virtual-include-manager module serves as the central coordinator for the entire Virtual Include extension.
 * It acts as the core controller of the extension, coordinating all other components and maintaining shared state. 
 * It serves as the glue between different modules and provides a clean interface for extension-wide operations. 
 */
export class VirtualIncludeManager implements vscode.Disposable {
  private _documentProcessor: DocumentProcessor;
  private _fileWatcher: FileWatcher;
  private _editProtection: EditProtection;
  private _uiHandler: UIHandler;
  private _disposables: vscode.Disposable[] = [];
  private _statusBar: StatusBarManager;
  private _diagnostics: DiagnosticsManager;

  // Maps to track includes and relationships
  private _documentIncludes: Map<string, Map<number, string>> = new Map();
  private _documentWatchers: Map<string, vscode.FileSystemWatcher[]> = new Map();
  private _sourceToDocuments: Map<string, Set<string>> = new Map();

  // Flag to temporarily disable edit protection during programmatic updates
  private _isPerformingUpdate: boolean = false;

  /**
   * Creates instances of all component classes (DocumentProcessor, FileWatcher, EditProtection, UIHandler).
   */
  constructor() {
    this._documentProcessor = new DocumentProcessor(this);
    this._fileWatcher = new FileWatcher(this);
    this._editProtection = new EditProtection(this);
    this._uiHandler = new UIHandler(this);
    this._statusBar = new StatusBarManager();
    this._diagnostics = new DiagnosticsManager();
  }

  /**
   * Called after construction to set up the manager:
   * 
   * 1. Delegates to _registerEventHandlers to set up event listeners
   * 2. Separating initialization from construction allows for better testing and control
   */
  public initialize(): void {
    this._registerEventHandlers();
  }

  /**
   * Called at startup to process all open documents:
   * 
   * 1. Gets all text documents from VSCode workspace
   * 2. Filters for file-scheme documents (excluding things like settings files)
   * 3. Finds editors associated with each document
   * 4. Processes each document that has an editor
   * 5. Also specifically processes the active editor as a fallback
   * 
   * @returns Promise<void>
   */
  public async processAllOpenDocuments(): Promise<void> {
    // Get all open documents
    const documents = vscode.workspace.textDocuments;
    console.log(`Found ${documents.length} open documents`);

    // Process each document that has an editor
    for (const document of documents) {
      if (document.uri.scheme === 'file') {
        console.log(`Processing document: ${document.uri}`);

        const editors = vscode.window.visibleTextEditors.filter(
          e => e.document.uri.toString() === document.uri.toString()
        );

        if (editors.length > 0) {
          console.log(`Document has an editor, processing virtual includes`);
          await this.processDocumentWithoutDirtyState(editors[0]);
        } else {
          console.log(`Document doesn't have an editor, skipping`);
        }
      }
    }

    // Also specifically process the active editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      console.log(`Processing active editor: ${activeEditor.document.uri}`);
      await this.processDocumentWithoutDirtyState(activeEditor);
    }
  }

  /**
   * Special method that preserves a document's "clean" state:
   * 
   * 1. Saves the document's initial dirty state
   * 2. Processes the document
   * 3. If the document wasn't dirty before but is now, saves it to restore its clean state
   * 4. Uses a timeout to ensure edits are fully applied before saving
   * 5. Handles errors and reports them via the UI handler
   * 
   * @param editor 
   * @return Promise<void>
   */
  public async processDocumentWithoutDirtyState(editor: vscode.TextEditor): Promise<void> {
    try {
      // Save the document's current dirty state
      const wasDirty = editor.document.isDirty;

      // Process the includes
      await this.processDocument(editor);

      // If the document wasn't dirty before but is now, save it to preserve clean state
      if (!wasDirty && editor.document.isDirty) {
        // Use a short delay to ensure the edit has been fully applied
        setTimeout(async () => {
          try {
            await editor.document.save();
          } catch (error) {
            console.error(`Error auto-saving document: ${error}`);
          }
        }, 100);
      }
    } catch (error) {
      console.error(`Error in processDocumentWithoutDirtyState: ${error}`);
      this._uiHandler.showErrorMessage(`Extension error: ${error}`);
    }
  }

  /**
   * Delegates to the DocumentProcessor to process virtual includes in a document.
   * 
   * @param editor
   * @return Promise<void
   */
  public async processDocument(editor: vscode.TextEditor): Promise<void> {
    // Set status to processing
    this._statusBar.setProcessing();

    try {
      // Clear any existing diagnostics
      this._diagnostics.clearDiagnostics(editor.document);

      // Check for include issues
      const issueCount = this._diagnostics.checkDocument(editor.document);

      // Process document as before
      await this._documentProcessor.processDocument(editor);

      // Update status bar based on issues
      if (issueCount > 0) {
        this._statusBar.setIssues(issueCount);
      } else {
        this._statusBar.setIdle();
      }
    } catch (error) {
      // Show error in status bar
      this._statusBar.setIssues(1);
      console.error(`Error processing document: ${error}`);
      this._uiHandler.showErrorMessage(`Error: ${error}`);
    }
  }

  /**
   * Register event handlers:
   * 
   * 1. Sets up event handlers for VSCode events
   * 2. Creates handlers for document open, save, change, and editor change events
   * 3. Registers a handler for processing documents before saving
   * 4. Adds all event disposables to the _disposables array for later cleanup
   * 5. Each handler delegates to the appropriate component or method
   */
  private _registerEventHandlers(): void {
    // Event handler for text document open
    const onDocumentOpen = vscode.workspace.onDidOpenTextDocument(async document => {
      try {
        const editors = vscode.window.visibleTextEditors.filter(e => e.document === document);
        for (const editor of editors) {
          await this.processDocumentWithoutDirtyState(editor);
        }
      } catch (error) {
        console.error(`Error processing document on open: ${error}`);
      }
    });

    // Event handler for text document save
    const onDocumentSave = vscode.workspace.onDidSaveTextDocument(async document => {
      try {
        const editors = vscode.window.visibleTextEditors.filter(e => e.document === document);
        for (const editor of editors) {
          await this.processDocument(editor);
        }
      } catch (error) {
        console.error(`Error processing document on save: ${error}`);
      }
    });

    // Event handler for text document changes - detect virtual include directive as you type
    const onDocumentChange = vscode.workspace.onDidChangeTextDocument(async e => {
      try {
        // Skip non-file documents
        if (e.document.uri.scheme !== 'file') {
          return;
        }

        // Check if any of the changes might be creating a virtual include directive
        let mightHaveInclude = false;

        for (const change of e.contentChanges) {
          // If it's a short change that might contain the start of a virtual include directive
          if (change.text.includes('#') || change.text.includes('virtualInclude') || change.text.includes('"')) {
            mightHaveInclude = true;
            break;
          }
        }

        if (mightHaveInclude) {
          // Check the current line for the complete directive
          const editor = vscode.window.visibleTextEditors.find(
            editor => editor.document === e.document
          );

          if (editor) {
            const document = editor.document;
            const cursorPos = editor.selection.active;
            const currentLine = document.lineAt(cursorPos.line).text;

            // If the current line has a complete virtual include directive
            if (Constants.VIRTUAL_INCLUDE_REGEX.test(currentLine)) {
              // Add a small delay to allow typing to complete
              setTimeout(async () => {
                await this.processDocument(editor);
              }, 100);
            }
          }
        } else {
          // Check for edits in protected regions
          await this._editProtection.handleProtectedEdits(e);
        }
      } catch (error) {
        console.error(`Error processing document changes: ${error}`);
      }
    });

    // Event handler for active editor change
    const onActiveEditorChange = vscode.window.onDidChangeActiveTextEditor(async editor => {
      if (editor) {
        await this.processDocumentWithoutDirtyState(editor);
      }
    });

    // Also need to add a handler for 'onWillSaveTextDocument' to fix any incomplete regions
    const onWillSaveTextDocument = vscode.workspace.onWillSaveTextDocument(e => {
      e.waitUntil(this._editProtection.preventProtectedEdits(e.document));
    });

    // Add all disposables
    this._disposables.push(
      onDocumentOpen,
      onDocumentSave,
      onDocumentChange,
      onActiveEditorChange,
      onWillSaveTextDocument
    );
  }

  /**
   * Provide controlled access to internal state and components. Allow components to access shared state
   * without exposing direct references. Enable components to use each other's functionality while 
   * maintaining encapsulation.
   */

  get documentIncludes(): Map<string, Map<number, string>> {
    return this._documentIncludes;
  }

  get documentWatchers(): Map<string, vscode.FileSystemWatcher[]> {
    return this._documentWatchers;
  }

  get sourceToDocuments(): Map<string, Set<string>> {
    return this._sourceToDocuments;
  }

  get isPerformingUpdate(): boolean {
    return this._isPerformingUpdate;
  }

  set isPerformingUpdate(value: boolean) {
    this._isPerformingUpdate = value;
  }

  get uiHandler(): UIHandler {
    return this._uiHandler;
  }

  get documentProcessor(): DocumentProcessor {
    return this._documentProcessor;
  }

  get fileWatcher(): FileWatcher {
    return this._fileWatcher;
  }

  get editProtection(): EditProtection {
    return this._editProtection;
  }

  /**
   * Clean up resources
   * 
   * 1. Implements the vscode.Disposable interface
   * 2. Cleans up all resources when the extension is deactivated
   * 3. Disposes of all file watchers
   * 4. Clears all tracking maps
   * 5. Disposes of all event handlers stored in _disposables
   * 6. Ensures the extension doesn't leak resources
   */
  public dispose(): void {
    // Dispose all watchers
    for (const watchers of this._documentWatchers.values()) {
      for (const watcher of watchers) {
        watcher.dispose();
      }
    }

    // Clear maps
    this._documentWatchers.clear();
    this._documentIncludes.clear();
    this._sourceToDocuments.clear();
    this._statusBar.dispose();
    this._diagnostics.dispose();

    // Dispose all registered disposables
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
    this._disposables = [];
  }
}
