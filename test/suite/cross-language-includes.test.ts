import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import {
  createTestFile,
  createTestDocument,
  waitForVirtualIncludeProcessed,
  deleteTestFile,
} from "../testUtils";

suite("Cross-Language Includes Tests", () => {
  test('Explicit comment style override using "with" syntax', async () => {
    // Create a source Lua file
    const luaContent =
      'function transformPayload(input)\n  return input .. " transformed"\nend';
    const luaUri = await createTestFile(luaContent, ".lua");
    const luaPath = path.basename(luaUri.fsPath);

    // Create a YAML file with lua-resty-template syntax include
    const yamlContent = `template: >-
  {# virtualInclude '${luaPath}' with '{#' #}
  
  {# This is additional lua-resty-template content #}`;
    const editor = await createTestDocument(yamlContent, ".yaml");

    // Process the include
    await vscode.commands.executeCommand("virtualInclude.process");

    // Wait for processing to complete
    const processed = await waitForVirtualIncludeProcessed(editor);
    assert.strictEqual(processed, true, "Virtual include was not processed");

    // Verify the include was processed correctly using lua-resty-template comment style
    const text = editor.document.getText();
    assert.ok(
      text.includes("{# virtualIncludeStart"),
      "lua-resty-template style start marker not found",
    );
    assert.ok(
      text.includes("{# virtualIncludeEnd"),
      "lua-resty-template style end marker not found",
    );
    assert.ok(
      text.includes("function transformPayload"),
      "Included Lua content not found",
    );

    // Clean up
    await deleteTestFile(luaUri);
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("Auto-detection from file extension", async () => {
    // Create a JavaScript source file
    const jsContent = 'function getUser() {\n  return { name: "John" };\n}';
    const jsUri = await createTestFile(jsContent, ".js");
    const jsPath = path.basename(jsUri.fsPath);

    // Create an HTML file that includes JavaScript
    const htmlContent = `<html>
<body>
  <script>
    // virtualInclude '${jsPath}'
  </script>
</body>
</html>`;
    const editor = await createTestDocument(htmlContent, ".html");

    // Process the include
    await vscode.commands.executeCommand("virtualInclude.process");

    // Wait for processing to complete
    const processed = await waitForVirtualIncludeProcessed(editor);
    assert.strictEqual(processed, true, "Virtual include was not processed");

    // Verify JS was included with JS comment style (not HTML comment style)
    const text = editor.document.getText();
    assert.ok(
      text.includes("// virtualIncludeStart"),
      "JavaScript-style start marker not found",
    );
    assert.ok(
      !text.includes("<!-- virtualIncludeStart"),
      "HTML comment style was incorrectly used",
    );
    assert.ok(
      text.includes("function getUser()"),
      "Included JavaScript content not found",
    );

    // Clean up
    await deleteTestFile(jsUri);
    await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
  });

  test("Section override via explicit configuration", async () => {
    // Back up the original configuration
    const config = vscode.workspace.getConfiguration("virtualInclude");
    const originalOverrides = config.get("languageOverrides");

    try {
      // Set up a configuration override for YAML template sections
      await config.update(
        "languageOverrides",
        [
          {
            fileType: "yaml",
            pattern: "template:\\s*>-",
            commentStyle: "{#",
            commentEnd: "#}",
            continueUntil: "^\\S",
          },
        ],
        vscode.ConfigurationTarget.Global,
      );

      // Create a Lua source file
      const luaContent =
        'local function helper()\n  return "helper called"\nend';
      const luaUri = await createTestFile(luaContent, ".lua");
      const luaPath = path.basename(luaUri.fsPath);

      // Create a YAML file with a template section
      const yamlContent = `apiVersion: v1
kind: ConfigMap
metadata:
  name: test-config
data:
  template: >-
    {# virtualInclude '${luaPath}' #}
    
    local result = helper()`;
      const editor = await createTestDocument(yamlContent, ".yaml");

      // Process the include
      await vscode.commands.executeCommand("virtualInclude.process");

      // Wait for processing to complete
      const processed = await waitForVirtualIncludeProcessed(editor);
      assert.strictEqual(processed, true, "Virtual include was not processed");

      // Verify lua-resty-template style comments were used for markers in the YAML template section
      const text = editor.document.getText();

      // Debug: Log the entire text content
      console.log("DOCUMENT CONTENT:\n" + text);
      console.log(
        "Contains {# virtualIncludeStart:",
        text.includes("{# virtualIncludeStart"),
      );
      console.log(
        "Contains # virtualIncludeStart:",
        text.includes("# virtualIncludeStart"),
      );

      assert.ok(
        text.includes("{# virtualIncludeStart"),
        "lua-resty-template style start marker not found",
      );
      // Check specifically for the YAML marker pattern at the start of a line
      const containsYamlCommentStyle = /^(\s*)#\s*virtualIncludeStart/m.test(
        text,
      );
      assert.strictEqual(
        containsYamlCommentStyle,
        false,
        "YAML comment style was incorrectly used",
      );
      assert.ok(
        text.includes("local function helper()"),
        "Included Lua content not found",
      );

      // Clean up
      await deleteTestFile(luaUri);
      await vscode.commands.executeCommand(
        "workbench.action.closeActiveEditor",
      );
    } finally {
      // Restore original configuration
      await config.update(
        "languageOverrides",
        originalOverrides,
        vscode.ConfigurationTarget.Global,
      );
    }
  });
});
