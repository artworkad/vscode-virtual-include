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
