# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2025-04-28

### Fixed

- Fixed infinite processing loop caused by nested includes
- Added protection mechanism to neutralize include directives inside included
  content
- Updated documentation to explain how nested includes behave

### Added

- Added Prettier configuration and applied format to all files
- Added cross-language include support for including content in different
  languages

## [1.0.1] - 2025-04-25

### Added

- Support for Lua
