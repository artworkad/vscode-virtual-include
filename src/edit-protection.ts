import * as vscode from 'vscode';
import { VirtualIncludeManager } from './virtual-include-manager';
import { LanguageService } from './language-service';

/**
 * The edit-protection module is responsible for preventing users from editing content 
 * that has been virtually included. It prevents the editing of included content by detecting 
 * when edits affect protected regions and either blocking those edits or immediately 
 * restoring the content. This ensures the integrity of included content while still allowing users 
 * to edit source files.
 * 
 * HOW IT WORKS IN DETAIL
 * 
 * When a document is edited, the EditProtection component:
 * 
 * - First checks if the edit is part of a programmatic update, and allows it if so
 * - Otherwise, identifies all protected regions in the document (between start/end markers)
 * - For each edit, checks if it overlaps with any protected region
 * - If an edit affects protected content:
 *   - Shows a warning message telling the user to edit the source file instead
 *   - Flags the document for immediate reprocessing
 *   - Quickly restores the content that was edited
 * 
 * The immediate reprocessing ensures that protected content is instantly restored if a user tries 
 * to modify it, providing clear feedback without disrupting the document state. This happens with 
 * a small delay (10ms) to ensure the edit is fully processed before restoration.
 * 
 * Additionally, when a document is saved, the component checks for and fixes any incomplete protected 
 * regions, ensuring the document stays in a valid state. This protection mechanism is crucial for 
 * maintaining the integrity of included content while providing a good user experience with clear feedback.
 */
export class EditProtection {
  constructor(private _manager: VirtualIncludeManager) { }

  /**
   * Examines document changes to detect edits to protected regions:
   * 
   * 1. Called each time a document is changed
   * 2. Identifies all protected regions in the document
   * 3. Checks if any edits affect these regions
   * 4. Prevents edits and shows appropriate warnings
   * 5. Immediately restores content when protected regions are edited
   * 
   * @param e 
   * @returns Promise<void>
   */
  public async handleProtectedEdits(e: vscode.TextDocumentChangeEvent): Promise<void> {
    // Skip protection check if we're performing a programmatic update
    if (this._manager.isPerformingUpdate) {
      return;
    }

    const languageSettings = LanguageService.getLanguageSettings(e.document.languageId);

    const document = e.document;
    const text = document.getText();
    const lines = text.split('\n');

    // Track protected regions
    const protectedRegions: { start: number; end: number }[] = [];
    let inProtectedRegion = false;
    let currentStart = -1;

    // Find all protected regions
    for (let i = 0; i < lines.length; i++) {
      const lineTrimmed = lines[i].trim();

      if (lineTrimmed === languageSettings.startMarkerTemplate.trim()) {
        inProtectedRegion = true;
        currentStart = i;
      } else if (lineTrimmed === languageSettings.endMarkerTemplate.trim() && inProtectedRegion) {
        inProtectedRegion = false;
        // Add the complete region to our list
        if (currentStart !== -1) {
          protectedRegions.push({ start: currentStart, end: i });
          currentStart = -1;
        }
      }
    }

    // Only check if there were changes
    if (e.contentChanges.length > 0) {
      let needsImmedateReprocess = false;

      // Check each edit
      for (const change of e.contentChanges) {
        // Get the range of the edit
        const startPos = change.range.start;
        const endPos = change.range.end;
        const startLine = startPos.line;
        const endLine = endPos.line;

        // Check if this edit affects any protected region
        for (const region of protectedRegions) {
          // Skip the marker lines themselves - allow editing those
          const protectedContentStart = region.start + 1;
          const protectedContentEnd = region.end - 1;

          // Check for overlap with protected content
          if ((startLine >= protectedContentStart && startLine <= protectedContentEnd) ||
            (endLine >= protectedContentStart && endLine <= protectedContentEnd) ||
            (startLine < protectedContentStart && endLine > protectedContentEnd)) {
            // Cancel the edit by showing a message
            vscode.window.showWarningMessage('Cannot edit protected virtual include content. Edit the source file instead.');

            // Flag that we need to reprocess immediately to restore content
            needsImmedateReprocess = true;
            break;
          }
        }

        if (needsImmedateReprocess) {
          break;
        }
      }

      // If protected content was edited, immediately reprocess to restore it
      if (needsImmedateReprocess) {
        // Add a small delay to ensure the edit has been fully processed
        setTimeout(async () => {
          const editor = vscode.window.activeTextEditor;
          if (editor && editor.document === document) {
            // Flag that we're doing a programmatic update
            this._manager.isPerformingUpdate = true;
            try {
              await this._manager.processDocument(editor);
            } finally {
              this._manager.isPerformingUpdate = false;
            }
          }
        }, 10);
      }
    }
  }

  /**
   * Fixes any incomplete protected regions during save:
   * 
   * 1. Checks for missing end markers in protected regions
   * 2. Adds missing markers to ensure the document structure is valid
   * 3. Maintains proper indentation for added markers
   * 
   * @param document 
   * @returns Promise<vscode.TextEdit[]>
   */
  public async preventProtectedEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
    const text = document.getText();
    const lines = text.split('\n');
    const edits: vscode.TextEdit[] = [];

    const languageSettings = LanguageService.getLanguageSettings(document.languageId);

    // Find protected regions
    let inProtectedRegion = false;
    let protectedStart = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === languageSettings.startMarkerTemplate.trim()) {
        inProtectedRegion = true;
        protectedStart = i;
      } else if (line.trim() === languageSettings.endMarkerTemplate.trim()) {
        inProtectedRegion = false;
        protectedStart = -1;
      }
    }

    // If we ended in a protected region (missing end marker)
    // Add an edit to fix it
    if (inProtectedRegion && protectedStart !== -1) {
      // Get indentation from protected start line
      const startLine = lines[protectedStart];
      const indentation = startLine.match(/^(\s*)/)?.[1] || '';
      const indentedEndMarker = indentation + languageSettings.endMarkerTemplate;

      edits.push(vscode.TextEdit.insert(
        new vscode.Position(lines.length, 0),
        `\n${indentedEndMarker}\n`
      ));
    }

    return edits;
  }
}
