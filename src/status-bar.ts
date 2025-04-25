import * as vscode from 'vscode';

/**
 * The StatusBarManager class creates and manages a status bar item that gives users immediate 
 * visual feedback about the Virtual Include extension's current state, whether it's processing 
 * includes, idle, or has encountered issues.
 * 
 * HOW IT WORKS IN DETAIL
 * 
 * The StatusBarManager is created when the extension activates and provides methods that other 
 * components can call to update the status bar based on the current state:
 * 
 * - When the extension starts processing includes, it calls setProcessing() to show an animated indicator
 * - When processing completes successfully, it calls setIdle() to show the normal state
 * - When issues are detected, it calls setIssues(count) to show a warning with the number of issues
 * - The status bar item remains clickable in all states, allowing users to manually trigger processing
 * 
 * This provides immediate visual feedback to users about the extension's state and any issues that need
 * attention, enhancing the overall user experience.
 */
export class StatusBarManager {
    private _statusBarItem: vscode.StatusBarItem;

    /**
     * Creates a status bar item positioned on the right side of VSCode's status bar and associates
     * it with a command that allows users to click it. Sets initial appearance with an icon and text.
     */
    constructor() {
        this._statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        this._statusBarItem.command = 'virtualInclude.process';
        this._statusBarItem.show();
        this.setIdle();
    }

    /**
     * Shows an animated sync icon and message during processing.
     */
    public setProcessing(): void {
        this._statusBarItem.text = '$(sync~spin) Processing Includes...';
        this._statusBarItem.tooltip = 'Virtual Include is processing includes';
        this._statusBarItem.backgroundColor = undefined; // Reset background color
        this._statusBarItem.color = undefined; // Reset text color
    }

    /**
     * Shows the default icon and text when everything is normal.
     */
    public setIdle(): void {
        this._statusBarItem.text = '$(file-symlink-file) Virtual Include';
        this._statusBarItem.tooltip = 'Click to process virtual includes';
        this._statusBarItem.backgroundColor = undefined; // Reset background color
        this._statusBarItem.color = undefined; // Reset text color
    }

    /**
     * Shows a warning icon, error count, and red background when issues exist
     * @param count number of issues
     */
    public setIssues(count: number): void {
        this._statusBarItem.text = `$(warning) Virtual Include (${count} issues)`;
        this._statusBarItem.tooltip = `${count} include issues found. Click to process includes.`;
        this._statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }

    /**
     * Disposes status bar.
     */
    public dispose(): void {
        this._statusBarItem.dispose();
    }
}
