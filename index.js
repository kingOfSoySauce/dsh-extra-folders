/**
 * Workspace extra folders — Host half.
 *
 * Attach additional writable directories to ONE workspace. The list is durable
 * per canonical workspace path, is managed only from the Web UI (the model has
 * no write path), and is granted per capability call by wrapping
 * `ctx.sandboxPolicy.resolve()`: the resolved policy carries the calling
 * Session's workspace folders in `additionalWritableRoots`, which the shared
 * `writableRoots()` derivation in `@deepseek-ai/dsh-sandbox` turns into the
 * allow-list used by BOTH the filesystem fence and the Seatbelt/bwrap/Landlock
 * profiles. Sessions in other workspaces never see them.
 *
 * The UI talks to this half over a loopback route fenced by
 * `ctx.connection.requestRejection()`, the same authenticated-peer check the
 * `/api` routes use: a local process without a live browser Peer is refused.
 *
 * Failures travel back as stable CODES, never as English sentences: the Client
 * half owns every user-visible sentence, so one workspace's error text cannot
 * arrive in the wrong language.
 *
 * The plugin contributes NO prompt text of its own. DSH's sandbox-policy note
 * already renders `Additional writable directories: [...]` from the resolved
 * policy, so a second note would only duplicate tokens. The policy note is
 * projected as a tail entry of the session history and de-duplicated while the
 * list holds, so adding or removing a folder changes the tail only. It never
 * rewrites the system prompt or an earlier prefix, which keeps the provider's
 * prefix cache intact.
 *
 * @module dsh-extra-folders
 */

import { readFileSync, realpathSync, statSync } from 'node:fs'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve as resolvePath } from 'node:path'

/** Cordis plugin name. */
export const name = 'workspace-extra-folders'

/** Loopback JSON route the Client half calls. */
const ROUTE = '/extra-folders'
/** Durable state format. */
const STATE_VERSION = 1
/** Bound on a request body; the route only carries two paths. */
const MAX_BODY_BYTES = 64 * 1024

/** The Harness home that owns plugin state. */
function dshHome() {
  const configured = process.env.DSH_HOME
  return typeof configured === 'string' && configured !== '' ? configured : join(homedir(), '.dsh')
}

/** An error carrying a code the Client half translates. */
function fail(code) {
  const error = new Error(code)
  error.code = code
  return error
}

/** Canonical identity of a path, tolerant of a path that disappeared. */
function canonical(path) {
  try {
    return realpathSync(path)
  } catch {
    return resolvePath(path)
  }
}

/** Whether a path is an existing directory. */
function isDirectory(target) {
  try {
    return statSync(target).isDirectory()
  } catch {
    return false
  }
}

/**
 * Validate a directory grant the way the sandbox will: it must exist, be a
 * directory, and be spelled as its own physical path. `additionalRoot()` in the
 * sandbox rejects symlinked grants, so accepting one here would only fail later,
 * on every confined call.
 * @param target - candidate directory from the folder picker.
 * @returns the physical path to store.
 */
function physicalDirectory(target) {
  let stats
  try {
    stats = statSync(target)
  } catch {
    throw fail('missing')
  }
  if (!stats.isDirectory()) throw fail('notDirectory')
  const physical = realpathSync(target)
  if (physical !== resolvePath(target)) throw fail('symlink')
  return physical
}

/**
 * The durable per-workspace folder lists plus their write path.
 * @param ctx - plugin context, used for diagnostics only.
 */
function createStore(ctx) {
  const file = join(dshHome(), 'extra-folders.json')
  let workspaces = read()

  function read() {
    /** The pre-rename state file, read when the current one does not exist. */
    const legacyFile = join(dshHome(), 'workspace-extra-folders.json')
    for (const candidate of [file, legacyFile]) {
      try {
        const parsed = JSON.parse(readFileSync(candidate, 'utf8'))
        const source = parsed?.version === STATE_VERSION && typeof parsed?.workspaces === 'object' && parsed.workspaces !== null
          ? parsed.workspaces
          : {}
        const result = {}
        for (const [workspace, list] of Object.entries(source)) {
          if (workspace === '' || !Array.isArray(list)) continue
          const folders = [...new Set(list.filter((entry) => typeof entry === 'string' && entry !== ''))]
          if (folders.length > 0) result[workspace] = folders
        }
        return result
      } catch (error) {
        if (error?.code !== 'ENOENT') ctx.logger?.warn?.(`dsh-extra-folders: cannot read ${candidate}: ${String(error)}`)
      }
    }
    return {}
  }

  async function persist() {
    await mkdir(dirname(file), { recursive: true })
    const temporary = `${file}.${process.pid}.tmp`
    await writeFile(temporary, `${JSON.stringify({ version: STATE_VERSION, workspaces }, null, 2)}\n`, 'utf8')
    await rename(temporary, file)
  }

  const foldersFor = (workspace) => (Array.isArray(workspaces[workspace]) ? [...workspaces[workspace]] : [])

  return {
    list: foldersFor,
    existing: (workspace) => foldersFor(workspace).filter(isDirectory),
    missing: (workspace) => foldersFor(workspace).filter((folder) => !isDirectory(folder)),
    async add(workspace, target) {
      const physical = physicalDirectory(target)
      if (physical === workspace) throw fail('self')
      const current = foldersFor(workspace)
      if (current.includes(physical)) throw fail('duplicate')
      workspaces = { ...workspaces, [workspace]: [...current, physical] }
      await persist()
      return physical
    },
    async remove(workspace, target) {
      const absolute = canonical(target)
      const current = foldersFor(workspace)
      const index = current.indexOf(absolute) !== -1 ? current.indexOf(absolute) : current.indexOf(target)
      if (index === -1) throw fail('unknown')
      const next = current.filter((_, position) => position !== index)
      const updated = { ...workspaces }
      if (next.length === 0) delete updated[workspace]
      else updated[workspace] = next
      workspaces = updated
      await persist()
      return absolute
    },
    count: () => Object.keys(workspaces).length,
    stateFile: file
  }
}

/** One workspace's attached folders, plus the ones whose directory vanished. */
function summarize(store, workspace) {
  return { workspace, folders: store.list(workspace), missing: store.missing(workspace) }
}

/**
 * Extend the shared sandbox policy per call. Every enforcing family (filesystem
 * fence, one-shot bash, terminal) resolves its policy through this one service,
 * so this wrapper is the whole grant: folders are merged into
 * `additionalWritableRoots` only for a Session whose immutable cwd is that
 * workspace, and only while the folders still exist on disk.
 * @param policy - the mounted `sandboxPolicy` service.
 * @param existing - folders that currently exist for one canonical workspace.
 * @returns a disposer restoring the original method.
 */
function installGrant(policy, existing) {
  if (policy === null || typeof policy !== 'object' || typeof policy.resolve !== 'function') return () => {}
  const original = policy.resolve
  const ownDescriptor = Object.getOwnPropertyDescriptor(policy, 'resolve')
  const resolveWithFolders = function resolveWithWorkspaceFolders(request = {}) {
    const resolved = original.call(this, request)
    const cwd = request?.session?.header?.cwd
    if (typeof cwd !== 'string' || cwd === '') return resolved
    const folders = existing(canonical(cwd))
    if (folders.length === 0) return resolved
    const configured = resolved.additionalWritableRoots ?? []
    const extras = folders.filter((folder) => !configured.includes(folder))
    if (extras.length === 0) return resolved
    return { ...resolved, additionalWritableRoots: Object.freeze([...configured, ...extras]) }
  }
  policy.resolve = resolveWithFolders
  return () => {
    if (policy.resolve !== resolveWithFolders) return
    if (ownDescriptor !== undefined) Object.defineProperty(policy, 'resolve', ownDescriptor)
    else delete policy.resolve
  }
}

/** Whether a path is a workspace the sidebar lists (tolerant of a missing registry). */
function isRegisteredWorkspace(ctx, workspace) {
  const registry = ctx.get('workspaceRegistry')
  if (registry === undefined || typeof registry.list !== 'function') return true
  try {
    const wanted = canonical(workspace)
    return registry.list().some((entry) => canonical(entry.path) === wanted)
  } catch {
    return true
  }
}

/** Read one bounded JSON body. */
function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    request.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(fail('tooLarge'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim()
      if (text === '') {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(text))
      } catch {
        reject(fail('badBody'))
      }
    })
    request.on('error', reject)
  })
}

/** Write one JSON response. */
function sendJson(response, status, value) {
  const body = JSON.stringify(value)
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store'
  })
  response.end(body)
}

/**
 * Register every Host contribution.
 * @param ctx - Host plugin context.
 */
export function apply(ctx) {
  const store = createStore(ctx)

  // 0.2.2-alpha.2 added `additionalWritableRoots`; earlier lines cannot honor an extra
  // root at all. Say so instead of installing a menu that grants nothing.
  const policy = ctx.get('sandboxPolicy')
  if (policy !== undefined && !('additionalWritableRoots' in policy)) {
    ctx.logger?.error?.(
      'dsh-extra-folders: this DSH build has no additionalWritableRoots on its sandbox policy, '
      + 'so extra folders cannot be granted. Requires DSH >= 0.2.2-alpha.3.'
    )
    return
  }

  ctx.inject(['sandboxPolicy'], (scope) => {
    scope.effect(() => installGrant(scope.sandboxPolicy, (workspace) => store.existing(workspace)), 'dsh-extra-folders: sandbox grant')
  })

  ctx.inject(['webServer'], (scope) => {
    scope.effect(() => scope.webServer.register({
      kind: 'prefix',
      path: ROUTE,
      handler: (request, response) => {
        void (async () => {
          const connection = ctx.get('connection')
          if (connection !== undefined && typeof connection.admit === 'function') {
            const admission = connection.admit(request)
            if (admission !== null && typeof admission === 'object' && 'rejection' in admission) {
              response.writeHead(admission.rejection)
              response.end(admission.rejection === 401 ? 'unauthorized' : 'forbidden')
              return
            }
          }
          if (request.method !== 'POST') {
            sendJson(response, 405, { error: 'unknown' })
            return
          }
          let payload
          try {
            payload = await readJsonBody(request)
          } catch (error) {
            sendJson(response, 400, { error: error?.code ?? 'unknown' })
            return
          }
          const endpoint = new URL(request.url ?? '/', 'http://127.0.0.1').pathname.slice(ROUTE.length + 1)
          const workspaceInput = typeof payload?.workspace === 'string' ? payload.workspace : ''
          if (workspaceInput === '' || !isAbsolute(workspaceInput)) {
            sendJson(response, 400, { error: 'notWorkspace' })
            return
          }
          const workspace = canonical(workspaceInput)
          if (!isDirectory(workspace) || !isRegisteredWorkspace(ctx, workspace)) {
            sendJson(response, 409, { error: 'notWorkspace' })
            return
          }
          try {
            if (endpoint === 'list') {
              sendJson(response, 200, summarize(store, workspace))
              return
            }
            if (endpoint !== 'add' && endpoint !== 'remove') {
              sendJson(response, 404, { error: 'unknown' })
              return
            }
            const target = typeof payload?.path === 'string' ? payload.path.trim() : ''
            if (target === '') {
              sendJson(response, 400, { error: 'missing' })
              return
            }
            if (endpoint === 'add') {
              const added = await store.add(workspace, target)
              sendJson(response, 200, { ...summarize(store, workspace), added })
              return
            }
            const removed = await store.remove(workspace, target)
            sendJson(response, 200, { ...summarize(store, workspace), removed })
          } catch (error) {
            sendJson(response, 400, { error: error?.code ?? 'unknown' })
          }
        })()
      }
    }), 'dsh-extra-folders: loopback route')
  })

  ctx.logger?.info?.(`dsh-extra-folders: ${store.count()} workspace(s) carry attached folders (${store.stateFile})`)
}
