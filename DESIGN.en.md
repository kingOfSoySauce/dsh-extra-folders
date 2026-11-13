# Design notes

This document covers how the plugin works and where it stops. Install and daily use are in [README.en.md](README.en.md).

## Grants

- The workspace itself is always writable. Added folders are merged into the writable-roots list, so writing there no longer asks for approval each time. Both the file tools and the sandbox read that one list.
- On macOS, the file tools and `bash` can both write. On Windows, the sandboxed shell ignores attached folders; that limit is DSH's.
- The list is stored per workspace. Other workspaces cannot see it; subagents follow their workspace.
- Grants are appended. Writable roots you configured in DSH are left alone.
- `read-only` sessions are unchanged. The plugin does not bypass that mode.
- Folders that no longer exist are dropped from the list. The dialog marks them, and the sandbox policy still resolves.
- Only physical paths are accepted. Symlinks and paths that go through one are rejected, so a grant cannot silently point elsewhere. The same folder is not added twice.

## Model side

- No new tools. The model's tool list matches a stock install.
- No new prompt text. The plugin writes no system prompt and inserts nothing into the conversation. It adds no progress notes either.
- DSH already renders an "additional writable directories" note. Adding or removing a folder updates that note at the tail of the session history; earlier prefixes stay unchanged and the prefix cache keeps hitting.
- Adding and removing happen only from the UI. The model has no entry point to widen its own access.

## UI

- The entry sits in the workspace row's more menu. No separate sidebar panel.
- The dialog and buttons are the host's `Modal` and `Button`. Colors and fonts follow the host, and appearance plugins apply.
- Copy follows the UI language. The host returns error codes only; sentences are translated on the client, so text cannot arrive in the wrong language.
- Changes take effect immediately. No page refresh, no new session.
- An error boundary wraps the dialog. If it fails, the rest of the UI stays up.
- When the host lacks the official components, the dialog falls back to a built-in panel.

## State

- The file is `$DSH_HOME/extra-folders.json`, keyed by canonical workspace path.
- Writes go to a temporary file first and are then renamed, so a crash cannot leave half a file.
- The legacy `workspace-extra-folders.json` is read when the current file is missing.
- Entries are filtered by existence when the grant is resolved, so deleted folders never reach the writable-root list.

## Failures

- At startup the host checks whether the sandbox policy has `additionalWritableRoots`. If not, it writes an error log and stops.
- The UI only ever shows translated sentences, never a raw English error.
- Grants are changed through an internal route guarded by the same authentication as `/api`; other local processes cannot call it.
- Whether the client half also stops after the host backs out has not been tested.

## Boundaries

- No per-folder read-only or read-write levels. A folder is writable or it is not.
- No sidebar management panel.
- DSH 0.2.1 and earlier are not supported: the kernel has no additional writable roots and no workspace menu.
- The Web folder picker has not been tested.
- On Windows only the file tools are affected.
- Older sessions can keep their existing approval habits; a new session is the clean state.

## Verification

| Item | Status |
| --- | --- |
| macOS desktop 0.2.2-rc.1 | Verified |
| Web | Not tested |
| Windows | Not tested |
| Unsupported kernel | Log exists; UI behavior not tested |
| Multiple folders | Code review only |
| Deleted folder | Code review only |
| Symlink rejection | Code review only |
