import * as vscode from "vscode";
import * as path from "path";
import { LanguageService } from "./language-service";

/**
 * The CodeLensProvider class adds clickable code lenses above each virtual include directive,
 * allowing users to quickly open the referenced files with a single click.
 *
 * HOW IT WORKS IN DETAIL
 *
 * When a document is opened or changed, the CodeLensProvider:
 *
 * - Scans the document for virtual include directives using language-specific patterns
 * - Creates a code lens positioned above each include directive
 * - Associates each code lens with a command to open the referenced file
 * - Resolves the file paths relative to the document containing the include
 *
 * This provides a convenient way for users to navigate between including documents and
 * their source files, enhancing the workflow when working with virtual includes.
 */
export class VirtualIncludeCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
    new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> =
    this._onDidChangeCodeLenses.event;

  constructor() {
    // Trigger a refresh of code lenses when configuration changes
    vscode.workspace.onDidChangeConfiguration((_) => {
      this._onDidChangeCodeLenses.fire();
    });
  }

  /**
   * Provides code lenses for a document
   *
   * @param document The document to provide code lenses for
   * @param token A cancellation token
   * @returns An array of code lenses or a promise that resolves to such an array
   */
  public provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken,
  ): vscode.ProviderResult<vscode.CodeLens[]> {
    // Check if code lenses are enabled in the configuration
    const config = vscode.workspace.getConfiguration("virtualInclude");
    const showCodeLens = config.get<boolean>("showCodeLens", true);

    // If code lenses are disabled, return an empty array
    if (!showCodeLens) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split("\n");

    // Get language settings for the document
    const languageSettings = LanguageService.getLanguageSettings(
      document.languageId,
    );

    // Create regex for include directive using language settings
    const includeRegex = new RegExp(languageSettings.includeDirectivePattern);

    // Process each line to find include directives
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Get context-aware settings for this specific line
      const contextAwareSettings = LanguageService.getContextAwareSettings({
        document,
        lineNumber: i,
        line,
      });

      // Try to match against the context-aware pattern
      const match = line.match(contextAwareSettings.includeDirectivePattern);

      if (match) {
        // Extract the file path from the include directive
        const filePath = match[1];

        // Create a range for the entire line
        const range = new vscode.Range(
          new vscode.Position(i, 0),
          new vscode.Position(i, line.length),
        );

        // Create a code lens with a command to open the file
        const codeLens = new vscode.CodeLens(range, {
          title: "Open included file",
          command: "virtualInclude.openIncludedFile",
          arguments: [document.uri, filePath],
        });

        codeLenses.push(codeLens);
      }
    }

    return codeLenses;
  }
}

/**
 * Opens a file referenced by a virtual include directive
 *
 * @param documentUri The URI of the document containing the include
 * @param includePath The path to the included file (may be relative)
 */
export async function openIncludedFile(
  documentUri: vscode.Uri,
  includePath: string,
): Promise<void> {
  try {
    // Resolve the include path relative to the document
    const resolvedPath = resolveIncludePath(documentUri, includePath);

    // Create a URI for the resolved path
    const fileUri = vscode.Uri.file(resolvedPath);

    // Open the document in an editor
    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document);
  } catch (error) {
    console.error(`Error opening included file: ${error}`);
    vscode.window.showErrorMessage(`Failed to open file: ${includePath}`);
  }
}

/**
 * Resolves a potentially relative include path to an absolute path
 *
 * @param documentUri The URI of the document containing the include
 * @param includePath The path to resolve (may be relative)
 * @returns The resolved absolute path
 */
function resolveIncludePath(
  documentUri: vscode.Uri,
  includePath: string,
): string {
  if (path.isAbsolute(includePath)) {
    return includePath;
  }

  const documentDir = path.dirname(documentUri.fsPath);
  return path.resolve(documentDir, includePath);
}
