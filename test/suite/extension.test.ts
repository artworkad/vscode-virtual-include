import * as assert from "assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  vscode.window.showInformationMessage("Starting extension tests");

  test("Extension should be present", () => {
    assert.ok(
      vscode.extensions.getExtension("artworkad.vscode-virtual-include"),
    );
  });

  test("Extension should activate", async () => {
    const extension = vscode.extensions.getExtension(
      "artworkad.vscode-virtual-include",
    );
    await extension?.activate();
    assert.ok(extension?.isActive);
  });

  test("Should register commands", async () => {
    const commands = await vscode.commands.getCommands();
    assert.ok(commands.includes("virtualInclude.process"));
  });
});
