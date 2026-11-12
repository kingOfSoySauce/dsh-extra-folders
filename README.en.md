# dsh-extra-folders

Attach extra writable folders to one workspace. Once the plugin is installed, the sidebar workspace row gets an extra "Add folder" item in its menu. Any folder you pick there is writable for that workspace's sessions. Both the file tools and the shell honor the grant, so writing there does not need a separate approval each time.

| Workspace menu | Dialog |
| --- | --- |
| ![Add folder in the workspace menu](assets/menu.png) | ![Add folder dialog](assets/dialog.png) |

## Install

Requires DSH 0.2.2-alpha.3 or later.

### Option 1: Add from the Plugins page

Open **Settings → Plugins → Add plugin** and paste this line:

```text
github:kingOfSoySauce/dsh-extra-folders
```

After it installs, make sure the plugin row is on.

### Option 2: Command line

```sh
dsh plugin --profile desktop add github:kingOfSoySauce/dsh-extra-folders
```

### Option 3: Ask an agent to install it

<details>
<summary><strong>Click to expand the prompt</strong></summary>

```text
Please install dsh-extra-folders into the current profile:
https://github.com/kingOfSoySauce/dsh-extra-folders

First, confirm three things in read-only mode: whether the host is Desktop or Web, the current profile name, and whether the dsh version is >= 0.2.2-alpha.3.
If the version is too low, tell me and do not try to install.

On Desktop, prefer Plugins → Add plugin and paste
github:kingOfSoySauce/dsh-extra-folders
If the current host provides plugin management tools, you can also run
dsh plugin --profile <profile> add github:kingOfSoySauce/dsh-extra-folders.

After install, check that the plugin row is enabled. If a restart is needed, tell me and I will restart it myself.
Do not edit the profile's package.json by hand, and do not touch other plugins.
When it is installed, take me to the more menu of a sidebar workspace row and confirm that it contains "Add folder".
```

</details>

## Usage

Sidebar workspace row → the more button at the end of the row → **Add folder**.

The first row in the dialog is the workspace itself. It is always writable and cannot be removed. The rows below are the folders you added. You can remove each one on its own. Adding and removing take effect right away. No refresh, and no need to wait for the next session.

The grant follows the workspace. Subagents are covered too. Sessions in other workspaces do not see these folders.

## How it compares to similar plugins

| | This plugin | multi-root-workspace | union-workspace |
| --- | --- | --- | --- |
| Registers model tools | No | No | Yes, 5 |
| Changes upstream components | Only wraps `sandboxPolicy.resolve()` | Disables the `fs-sandbox` and `sandbox` rows, replaces both implementations | No replacement. Adds separate tools to bypass it |
| Runtime dependencies | None | `koffi`, `zod` | None |
| Per-folder read-only or read-write levels | No | Yes | No |
| Sidebar management panel | No | Yes | Yes |
| Minimum DSH version | 0.2.2-alpha.3 | 0.1.5-rc.2 | 0.1.7-rc.2 (from peer deps) |
| bash can write to attached folders on macOS | Yes | Yes | No (needs the danger-full-access preset) |

This plugin does one thing: it adds the attached folders to the session's writable scope. It registers no tools, replaces no implementation, and adds no dependencies. Turn it off and the host behaves like stock DSH again.

The closest neighbour is jkm6221/dsh-workspace-folders. It uses the same mechanism (wraps `resolve()`, merges `additionalWritableRoots`) but registers a `workspace_folders` model tool and requires DSH 0.2.1-rc.1 or later.

If you need per-folder permission levels or a sidebar panel, use multi-root-workspace.

## Compatibility

| Environment | Status |
| --- | --- |
| macOS desktop 0.2.2-rc.1 | Verified |
| DSH 0.2.2-alpha.3 and later | Supported |
| DSH 0.2.1 and earlier | Not supported. The kernel has no `additionalWritableRoots` and no workspace menu service |
| Web (`dsh web`) | Same code as desktop. The folder picker is replaced by in-app browsing. Not tested |
| Windows | Applies to the file tools only. The sandboxed shell is not affected. This limit comes from DSH. Not tested |

The kernel is checked when the host starts. If the kernel is not supported, the plugin writes one clear log line and stops. You are not left with a menu item that does nothing.

## Update and uninstall

To update, pull the latest code, then turn the plugin row off and on again in Plugins.

```sh
cd /absolute/path/dsh-extra-folders && git pull
```

To uninstall:

```sh
dsh plugin --profile desktop remove dsh-extra-folders
```

You can also remove it directly in Plugins.

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| No "Add folder" in the menu | Check that the plugin row is on and refresh the page once. dsh below 0.2.2-alpha.3 does not have this item |
| I added a folder but it still asks for approval | Check whether the session permission is `read-only`. Attached folders do not apply in that mode |
| An old session still asks for approval, or asks first whether to request it | Start a new session. The approval habit from earlier turns carries over. A new grant does not rewrite the pattern already set in that conversation |
| I picked a folder but it was not added | The plugin only accepts real directories. A symlink is rejected, so pick the path it points to |
| bash cannot write on Windows | DSH only grants attached folders to the file tools. This is a DSH limit and the plugin cannot change it |
| On Web, the dialog opens but there is no system picker | On Web, in-app browsing replaces the system dialog |

## License

MIT
