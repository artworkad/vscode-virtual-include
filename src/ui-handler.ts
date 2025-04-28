import * as vscode from "vscode";
import * as path from "path";
import { VirtualIncludeManager } from "./virtual-include-manager";

/**
 * The ui-handler module manages all user interface interactions for the Virtual Include extension.
 * It centralizes all UI-related functionality, including displaying messages, showing notifications,
 * and handling user interactions like quick picks and progress indicators. It provides a clean interface
 * for other components to communicate with the user.
 *
 * HOW IT WORKS IN DETAIL
 *
 * When a source file changes, the FileWatcher calls the UIHandler to show a notification. The notification
 * includes buttons for showing affected files or saving all files. If the user clicks:
 *
 * - Show affected files: The UIHandler displays a quick pick list of all affected files.
 *   When the user selects a file, it opens that file in the editor.
 * - Save all: The UIHandler saves all affected files, showing a progress bar during the operation
 *   and a summary when complete.
 *
 * The UIHandler uses VSCode's progress API to provide visual feedback during long operations,
 * and it formats messages to be clear and informative, improving the overall user experience.
 * This centralized approach to UI handling ensures consistent messaging throughout the extension
 * and makes it easier to modify the user experience in the future.
 */
export class UIHandler {
  constructor(private _manager: VirtualIncludeManager) {}

  /**
   * Show info message.
   *
   * @param message
   */
  public showInfoMessage(message: string): void {
    vscode.window.showInformationMessage(message);
  }

  /**
   * Show warning message.
   *
   * @param message
   */
  public showWarningMessage(message: string): void {
    vscode.window.showWarningMessage(message);
  }

  /**
   * Show error message
   *
   * @param message
   */
  public showErrorMessage(message: string): void {
    vscode.window.showErrorMessage(message);
  }

  /**
   * Displays a notification when source files change.
   *
   * 1. Shows how many files are affected
   * 2. Provides action buttons for viewing or saving affected files
   * 3. Handles user selection of actions
   *
   * @param sourcePath
   */
  public showAffectedFilesNotification(sourcePath: string): void {
    const affectedDocuments =
      this._manager.sourceToDocuments.get(sourcePath) || new Set<string>();
    const fileName = path.basename(sourcePath);
    const message = `${fileName} changed, affecting ${
      affectedDocuments.size
    } file${affectedDocuments.size !== 1 ? "s" : ""}`;

    const showFiles = "Show affected files";
    const saveAll = "Save all";

    vscode.window
      .showInformationMessage(
        message + " (changes are not automatically saved)",
        showFiles,
        saveAll,
      )
      .then((selection) => {
        if (selection === showFiles) {
          this.showAffectedFilesQuickPick(sourcePath);
        } else if (selection === saveAll) {
          this.saveAffectedFiles(sourcePath);
        }
      });
  }

  /**
   * Shows a quick pick dialog listing affected files.
   *
   * 1. Displays files with relative paths for better readability
   * 2. Allows users to select a file to open
   * 3. Handles opening the selected document
   *
   * @param sourcePath
   * @returns Promise<void>
   */
  public async showAffectedFilesQuickPick(sourcePath: string): Promise<void> {
    const affectedDocuments =
      this._manager.sourceToDocuments.get(sourcePath) || new Set<string>();

    if (affectedDocuments.size === 0) {
      this.showInfoMessage("No affected files found");
      return;
    }

    // Convert to array of QuickPickItems
    const items: vscode.QuickPickItem[] = Array.from(affectedDocuments).map(
      (uri) => {
        const parsedUri = vscode.Uri.parse(uri);
        const relativePath = vscode.workspace.asRelativePath(parsedUri);

        return {
          label: relativePath,
          description: "Contains virtual include",
          detail: uri,
        };
      },
    );

    // Show quick pick
    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: "Select a file to open",
      canPickMany: false,
    });

    if (selected) {
      try {
        const document = await vscode.workspace.openTextDocument(
          vscode.Uri.parse(selected.detail!),
        );
        await vscode.window.showTextDocument(document);
      } catch (error) {
        this.showErrorMessage(`Failed to open document: ${error}`);
      }
    }
  }

  /**
   * Handles saving all affected files
   *
   * 1. Shows a progress indicator during the save operation
   * 2. Provides detailed feedback on what was saved
   * 3. Handles error cases gracefully
   *
   * @param sourcePath
   * @returns Promise<void>
   */
  public async saveAffectedFiles(sourcePath: string): Promise<void> {
    const affectedDocuments =
      this._manager.sourceToDocuments.get(sourcePath) || new Set<string>();

    if (affectedDocuments.size === 0) {
      this.showInfoMessage("No affected files to save");
      return;
    }

    let savedCount = 0;
    let errorCount = 0;

    try {
      // Show progress indicator
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Saving affected files...",
          cancellable: false,
        },
        async (progress) => {
          const total = affectedDocuments.size;
          let current = 0;

          for (const uri of affectedDocuments) {
            try {
              // Update progress
              current++;
              progress.report({
                message: `Saving file ${current}/${total}`,
                increment: 100 / total,
              });

              // Parse the URI and open the document if needed
              const parsedUri = vscode.Uri.parse(uri);
              let document: vscode.TextDocument;

              // First, check if the document is already open in an editor
              const openedDoc = vscode.workspace.textDocuments.find(
                (doc) => doc.uri.toString() === uri,
              );

              if (openedDoc) {
                document = openedDoc;
              } else {
                // If not already open, open it
                document = await vscode.workspace.openTextDocument(parsedUri);
              }

              // Check if document has unsaved changes before saving
              if (document.isDirty) {
                // Use explicit save API, not saveAll which might be ignored
                await document.save();
                console.log(`Saved document ${uri}`);
                savedCount++;
              } else {
                console.log(`Document ${uri} has no changes to save`);
              }
            } catch (error) {
              console.error(`Failed to save document ${uri}: ${error}`);
              errorCount++;
            }
          }
        },
      );

      // Show summary message
      if (savedCount > 0) {
        this.showInfoMessage(`Successfully saved ${savedCount} file(s)`);
      } else if (errorCount > 0) {
        this.showErrorMessage(
          `Failed to save ${errorCount} file(s). See console for details.`,
        );
      } else {
        this.showInfoMessage("No files needed saving");
      }
    } catch (error) {
      console.error(`Error in saveAffectedFiles: ${error}`);
      this.showErrorMessage(`Error saving files: ${error}`);
    }
  }
}
