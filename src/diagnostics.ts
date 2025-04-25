import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LanguageService } from './language-service';

/**
 * The DiagnosticsManager class analyzes documents for problems with virtual includes and reports 
 * them directly in the editor using VSCode's diagnostics system. This allows users to see error 
 * indicators (red squiggly underlines) on problematic include directives.
 * 
 * HOW IT WORKS IN DETAIL
 * 
 * The DiagnosticsManager is integrated into the document processing workflow:
 * 
 * - Before processing includes, the manager scans the document for potential issues
 * - For each include directive, it checks if the referenced file exists
 * - If a file is missing or can't be accessed, it creates a diagnostic
 * - VSCode displays these diagnostics as red squiggly underlines in the editor
 * - When hovering over these underlines, users see the specific error message
 * 
 * This provides immediate visual feedback about problems right in the editor, making it much easier 
 * for users to identify and fix issues with their virtual includes.
 */
export class DiagnosticsManager {
    private _diagnosticCollection: vscode.DiagnosticCollection;

    /**
     * Creates a named collection to store diagnostics for different documents and groups all 
     * diagnostics under the "virtualInclude" namespace for organization
     */
    constructor() {
        this._diagnosticCollection = vscode.languages.createDiagnosticCollection('virtualInclude');
    }

    /**
     * Scans a document for include directives and verifies if they reference valid files:
     * 
     * 1. Returns the count of issues found for status reporting
     * 2. Creates diagnostic objects for each problem detected
     * 
     * @param document 
     * @returns number of errors
     */
    public checkDocument(document: vscode.TextDocument): number {
        const text = document.getText();
        const lines = text.split('\n');
        const diagnostics: vscode.Diagnostic[] = [];
        const languageSettings = LanguageService.getLanguageSettings(document.languageId);

        // Create regex for include directive using language settings
        const includeRegex = new RegExp(languageSettings.includeDirectivePattern);

        // Process each line to find include directives
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = line.match(includeRegex);

            if (match) {
                const filePath = match[1];
                const resolvedPath = this.resolveIncludePath(document, filePath);
                const range = this.getIncludeRange(document, i, match);

                // Check if file exists
                if (!fs.existsSync(resolvedPath)) {
                    // Create diagnostic for missing file
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        `Cannot find included file: ${filePath}`,
                        vscode.DiagnosticSeverity.Error
                    );
                    diagnostic.source = 'Virtual Include';
                    diagnostics.push(diagnostic);
                }
            }
        }

        // Update diagnostics for this document
        this._diagnosticCollection.set(document.uri, diagnostics);

        // Return the number of issues found
        return diagnostics.length;
    }

    /**
     * Removes diagnostics for a specific document.
     * 
     * @param document 
     */
    public clearDiagnostics(document: vscode.TextDocument): void {
        this._diagnosticCollection.delete(document.uri);
    }

    /**
     * Determines the exact position of an include directive in the document.
     * 
     * @param document
     * @param line 
     * @param match 
     * @returns vscode.Range
     */
    private getIncludeRange(document: vscode.TextDocument, line: number, match: RegExpMatchArray): vscode.Range {
        const lineText = document.lineAt(line).text;
        const startIndex = lineText.indexOf(match[0]);
        const endIndex = startIndex + match[0].length;

        return new vscode.Range(
            new vscode.Position(line, startIndex),
            new vscode.Position(line, endIndex)
        );
    }

    /**
     * Resolves file paths relative to the document.
     * 
     * @param document 
     * @param includePath 
     * @returns string
     */
    private resolveIncludePath(document: vscode.TextDocument, includePath: string): string {
        if (path.isAbsolute(includePath)) {
            return includePath;
        }

        const documentDir = path.dirname(document.uri.fsPath);
        return path.resolve(documentDir, includePath);
    }

    /**
     * Clean up resources.
     */
    public dispose(): void {
        this._diagnosticCollection.dispose();
    }
}
