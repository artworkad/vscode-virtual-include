/**
 * The constants module serves as a central repository for all constant values and configuration settings
 * used throughout the extension. It centralizes all static values and configuration options in one place.
 * This makes it easier to maintain consistent values across the codebase and provides a single point of change
 * for configurable elements.
 *
 * HOW IT WORKS IN DETAIL
 *
 * The Constants class uses static properties and methods to provide access to constant values throughout the extension.
 * When configuration values are needed, it:
 *
 * - Accesses the appropriate VSCode configuration section
 * - Retrieves the user-configured value if available
 * - Falls back to default values if not configured
 *
 * This approach allows users to customize certain aspects of the extension (like marker syntax) while maintaining
 * reasonable defaults. It also makes the codebase more maintainable by centralizing all configuration logic.
 * By isolating constant values in a dedicated module, the extension achieves better separation of concerns, making it
 * easier to modify values without having to change multiple files. It also helps avoid "magic strings" scattered
 * throughout the codebase. This module is essential for maintaining consistency and enabling configurability
 * within the extension.
 */
export class Constants {
  // Regular expression to match virtual include comments
  public static readonly VIRTUAL_INCLUDE_REGEX =
    /^\s*# virtualInclude\s+["'](.+?)["']\s*$/;

  // Markers used to indicate the beginning and end of included content
  public static readonly PROTECTED_SECTION_START =
    "# virtualIncludeStart - DO NOT EDIT CONTENT BELOW";
  public static readonly PROTECTED_SECTION_END =
    "# virtualIncludeEnd - DO NOT EDIT CONTENT ABOVE";

  // Configuration keys
  public static readonly CONFIG_SECTION = "virtualInclude";
  public static readonly CONFIG_AUTO_PROCESS = "autoProcess";
  public static readonly CONFIG_START_MARKER = "startMarker";
  public static readonly CONFIG_END_MARKER = "endMarker";
  public static readonly CONFIG_LANGUAGE_OVERRIDES = "languageOverrides";
  public static readonly CONFIG_DETECT_FROM_EXTENSION = "detectFromExtension";

  /**
   * Retrieves the configured start marker or uses default
   *
   * @returns string
   */
  public static getStartMarker(): string {
    const config = Constants.getConfiguration();
    return config.get<string>(
      Constants.CONFIG_START_MARKER,
      Constants.PROTECTED_SECTION_START,
    );
  }

  /**
   * Retrieves the configured end marker or uses default.
   *
   * @returns string
   */
  public static getEndMarker(): string {
    const config = Constants.getConfiguration();
    return config.get<string>(
      Constants.CONFIG_END_MARKER,
      Constants.PROTECTED_SECTION_END,
    );
  }

  /**
   * Checks if automatic processing is enabled.
   *
   * @returns bool
   */
  public static isAutoProcessEnabled(): boolean {
    const config = Constants.getConfiguration();
    return config.get<boolean>(Constants.CONFIG_AUTO_PROCESS, true);
  }

  /**
   * Helper to access the VSCode configuration.
   *
   * @returns WorkspaceConfiguration
   */
  public static getConfiguration() {
    return vscode.workspace.getConfiguration(Constants.CONFIG_SECTION);
  }
}

import * as vscode from "vscode";
