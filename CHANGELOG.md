# Changelog

## Unreleased

- Documented how sidebar requests use bounded context from the centre DSH session
  and how the session binding behaves after switching conversations.

## 0.1.3

Released 2026-11-18.

- Fixed text selection and caret placement in ProseMirror documents when
  `dsh-web-all` decorates the editable DOM.
- Kept code blocks stable when host plugins add responsive attributes.
- Restored native click, double-click, drag, wrapped-line, and cross-block
  selections.
- Fixed duplicate insertion when pasting.
- Improved selection synchronization without stealing editor focus.
- Added exact caret and editor regression coverage, including real Microsoft
  Pinyin composition input.
- Reduced the npm package to runtime files and added a repeatable CI test job.

## 0.1.2

- Registered the client module under the npm package name.

## 0.1.1

- Added npm publishing metadata.

## 0.1.0

- Initial public release.
