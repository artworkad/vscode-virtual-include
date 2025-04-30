import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { VirtualIncludeManager } from "./virtual-include-manager";
import { LanguageService, LanguageSettings } from "./language-service";

/**
 * The document-processor module is the heart of the Virtual Include extension,
 * responsible for scanning documents, finding virtual includes, and managing their content.
 * It scans for include directives, reads the referenced files, compares current content with
 * source content, and updates documents when needed.
 *
 * HOW IT WORKS IN DETAIL
 *
 * When a document is opened, saved, or changed, the DocumentProcessor scans it for
 * virtual include directives. For each directive it finds:
 *
 * - It resolves the file path and reads the referenced file
 * - It checks if the include is already expanded in the document
 * - If expanded, it compares the current content with the source content, accounting for indentation
 * - If the content differs or the include is new, it updates the document
 *
 * The update process:
 *
 * - Preserves the indentation from the include directive
 * - Adds start and end markers to indicate protected regions
 * - Replaces existing content or inserts new content as needed
 * - Uses WorkspaceEdit for reliable document modification
 * - Updates line offsets to account for content changes
 *
 * The DocumentProcessor carefully tracks which source files are used by which documents,
 * enabling the extension to update all relevant documents when a source file changes.
 * This component is crucial for maintaining the accuracy and consistency of virtual includes
 * across the workspace, ensuring that changes to source files are properly reflected in all
 * documents that include them.
 */
export class DocumentProcessor {
  constructor(private _manager: VirtualIncludeManager) {}

  /**
   * The main method that scans a document for virtual includes:
   *
   * 1. Identifies include directives using regular expressions
   * 2. Resolves file paths and reads content
   * 3. Compares existing includes with source files
   * 4. Determines if updates are needed
   * 5. Tracks relationships between source files and including documents
   *
   * @param editor
   * @returns Promise<void>
   */
  public async processDocument(editor: vscode.TextEditor): Promise<void> {
    try {
      const document = editor.document;
      const documentKey = document.uri.toString();

      const languageSettings = LanguageService.getLanguageSettings(
        document.languageId,
      );

      // Clear existing watchers for this document
      if (this._manager.documentWatchers.has(documentKey)) {
        for (const watcher of this._manager.documentWatchers.get(
          documentKey,
        )!) {
          watcher.dispose();
        }
        this._manager.documentWatchers.delete(documentKey);
      }

      // Create a new map for this document
      const includeMap = new Map<number, string>();
      this._manager.documentIncludes.set(documentKey, includeMap);
      const watchers: vscode.FileSystemWatcher[] = [];

      const text = document.getText();
      const lines = text.split("\n");
      let needsEdit = false;

      // First pass: identify all virtual includes and their current state
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Get language settings specific to this context
        const contextAwareSettings = LanguageService.getContextAwareSettings({
          document,
          lineNumber: i,
          line,
        });

        // Try to match the include directive
        const match = line.match(contextAwareSettings.includeDirectivePattern);

        if (match) {
          // Check first for the override pattern with 'with' syntax
          const overrideMatch = line.match(
            LanguageService.COMMENT_OVERRIDE_REGEX,
          );
          const filePath = overrideMatch ? overrideMatch[1] : match[1];

          if (this._isSelfInclude(document, filePath)) {
            // Log the issue
            console.warn(
              `Preventing self-include in file: ${document.uri.fsPath}`,
            );

            // Show a warning to the user
            this._manager.uiHandler.showWarningMessage(
              `Cannot include a file in itself: ${filePath}`,
            );

            // Skip processing this include
            continue;
          }

          const resolvedPath = this._resolveIncludePath(document, filePath);

          try {
            if (fs.existsSync(resolvedPath)) {
              const content = fs.readFileSync(resolvedPath, "utf8");
              includeMap.set(i, content);

              // Track the relationship between source file and including document
              if (!this._manager.sourceToDocuments.has(resolvedPath)) {
                this._manager.sourceToDocuments.set(
                  resolvedPath,
                  new Set<string>(),
                );
              }
              this._manager.sourceToDocuments
                .get(resolvedPath)!
                .add(documentKey);

              // Check if already expanded
              const nextLineIndex = i + 1;

              // Get the language settings appropriate for this include
              const contextAwareSettings =
                LanguageService.getContextAwareSettings({
                  document,
                  lineNumber: i,
                  line,
                  includedFilePath: resolvedPath,
                });

              if (
                nextLineIndex < lines.length &&
                (lines[nextLineIndex].trim() ===
                  languageSettings.startMarkerTemplate.trim() ||
                  lines[nextLineIndex].trim() ===
                    contextAwareSettings.startMarkerTemplate.trim())
              ) {
                // Find the end marker
                let endLine = -1;

                for (let j = nextLineIndex + 1; j < lines.length; j++) {
                  if (
                    lines[j].trim() ===
                      languageSettings.endMarkerTemplate.trim() ||
                    lines[j].trim() ===
                      contextAwareSettings.endMarkerTemplate.trim()
                  ) {
                    endLine = j;
                    break;
                  }
                }

                if (endLine !== -1) {
                  // Extract current content
                  const currentContent = lines
                    .slice(nextLineIndex + 1, endLine)
                    .join("\n");

                  // Get indentation of the include line
                  const indentation = line.match(/^(\s*)/)?.[1] || "";

                  // Apply indentation to the content for comparison
                  const indentedContent = content
                    .split("\n")
                    .map((contentLine) =>
                      contentLine.length > 0
                        ? indentation + contentLine
                        : contentLine,
                    )
                    .join("\n");

                  // If content has changed, mark for update
                  if (currentContent !== indentedContent) {
                    console.log(
                      `Content changed for include at line ${i}, will update`,
                    );
                    needsEdit = true;
                  } else {
                    console.log(
                      `Content unchanged for include at line ${i}, no update needed`,
                    );
                  }
                } else {
                  // End marker missing, need to fix
                  console.log(
                    `End marker missing for include at line ${i}, will fix`,
                  );
                  needsEdit = true;
                }
              } else {
                // Not expanded yet, mark for expansion
                console.log(
                  `Include at line ${i} not yet expanded, will expand`,
                );
                needsEdit = true;
              }

              // Set up file watcher
              const watcher =
                this._manager.fileWatcher.createWatcher(resolvedPath);
              watchers.push(watcher);
            } else {
              this._manager.uiHandler.showErrorMessage(
                `File not found: ${resolvedPath}`,
              );
            }
          } catch (error) {
            console.error(`Error processing include at line ${i}: ${error}`);
            this._manager.uiHandler.showErrorMessage(
              `Error processing include: ${error}`,
            );
          }
        }
      }

      // Store watchers
      this._manager.documentWatchers.set(documentKey, watchers);

      // If we need to update the document, do it now
      if (needsEdit) {
        console.log(
          `Document ${document.uri} needs updates, applying changes...`,
        );
        await this.updateDocument(editor, includeMap);
      } else {
        console.log(`No updates needed for document ${document.uri}`);
      }
    } catch (error) {
      console.error(`Error in processDocument: ${error}`);
      this._manager.uiHandler.showErrorMessage(`Extension error: ${error}`);
    }
  }

  /**
   * Applies changes to the document when needed:
   *
   * 1. Handles both new includes and updates to existing includes
   * 2. Maintains proper indentation for included content
   * 3. Uses WorkspaceEdit for reliable document modification
   * 4. Properly handles line offsets as content is added/changed
   * 5. Manages the edit protection flag during updates
   *
   * @param editor
   * @param includeMap
   * @returns Promise<void>
   */
  /**
   * Neutralizes any include directives in the included content
   * to prevent them from being processed and causing infinite includes
   *
   * @param content The content to process
   * @param languageSettings The language settings for correct pattern matching
   * @returns The content with neutralized include directives
   */
  private _neutralizeNestedIncludes(
    content: string,
    languageSettings: LanguageSettings,
  ): string {
    // Create a regex based on the language-specific include directive pattern
    const includeRegex = new RegExp(languageSettings.includeDirectivePattern);

    // Don't modify start/end markers
    const startMarkerPattern = languageSettings.startMarkerTemplate.trim();
    const endMarkerPattern = languageSettings.endMarkerTemplate.trim();

    // Process line by line
    const lines = content.split("\n");
    const processedLines = lines.map((line) => {
      // Skip modifying start and end markers
      if (
        line.trim() === startMarkerPattern ||
        line.trim() === endMarkerPattern
      ) {
        return line;
      }

      // Only transform actual include directives
      if (includeRegex.test(line)) {
        // Replace "virtualInclude" with "virtualInclude-nested" to prevent processing
        // Only replace the exact directive pattern, not any occurrence of "virtualInclude"
        const transformedLine = line.replace(
          /(\s*\S+\s+)virtualInclude(\s+["'].+?["'])/,
          "$1virtualInclude-nested (edit source file to modify)$2",
        );

        console.log(
          `Neutralized nested include directive: "${line}" -> "${transformedLine}"`,
        );
        return transformedLine;
      }
      return line;
    });

    return processedLines.join("\n");
  }

  public async updateDocument(
    editor: vscode.TextEditor,
    includeMap: Map<number, string>,
  ): Promise<void> {
    try {
      // Set the flag to disable edit protection during our update
      this._manager.isPerformingUpdate = true;

      // Verify the editor is still valid
      if (!editor || !editor.document || editor.document.isClosed) {
        console.log("Editor is no longer valid, skipping update");
        return;
      }

      const document = editor.document;
      const text = document.getText();
      const lines = text.split("\n");

      const languageSettings = LanguageService.getLanguageSettings(
        document.languageId,
      );

      // We'll track line offset as we add/remove lines
      let lineOffset = 0;

      // Make a copy of lines to track the document's current state as we make changes
      let currentLines = [...lines];

      console.log(
        `Processing ${includeMap.size} includes in document ${document.uri}`,
      );

      // Process each include in order (sort by line number to prevent issues)
      for (const [lineNumber, content] of [...includeMap.entries()].sort(
        (a, b) => a[0] - b[0],
      )) {
        const adjustedLine = lineNumber + lineOffset;

        console.log(
          `Processing include at original line ${lineNumber}, adjusted to ${adjustedLine} with offset ${lineOffset}`,
        );

        // Make sure we're not out of bounds
        if (adjustedLine >= currentLines.length) {
          console.log(
            `Skipping line ${adjustedLine} (out of bounds) - currentLines.length = ${currentLines.length}`,
          );
          continue;
        }

        // Get indentation of the include line
        const includeLine = currentLines[adjustedLine];
        const indentation = includeLine.match(/^(\s*)/)?.[1] || "";

        // Apply indentation to the content and markers
        let indentedContent = content
          .split("\n")
          .map((line) => (line.length > 0 ? indentation + line : line))
          .join("\n");

        // Neutralize any nested include directives in the content
        indentedContent = this._neutralizeNestedIncludes(
          indentedContent,
          languageSettings,
        );

        // Extract the include path from the line
        const includePathMatch = includeLine.match(
          /virtualInclude\s+["'](.+?)["']/,
        );
        const includePath = includePathMatch ? includePathMatch[1] : "";
        const resolvedPath = this._resolveIncludePath(document, includePath);

        // Get context-aware language settings for this include
        const contextAwareSettings = LanguageService.getContextAwareSettings({
          document,
          lineNumber: adjustedLine,
          line: includeLine,
          includedFilePath: resolvedPath,
        });

        const indentedStartMarker =
          indentation + contextAwareSettings.startMarkerTemplate;
        const indentedEndMarker =
          indentation + contextAwareSettings.endMarkerTemplate;

        // Check if already expanded
        const nextLineIndex = adjustedLine + 1;

        // Check if we still have lines to process
        if (nextLineIndex >= currentLines.length) {
          console.log(
            `Next line ${nextLineIndex} is beyond document end (${currentLines.length} lines)`,
          );
          continue;
        }

        const nextLineTrimmed = currentLines[nextLineIndex].trim();
        const startMarkerTrimmed =
          contextAwareSettings.startMarkerTemplate.trim();
        const languageStartMarkerTrimmed =
          languageSettings.startMarkerTemplate.trim();

        if (
          nextLineTrimmed === startMarkerTrimmed ||
          nextLineTrimmed === languageStartMarkerTrimmed
        ) {
          // It's already expanded, find the end marker
          let endLine = -1;

          for (let j = nextLineIndex + 1; j < currentLines.length; j++) {
            const lineTrimmed = currentLines[j].trim();
            if (
              lineTrimmed === contextAwareSettings.endMarkerTemplate.trim() ||
              lineTrimmed === languageSettings.endMarkerTemplate.trim()
            ) {
              endLine = j;
              break;
            }
          }

          console.log(
            `Found existing include block from line ${nextLineIndex} to ${endLine}`,
          );

          // Complete replacement - always replace the ENTIRE include section (start marker through end marker)
          const workspaceEdit = new vscode.WorkspaceEdit();

          if (endLine !== -1) {
            // Found start and end markers - replace the entire block
            const startPos = new vscode.Position(nextLineIndex, 0);
            const endPos = new vscode.Position(endLine + 1, 0);

            const newContent = `${indentedStartMarker}\n${indentedContent}\n${indentedEndMarker}\n`;

            // Replace with fresh markers and content
            workspaceEdit.replace(
              document.uri,
              new vscode.Range(startPos, endPos),
              newContent,
            );

            // Apply the edit
            await vscode.workspace.applyEdit(workspaceEdit);

            // Calculate how many lines were in the old content vs new content
            const oldLineCount = endLine + 1 - nextLineIndex;
            const newLineCount = newContent.split("\n").length - 1; // -1 because the last newline doesn't add a line

            // Update our tracking array of current lines
            const newContentLines = newContent.split("\n");
            if (newContentLines[newContentLines.length - 1] === "") {
              newContentLines.pop(); // Remove empty last line
            }

            // Replace the content in our tracking array
            currentLines.splice(
              nextLineIndex,
              oldLineCount,
              ...newContentLines,
            );

            // Update line offset
            const lineDifference = newLineCount - oldLineCount;
            lineOffset += lineDifference;

            console.log(
              `Replaced include block. Line difference: ${lineDifference}, new offset: ${lineOffset}`,
            );
          } else {
            // Start marker exists but end marker is missing
            console.log(
              `End marker missing for include at line ${adjustedLine}`,
            );

            // Find a reasonable place to end our replacement (next 20 lines max)
            const maxLines = Math.min(currentLines.length, nextLineIndex + 20);
            let replacementEndLine = nextLineIndex + 1;

            // Find the next include directive as a potential boundary
            for (let j = nextLineIndex + 1; j < maxLines; j++) {
              if (
                currentLines[j].match(
                  contextAwareSettings.includeDirectivePattern,
                )
              ) {
                replacementEndLine = j;
                break;
              }
              replacementEndLine = j;
            }

            // Replace from start marker to our determined endpoint
            const startPos = new vscode.Position(nextLineIndex, 0);
            const endPos = new vscode.Position(replacementEndLine, 0);

            const newContent = `${indentedStartMarker}\n${indentedContent}\n${indentedEndMarker}\n`;

            workspaceEdit.replace(
              document.uri,
              new vscode.Range(startPos, endPos),
              newContent,
            );

            // Apply the edit
            await vscode.workspace.applyEdit(workspaceEdit);

            // Calculate how many lines were in the old content vs new content
            const oldLineCount = replacementEndLine - nextLineIndex;
            const newLineCount = newContent.split("\n").length - 1; // -1 because the last newline doesn't add a line

            // Update our tracking array of current lines
            const newContentLines = newContent.split("\n");
            if (newContentLines[newContentLines.length - 1] === "") {
              newContentLines.pop(); // Remove empty last line
            }

            // Replace the content in our tracking array
            currentLines.splice(
              nextLineIndex,
              oldLineCount,
              ...newContentLines,
            );

            // Update line offset
            const lineDifference = newLineCount - oldLineCount;
            lineOffset += lineDifference;

            console.log(
              `Replaced partial include block. Line difference: ${lineDifference}, new offset: ${lineOffset}`,
            );
          }
        } else {
          // Not expanded yet, insert new content
          console.log(`Insert new include content at line ${adjustedLine}`);

          const workspaceEdit = new vscode.WorkspaceEdit();

          // Get the end of the current line
          const currentLineLength = includeLine.length;
          const endOfLine = new vscode.Position(
            adjustedLine,
            currentLineLength,
          );

          const newContent = `\n${indentedStartMarker}\n${indentedContent}\n${indentedEndMarker}\n`;

          // Insert a newline followed by our markers and content
          workspaceEdit.insert(document.uri, endOfLine, newContent);

          // Apply the edit
          await vscode.workspace.applyEdit(workspaceEdit);

          // The new content lines
          const newContentLines = newContent.split("\n");
          if (newContentLines[newContentLines.length - 1] === "") {
            newContentLines.pop(); // Remove empty last line
          }

          // Update our tracking array to maintain sync with the document
          // We need to insert after the current line (adjustedLine)
          currentLines.splice(adjustedLine + 1, 0, ...newContentLines.slice(1)); // Skip the first element (empty string from initial newline)

          // Update line offset - add the number of lines we inserted
          lineOffset += newContentLines.length - 1; // -1 because the first newline doesn't add a line

          console.log(
            `Inserted new include content. Added ${
              newContentLines.length - 1
            } lines, new offset: ${lineOffset}`,
          );
        }
      }
    } catch (error) {
      console.error(`Error in updateDocument: ${error}`);
      this._manager.uiHandler.showErrorMessage(
        `Extension error in updateDocument: ${error}`,
      );
    } finally {
      // Reset the flag when done, regardless of success or failure
      this._manager.isPerformingUpdate = false;
    }
  }

  /**
   * Resolves relative paths based on document location.
   *
   * 1. Handles both absolute and relative paths
   * 2. Ensures the correct source file is read
   *
   * @param document
   * @param includePath
   * @returns string
   */
  private _resolveIncludePath(
    document: vscode.TextDocument,
    includePath: string,
  ): string {
    if (path.isAbsolute(includePath)) {
      return includePath;
    }

    const documentDir = path.dirname(document.uri.fsPath);
    return path.resolve(documentDir, includePath);
  }

  /**
   * Check if document is being included in itself.
   *
   * @param document
   * @param includePath
   * @returns
   */
  private _isSelfInclude(
    document: vscode.TextDocument,
    includePath: string,
  ): boolean {
    // Always resolve the include path, even if it looks like an absolute path
    const resolvedIncludePath = this._resolveIncludePath(document, includePath);
    const documentPath = document.uri.fsPath;

    // Add more debug logging
    console.log("Self-include check:");
    console.log(`- Document path: ${documentPath}`);
    console.log(`- Include path: ${includePath}`);
    console.log(`- Resolved path: ${resolvedIncludePath}`);

    // Use path.normalize to handle different path formats
    const normalizedDocPath = path.normalize(documentPath);
    const normalizedIncludePath = path.normalize(resolvedIncludePath);

    const isSelfInclude =
      process.platform === "win32"
        ? normalizedIncludePath.toLowerCase() ===
          normalizedDocPath.toLowerCase()
        : normalizedIncludePath === normalizedDocPath;

    console.log(`- Normalized paths match? ${isSelfInclude}`);
    return isSelfInclude;
  }
}
