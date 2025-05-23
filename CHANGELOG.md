# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2025-04-30

### Fixed

- Fixed bug where the last include in YAML multi-line blocks (>-) would
  disappear when editing included files, resolving "Illegal value for `line`"
  errors

## [1.0.4] - 2025-04-30

### Fixed

- Fixed cross-language includes for lua-resty-template in YAML template sections
- Updated section-based overrides to properly support paired comment styles with
  different start and end markers
- Enhanced schema definition in package.json to include commentEnd property for
  language overrides
- Updated documentation to clearly distinguish between Lua and
  lua-resty-template comment styles

## [1.0.3] - 2025-04-28

### Fixed

- Fixed infinite processing loop caused by nested includes
- Added protection mechanism to neutralize include directives inside included
  content
- Updated documentation to explain how nested includes behave

### Added

- Added Prettier configuration and applied format to all files
- Added cross-language include support for including content in different
  languages
- Added Code lens above include directives to quickly open source files

## [1.0.1] - 2025-04-25

### Added

- Support for Lua
