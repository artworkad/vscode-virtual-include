import * as assert from "assert";
import * as vscode from "vscode";
import * as sinon from "sinon";
import { StatusBarManager } from "../../src/status-bar";

suite("Status Bar Tests", function () {
  let statusBar: StatusBarManager;
  let mockStatusBarItem: any;
  let createmockStatusBarItem: sinon.SinonStub;

  // Set up the test environment
  setup(function () {
    // Create a mock status bar item instead of stubbing the class
    mockStatusBarItem = {
      text: "",
      tooltip: "",
      backgroundColor: undefined,
      command: "",
      show: sinon.stub(),
      dispose: sinon.stub(),
    };

    // Stub the vscode.window.createStatusBarItem method
    createmockStatusBarItem = sinon
      .stub(vscode.window, "createStatusBarItem")
      .returns(mockStatusBarItem);

    // Create the status bar manager
    statusBar = new StatusBarManager();
  });

  // Clean up after each test
  teardown(function () {
    sinon.restore();
  });

  test("Should initialize with idle state", function () {
    // Verify the status bar was created and shown
    assert.strictEqual(
      mockStatusBarItem.show.calledOnce,
      true,
      "Status bar item should be shown",
    );

    // Check the initial state
    assert.strictEqual(
      mockStatusBarItem.text,
      "$(file-symlink-file) Virtual Include",
      "Initial text should be set",
    );
    assert.strictEqual(
      mockStatusBarItem.tooltip,
      "Click to process virtual includes",
      "Initial tooltip should be set",
    );
  });

  test("Should change to processing state", function () {
    // Set processing state
    statusBar.setProcessing();

    // Verify the status was updated
    assert.strictEqual(
      mockStatusBarItem.text,
      "$(sync~spin) Processing Includes...",
      "Text should indicate processing",
    );
    assert.strictEqual(
      mockStatusBarItem.tooltip,
      "Virtual Include is processing includes",
      "Tooltip should indicate processing",
    );
    assert.strictEqual(
      mockStatusBarItem.backgroundColor,
      undefined,
      "Background color should be reset",
    );
  });

  test("Should show issues with error style", function () {
    // Set issues state
    statusBar.setIssues(3);

    // Verify the status was updated with error indication
    assert.strictEqual(
      mockStatusBarItem.text,
      "$(warning) Virtual Include (3 issues)",
      "Text should show issue count",
    );
    assert.strictEqual(
      mockStatusBarItem.tooltip,
      "3 include issues found. Click to process includes.",
      "Tooltip should describe issues",
    );
    assert.strictEqual(
      mockStatusBarItem.backgroundColor.id,
      "statusBarItem.errorBackground",
      "Background should be error color",
    );
  });

  test("Should reset to idle state", function () {
    // First set an error state
    statusBar.setIssues(2);

    // Then reset to idle
    statusBar.setIdle();

    // Verify the status was reset
    assert.strictEqual(
      mockStatusBarItem.text,
      "$(file-symlink-file) Virtual Include",
      "Text should be reset",
    );
    assert.strictEqual(
      mockStatusBarItem.tooltip,
      "Click to process virtual includes",
      "Tooltip should be reset",
    );
    assert.strictEqual(
      mockStatusBarItem.backgroundColor,
      undefined,
      "Background color should be reset",
    );
  });

  test("Should properly dispose resources", function () {
    // Dispose the status bar
    statusBar.dispose();

    // Verify the status bar item was disposed
    assert.strictEqual(
      mockStatusBarItem.dispose.calledOnce,
      true,
      "Status bar item should be disposed",
    );
  });
});
