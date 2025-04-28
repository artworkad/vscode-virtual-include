# Virtual Include Extension for VS Code

Include content from other files with automatic updates and edit protection.

[![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)](https://marketplace.visualstudio.com/items?itemName=artworkad.vscode-virtual-include)
[![VSCode](https://img.shields.io/badge/VS%20Code-%5E1.98.0-brightgreen.svg)](https://code.visualstudio.com/)
![Tests](https://github.com/artworkad/vscode-virtual-include/actions/workflows/publish.yml/badge.svg)

## Overview

Virtual Include is a powerful VS Code extension that allows you to include content from other files directly in your code. Unlike traditional includes which require preprocessing, Virtual Include works with any language and automatically updates content when source files change.

## Features

- ✅ **Language Agnostic**: Works with JavaScript, TypeScript, Python, Ruby, C#, Java, HTML, CSS, and more
- ✅ **Live Updates**: Content automatically updates when source files change
- ✅ **Protected Content**: Included content is protected from accidental edits
- ✅ **Visual Feedback**: Error indicators for missing files and status bar integration
- ✅ **Multiple Languages**: Adapts to each language's comment style

## Installation

1. Open VS Code
2. Press `Ctrl+P` (or `Cmd+P` on Mac)
3. Type `ext install artworkad.vscode-virtual-include`
4. Press Enter

## How to Use

### Basic Usage

1. Add a virtual include directive in your code using your language's comment style
2. Reference the file you want to include
3. Save the document

The extension will automatically process the include directive and insert the content from the referenced file. The included content is protected from edits - if you want to change it, edit the source file instead!

### Include Directive Format

The include directive follows this format:

```
[comment style] virtualInclude '[path]'
```

Where:

- `[comment style]` is the comment syntax for your language
- `[path]` is the path to the file you want to include (relative to the current file or absolute)

### Examples

**JavaScript/TypeScript**:

```javascript
// virtualInclude 'utils/helper.js'
```

**Python**:

```python
# virtualInclude 'models/user.py'
```

**HTML**:

```html
<!-- virtualInclude 'components/header.html' -->
```

**CSS**:

```css
/* virtualInclude 'styles/variables.css' */
```

**C/C++/Java/C#**:

```c
// virtualInclude 'common/math.h'
```

**Ruby**:

```ruby
# virtualInclude 'lib/utilities.rb'
```

### After Processing

When you save the file, the extension will process the include directive and insert the content from the referenced file. The included content will be wrapped between start and end markers:

```javascript
// virtualInclude 'utils/helper.js'
// virtualIncludeStart - DO NOT EDIT CONTENT BELOW
function helperFunction() {
  return "Hello, world!";
}
// virtualIncludeEnd - DO NOT EDIT CONTENT ABOVE
```

## Indentation

The extension automatically preserves the indentation from the include directive line, so included content will match your code style:

```javascript
function example() {
  // virtualInclude 'utils/helper.js'
  // virtualIncludeStart - DO NOT EDIT CONTENT BELOW
  function helperFunction() {
    return "Hello, world!";
  }
  // virtualIncludeEnd - DO NOT EDIT CONTENT ABOVE
}
```

## Error Handling

If a referenced file cannot be found, the extension will show an error indicator (red squiggly line) under the include directive. Hovering over it will show the specific error message.

## User Interface

### Status Bar

The extension adds a status bar item that shows the current state:

- 📎 Virtual Include: Normal state
- 🔄 Processing Includes: When the extension is processing includes
- ⚠️ Virtual Include (X issues): When there are problems with includes

You can click the status bar item to manually trigger include processing.

### Notifications

When a source file changes, the extension will show a notification with options to:

- Show affected files
- Save all affected files

## Settings

You can customize the extension's behavior through VS Code settings:

```json
"virtualInclude": {
  "defaultCommentStyle": "#",
  "languageSettings": {
    "javascript": {
      "includeDirectivePattern": "\/\/\\s*virtualInclude\\s+[\"'](.+?)[\"']",
      "startMarkerTemplate": "// virtualIncludeStart - DO NOT EDIT CONTENT BELOW",
      "endMarkerTemplate": "// virtualIncludeEnd - DO NOT EDIT CONTENT ABOVE"
    }
  }
}
```

### Available Settings

- `virtualInclude.defaultCommentStyle`: Default comment style for languages without specific settings (defaults to `#`)
- `virtualInclude.languageSettings`: Override settings for specific languages with custom patterns and markers

## Advanced Usage

### Nested Includes

The extension handles nested includes in a special way to prevent infinite inclusion loops:

- When a file (A) includes another file (B) that itself contains include directives
- The include directives from file B are neutralized when inserted into file A
- These nested include directives are transformed to a non-processing format:

  ```
  // virtualInclude 'file.js'  →  // virtualInclude-nested (edit source file to modify) 'file.js'
  ```

**Why this happens**: This prevents an infinite cycle of inclusions that would cause the editor to freeze or crash. Without this protection, include directives in included content would be processed again and again with each save.

**How to work with nested includes**: If you need to modify the content from a nested include, you should:

1. Open and edit the source file directly
2. Save the source file - all files including it will be automatically updated

### Custom Include Patterns

You can customize the include directive pattern, start marker, and end marker for each language using the settings:

```json
"virtualInclude.languageSettings": {
  "python": {
    "includeDirectivePattern": "#\\s*import\\s+[\"'](.+?)[\"']",
    "startMarkerTemplate": "# BEGIN IMPORT - DO NOT EDIT",
    "endMarkerTemplate": "# END IMPORT - DO NOT EDIT"
  }
}
```

With these settings, Python includes would look like:

```python
# import 'models/user.py'
# BEGIN IMPORT - DO NOT EDIT
class User:
    def __init__(self, name):
        self.name = name
# END IMPORT - DO NOT EDIT
```

## Use Cases

### Configuration Files

Include common configuration settings across multiple files:

```javascript
// config.js
// virtualInclude 'common-config.js'
```

### Code Snippets

Include common code snippets:

```python
# api.py
# virtualInclude 'error-handling.py'
```

### Documentation

Include documentation sections:

```markdown
<!-- README.md -->
<!-- virtualInclude 'installation.md' -->
```

### Templates

Include common HTML templates:

```html
<!-- index.html -->
<!-- virtualInclude 'header.html' -->
```

## Commands

The extension contributes the following commands:

- **Process Virtual Includes**: Manually process all virtual includes in the current file

You can access this command from:

- Right-click context menu in the editor
- Command palette (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac)
- Clicking the Virtual Include status bar item

## Troubleshooting

### Issue: Include is not updating when source file changes

**Solution**: Make sure file watchers are enabled in your environment. Some network drives may not support file watching.

### Issue: Content is not being included correctly

**Solution**: Check that the path is correct and relative to the current file, not the workspace root.

### Issue: Start/end markers are missing

**Solution**: Try manually saving the file to trigger include processing, or use the "Process Virtual Includes" command from the context menu.

## Requirements

- VS Code ^1.98.0

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Publisher

Published by [artworkad](https://marketplace.visualstudio.com/publishers/artworkad)
