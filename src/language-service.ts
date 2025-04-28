import * as vscode from "vscode";
import { Constants } from "./constants";

/**
 * The LanguageService class determines the appropriate comment styles and virtual include patterns
 * for different programming languages. It enables the extension to work seamlessly across various
 * languages by adapting to each language's specific syntax requirements.
 *
 * HOW IT WORKS IN DETAIL
 *
 * When processing a document, the extension:
 *
 * - Determines the document's language ID (e.g., "javascript", "python")
 * - Calls LanguageService.getLanguageSettings(languageId)
 * - Gets appropriate comment style (// for JavaScript, # for Python, etc.)
 * - Constructs language-specific regex patterns and markers
 * - Uses these patterns to detect and process virtual includes
 *
 * The LanguageService also checks for user-configured overrides in VSCode settings, allowing users
 * to customize patterns and markers for specific languages. If custom patterns have been registered
 * through the API, those take precedence over default patterns. This service is a key enabler of
 * the extension's extensibility, allowing it to adapt to different languages and custom include
 * directive formats without changing the core codebase.
 */
export class LanguageService {
  // A static mapping of language IDs to their corresponding comment symbols
  private static readonly COMMENT_STYLES: Record<string, CommentStyle> = {
    javascript: { start: "//", end: "" },
    typescript: { start: "//", end: "" },
    python: { start: "#", end: "" },
    ruby: { start: "#", end: "" },
    powershell: { start: "#", end: "" },
    shellscript: { start: "#", end: "" },
    csharp: { start: "//", end: "" },
    java: { start: "//", end: "" },
    c: { start: "//", end: "" },
    cpp: { start: "//", end: "" },
    go: { start: "//", end: "" },
    rust: { start: "//", end: "" },
    php: { start: "//", end: "" },
    perl: { start: "#", end: "" },
    lua: { start: "--", end: "" },
    sql: { start: "--", end: "" },
    yaml: { start: "#", end: "" },
    html: { start: "<!--", end: "-->" },
    xml: { start: "<!--", end: "-->" },
    css: { start: "/*", end: "*/" },
  };

  /**
   * Return comment style for a given language and fallback to the configured default comment style
   * when a language isn't in the map.
   *
   * @param languageId
   * @returns CommentStyle
   */
  public static getCommentStyle(languageId: string): CommentStyle {
    const defaultStyle = Constants.getConfiguration().get(
      "defaultCommentStyle",
      "#",
    );
    return this.COMMENT_STYLES[languageId] || { start: defaultStyle, end: "" };
  }

  /**
   * Retrieves settings for a specific language ID:
   *
   * 1. Combines defaults with user-configured overrides
   * 2. Returns complete language settings with pattern and markers
   *
   * @param languageId
   * @returns LanguageSettings
   */
  /**
   * Regex to extract comment style override from include directive
   * Matches patterns like: virtualInclude 'file.js' with '//'
   */
  public static readonly COMMENT_OVERRIDE_REGEX =
    /virtualInclude\s+["'](.+?)["']\s+with\s+["']([^"']+)["']/;

  /**
   * File extension to language ID mapping
   */
  private static readonly EXTENSION_TO_LANGUAGE: Record<string, string> = {
    ".js": "javascript",
    ".ts": "typescript",
    ".py": "python",
    ".rb": "ruby",
    ".ps1": "powershell",
    ".sh": "shellscript",
    ".cs": "csharp",
    ".java": "java",
    ".c": "c",
    ".cpp": "cpp",
    ".go": "go",
    ".rs": "rust",
    ".php": "php",
    ".pl": "perl",
    ".lua": "lua",
    ".sql": "sql",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".html": "html",
    ".xml": "xml",
    ".css": "css",
  };

  /**
   * Get language ID from file extension
   *
   * @param filePath
   * @returns string|null
   */
  public static getLanguageFromExtension(filePath: string): string | null {
    const config = Constants.getConfiguration();
    const detectFromExtension = config.get<boolean>(
      Constants.CONFIG_DETECT_FROM_EXTENSION,
      true,
    );

    if (!detectFromExtension) {
      return null;
    }

    const lastDotIndex = filePath.lastIndexOf(".");
    if (lastDotIndex === -1) {
      return null;
    }

    const extension = filePath.substring(lastDotIndex).toLowerCase();
    return this.EXTENSION_TO_LANGUAGE[extension] || null;
  }

  /**
   * Extracts comment style override from include directive
   *
   * @param line
   * @returns string|null
   */
  public static getCommentStyleOverride(line: string): string | null {
    const match = line.match(this.COMMENT_OVERRIDE_REGEX);
    return match ? match[2] : null;
  }

  /**
   * Checks if a line is within a language override section based on config
   *
   * @param document
   * @param lineNumber
   * @returns {commentStyle: string} | null
   */
  /**
   * Built-in section overrides for common cases
   */
  private static readonly BUILT_IN_SECTION_OVERRIDES: Array<{
    fileType: string;
    pattern: string;
    commentStyle: string;
    continueUntil: string;
  }> = [
    {
      // JavaScript inside HTML script tags
      fileType: "html",
      pattern: "<script[^>]*>\\s*",
      commentStyle: "//",
      continueUntil: "</script>",
    },
    {
      // Lua inside YAML template sections
      fileType: "yaml",
      pattern: "template:\\s*>-",
      commentStyle: "--",
      continueUntil: "^\\S",
    },
  ];

  public static getSectionOverride(
    document: vscode.TextDocument,
    lineNumber: number,
  ): { commentStyle: string } | null {
    const config = Constants.getConfiguration();
    const userOverrides = config.get<
      Array<{
        fileType: string;
        pattern: string;
        commentStyle: string;
        continueUntil: string;
      }>
    >(Constants.CONFIG_LANGUAGE_OVERRIDES, []);

    // Combine built-in and user-defined overrides
    const overrides = [...this.BUILT_IN_SECTION_OVERRIDES, ...userOverrides];

    if (overrides.length === 0) {
      return null;
    }

    // Only check overrides for this file type
    const relevantOverrides = overrides.filter(
      (o) => o.fileType === document.languageId,
    );
    if (relevantOverrides.length === 0) {
      return null;
    }

    // Look backwards from the current line to find any section start
    for (let i = lineNumber; i >= 0; i--) {
      const line = document.lineAt(i).text;

      for (const override of relevantOverrides) {
        const sectionStartRegex = new RegExp(override.pattern);
        if (sectionStartRegex.test(line)) {
          // Check if we're still in this section
          const continueUntilRegex = new RegExp(override.continueUntil);
          for (let j = i + 1; j <= lineNumber; j++) {
            const checkLine = document.lineAt(j).text;
            if (continueUntilRegex.test(checkLine)) {
              // We've exited the section
              return null;
            }
          }

          // We're in the section
          return { commentStyle: override.commentStyle };
        }
      }
    }

    return null;
  }

  /**
   * Gets the appropriate LanguageSettings for a specific context,
   * taking into account file extension detection, comment style overrides,
   * and section-based overrides.
   *
   * @param context Object containing context information
   * @returns LanguageSettings
   */
  public static getContextAwareSettings(context: {
    document: vscode.TextDocument;
    lineNumber: number;
    line: string;
    includedFilePath?: string;
  }): LanguageSettings {
    // First check for explicit 'with' comment style override in the directive
    const commentStyleOverride = this.getCommentStyleOverride(context.line);
    if (commentStyleOverride) {
      const overrideCommentStyle = { start: commentStyleOverride, end: "" };
      return this.createDefaultSettings(overrideCommentStyle);
    }

    // Then check for section override based on configuration
    const sectionOverride = this.getSectionOverride(
      context.document,
      context.lineNumber,
    );
    if (sectionOverride) {
      const overrideCommentStyle = {
        start: sectionOverride.commentStyle,
        end: "",
      };
      return this.createDefaultSettings(overrideCommentStyle);
    }

    // Then try to detect language from included file extension
    if (context.includedFilePath) {
      const detectedLanguage = this.getLanguageFromExtension(
        context.includedFilePath,
      );
      if (detectedLanguage) {
        return this.getLanguageSettings(detectedLanguage);
      }
    }

    // Fall back to document's language
    return this.getLanguageSettings(context.document.languageId);
  }

  /**
   * Retrieves settings for a specific language ID:
   *
   * 1. Combines defaults with user-configured overrides
   * 2. Returns complete language settings with pattern and markers
   *
   * @param languageId
   * @returns LanguageSettings
   */
  public static getLanguageSettings(languageId: string): LanguageSettings {
    const config = Constants.getConfiguration();
    const allLanguageSettings = config.get<Record<string, LanguageSettings>>(
      "languageSettings",
      {},
    );
    const commentStyle = this.getCommentStyle(languageId);

    // Get language-specific settings or empty object
    const langSettings = allLanguageSettings[languageId] || {};

    // Create default settings based on the comment style
    const defaultSettings = this.createDefaultSettings(commentStyle);

    // Merge with any language-specific overrides
    return {
      ...defaultSettings,
      ...langSettings,
    };
  }

  /**
   * Generates default settings based on comment style.
   *
   * @param commentStyle
   * @returns LanguageSettings
   */
  private static createDefaultSettings(
    commentStyle: CommentStyle,
  ): LanguageSettings {
    const startComment = this.escapeRegExp(commentStyle.start);
    return {
      includeDirectivePattern: `${startComment}\\s*virtualInclude\\s+["'](.+?)["']`,
      startMarkerTemplate: `${commentStyle.start} virtualIncludeStart - DO NOT EDIT CONTENT BELOW ${commentStyle.end}`,
      endMarkerTemplate: `${commentStyle.start} virtualIncludeEnd - DO NOT EDIT CONTENT ABOVE ${commentStyle.end}`,
    };
  }

  /**
   * Escapes special characters in comment styles for use in regex patterns.
   *
   * @param string
   * @returns string
   */
  private static escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}

/**
 * This interface defines the structure for comment styles with start and end markers
 */
export interface CommentStyle {
  start: string;
  end: string;
}

/**
 * This interface defines the structure of language-specific settings, including the pattern
 * for detecting include directives and templates for start/end markers.
 */
export interface LanguageSettings {
  includeDirectivePattern: string;
  startMarkerTemplate: string;
  endMarkerTemplate: string;
}
