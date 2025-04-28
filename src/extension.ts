import * as vscode from "vscode";
import { VirtualIncludeManager } from "./virtual-include-manager";
import {
  VirtualIncludeCodeLensProvider,
  openIncludedFile,
} from "./code-lens-provider";

/**
 * The extension file serves as the entry point for the Virtual Include extension.
 * It exports the activate and deactivate functions that VSCode calls when the extension
 * is activated and deactivated, respectively. It serves as a lightweight orchestrator
 * that sets up the extension's core functionality.
 */

/**
 * Called by VSCode when the extension is activated (based on activation events):
 *
 * 1. Creates an instance of the VirtualIncludeManager
 * 2. Initializes the manager
 * 3. Registers the extension's command(s)
 * 4. Sets up delayed processing of open documents
 *
 * @param context
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("Virtual Include extension is now active");

  // Create the manager instance
  const manager = new VirtualIncludeManager();

  // Initialize the manager
  manager.initialize();

  // Register commands
  const processCommand = vscode.commands.registerCommand(
    "virtualInclude.process",
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await manager.processDocument(editor);
      }
    },
  );

  // Register the command to open included files
  const openIncludedFileCommand = vscode.commands.registerCommand(
    "virtualInclude.openIncludedFile",
    openIncludedFile,
  );

  // Register the code lens provider for all supported languages
  const supportedLanguages = [
    "javascript",
    "typescript",
    "python",
    "ruby",
    "powershell",
    "shellscript",
    "csharp",
    "java",
    "c",
    "cpp",
    "go",
    "rust",
    "php",
    "perl",
    "lua",
    "sql",
    "yaml",
    "html",
    "xml",
    "css",
    "markdown",
    "plaintext",
  ];

  const codeLensProvider = new VirtualIncludeCodeLensProvider();
  const codeLensRegistration = vscode.languages.registerCodeLensProvider(
    supportedLanguages.map((lang) => ({ language: lang })),
    codeLensProvider,
  );

  // Add disposables to context
  context.subscriptions.push(
    processCommand,
    openIncludedFileCommand,
    codeLensRegistration,
    manager,
  );

  // Process open documents on startup with a delay to ensure VSCode is fully initialized
  setTimeout(() => {
    console.log("Processing all open documents on startup");
    manager.processAllOpenDocuments();
  }, 1000);
}

/**
 * Called by VSCode when the extension is deactivated:
 *
 * 1. Logs deactivation message
 * 2. Cleanup is handled by the manager's dispose method
 */
export function deactivate() {
  console.log("Virtual Include extension has been deactivated");
}
