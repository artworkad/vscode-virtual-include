import * as vscode from "vscode";
import * as path from "path";
import { VirtualIncludeManager } from "./virtual-include-manager";

/**
 * The file-watcher.ts module is responsible for monitoring changes to source files
 * that are referenced by virtual includes. It manages the creation and handling
 * of VSCode's FileSystemWatcher instances that monitor source files for changes.
 * When a source file changes, it coordinates the updating of all documents that
 * include that file.
 *
 * HOW IT WORKS IN DETAIL
 *
 * When a virtual include is processed, the DocumentProcessor calls the FileWatcher
 * to create a watcher for the included file. The watcher listens for changes to that file.
 * When a change occurs:
 *
 * - The watcher triggers the handleSourceFileChange method
 * - This method disables edit protection by setting the isPerformingUpdate flag
 * - It then finds all documents that include the changed file
 * - For each affected document, it:
 *    - Tracks if the document was already dirty
 *    - Processes the document to update the include
 *    - If the document wasn't previously dirty, it saves it to keep it clean
 * - Finally, it shows a notification with options to view or save affected files
 *
 * The FileWatcher is a key part of keeping virtual includes in sync with their source files,
 * ensuring changes propagate automatically to all including documents.
 */
export class FileWatcher {
  constructor(private _manager: VirtualIncludeManager) {}

  /**
   * Creates a new FileSystemWatcher for a specific source file:
   *
   * 1. Sets up event handlers for file changes and deletions
   * 2. Returns the watcher so it can be tracked by the manager
   * 3. Uses RelativePattern to watch only the specific file
   *
   * @param sourcePath
   * @returns vscode.FileSystemWatcher
   */
  public createWatcher(sourcePath: string): vscode.FileSystemWatcher {
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(
        path.dirname(sourcePath),
        path.basename(sourcePath)
      )
    );

    // Handle file changes
    watcher.onDidChange(async (uri) => {
      if (uri.fsPath === sourcePath) {
        console.log(`File ${sourcePath} changed, will reprocess includes`);
        await this.handleSourceFileChange(sourcePath);
      }
    });

    // Handle file deletions
    watcher.onDidDelete((uri) => {
      if (uri.fsPath === sourcePath) {
        this._manager.uiHandler.showWarningMessage(
          `Included file was deleted: ${sourcePath}`
        );
      }
    });

    return watcher;
  }

  /**
   * Called when a source file changes:
   *
   * 1. Identifies all documents that include the changed file
   * 2. Coordinates updating those documents
   * 3. Manages the protection flag during updates
   * 4. Preserves clean state for documents that weren't dirty
   * 5. Triggers UI notifications about affected files
   *
   * @param sourcePath
   * @returns Promise<void>
   */
  public async handleSourceFileChange(sourcePath: string): Promise<void> {
    // Get all documents that include this file
    const affectedDocuments =
      this._manager.sourceToDocuments.get(sourcePath) || new Set<string>();

    if (affectedDocuments.size > 0) {
      // Set the flag to disable edit protection during update
      this._manager.isPerformingUpdate = true;

      try {
        // Update all affected documents
        let processedCount = 0;

        for (const docUri of affectedDocuments) {
          try {
            const textDocument = await vscode.workspace.openTextDocument(
              vscode.Uri.parse(docUri)
            );
            const editors = vscode.window.visibleTextEditors.filter(
              (e) => e.document.uri.toString() === docUri
            );

            // If the document is open in an editor, update it
            if (editors.length > 0) {
              // Track if the document was dirty before our update
              const wasDirty = textDocument.isDirty;

              await this._manager.processDocument(editors[0]);
              processedCount++;

              // If it wasn't dirty before but is now, save it to preserve the clean state
              if (!wasDirty && textDocument.isDirty) {
                // This is a special case where we're fixing includes on file change
                // We should save the document to keep its clean state
                try {
                  // Use the checkDirty method to verify document is actually dirty before saving
                  const needsSave = await this._isActuallyDirty(textDocument);

                  if (needsSave) {
                    console.log(
                      `Auto-saving document ${docUri} that was clean before update`
                    );

                    // Wait a bit longer to ensure other processing is complete
                    await new Promise((resolve) => setTimeout(resolve, 300));

                    // Double-check it's still dirty before saving
                    if (textDocument.isDirty) {
                      await textDocument.save();
                    }
                  } else {
                    console.log(
                      `Document ${docUri} doesn't actually need saving`
                    );
                  }
                } catch (error) {
                  console.error(`Error auto-saving document: ${error}`);
                }
              }
            }
          } catch (error) {
            console.error(`Failed to update document ${docUri}: ${error}`);
          }
        }

        // Show notification with option to view affected files
        if (affectedDocuments.size > 0) {
          this._manager.uiHandler.showAffectedFilesNotification(sourcePath);
        }
      } finally {
        // Reset the flag when done
        this._manager.isPerformingUpdate = false;
      }
    }
  }

  /**
   * Checks if a document is actually dirty by comparing its content with the version on disk
   * This helps avoid unnecessary saves that could trigger infinite update chains
   *
   * @param document The document to check
   * @returns Promise<boolean> True if the document needs saving, false otherwise
   */
  private async _isActuallyDirty(
    document: vscode.TextDocument
  ): Promise<boolean> {
    try {
      // Get the on-disk content
      const uri = document.uri;
      const bytes = await vscode.workspace.fs.readFile(uri);
      const diskContent = new TextDecoder().decode(bytes);

      // Get the document content
      const docContent = document.getText();

      // Compare and return true if they're different (document is actually dirty)
      return diskContent !== docContent;
    } catch (error) {
      console.error(`Error checking document dirty state: ${error}`);
      // If there's an error, assume it's dirty to be safe
      return true;
    }
  }
}
