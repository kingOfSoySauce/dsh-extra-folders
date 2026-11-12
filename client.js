window.__ModuleLoader__.load({
  id: 'dsh-extra-folders',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    /** The official controls: Modal and Button are seed modules every plugin may require. */
    let primitives
    try {
      primitives = require('@deepseek-ai/dsh-client-ui-primitives')
    } catch {
      primitives = undefined
    }

    const ROUTE = '/extra-folders'
    const DIALOG_CLASS = 'wxf-dialog'
    const ICON_KEY = 'workspace-extra-folders.folder'
    /** After 打开文件夹 and 在 Finder 中显示, before 重命名 (100) and 删除 (300). */
    const MENU_ORDER = 150

    const COPY = {
      zh: {
        menu: '添加文件夹',
        title: '工作区添加文件夹',
        add: '添加文件夹',
        cancel: '取消',
        close: '关闭',
        empty: '还没有文件夹',
        remove: '移除',
        missing: '文件夹已不存在',
        failed: '没保存成功，再试一次',
        pickerUnavailable: '这里打不开系统文件夹选择器',
        root: '工作区',
        codes: {
          notWorkspace: '这个目录不是侧栏里的工作区',
          duplicate: '这个文件夹已经加过了',
          notDirectory: '选中的不是文件夹',
          missing: '文件夹不见了，可能刚被删掉',
          symlink: '这是软链接，请选它指向的真实路径',
          self: '这就是工作区本身',
          unknown: '没保存成功，再试一次'
        }
      },
      en: {
        menu: 'Add folder',
        title: 'Add workspace folders',
        add: 'Add folder',
        cancel: 'Cancel',
        close: 'Close',
        empty: 'No folders yet',
        remove: 'Remove',
        missing: 'Folder is gone',
        failed: "Didn't save. Try again",
        pickerUnavailable: 'The system folder picker is not available here',
        root: 'Workspace',
        codes: {
          notWorkspace: 'That directory is not a workspace in the sidebar',
          duplicate: 'That folder is already attached',
          notDirectory: 'That is not a folder',
          missing: 'That folder is gone',
          symlink: 'That is a symlink. Pick the real path it points to.',
          self: 'That is the workspace itself',
          unknown: "Didn't save. Try again"
        }
      }
    }

    /** Captured Client context so components can reach services lazily. */
    let pluginContext

    /** One dictionary per render, picked from the live locale. Never mixed. */
    function copy() {
      try {
        const snapshot = pluginContext?.get?.('locale')?.getLocale?.()
        const id = typeof snapshot?.active === 'string' ? snapshot.active : snapshot?.id
        return COPY[typeof id === 'string' && id.startsWith('zh') ? 'zh' : 'en'] ?? COPY.en
      } catch {
        return COPY.en
      }
    }

    /** One translated sentence per failure code. */
    function describe(failure) {
      const dict = copy()
      const code = typeof failure?.code === 'string' ? failure.code : 'unknown'
      return dict.codes[code] ?? dict.failed
    }

    async function callRoute(endpoint, payload) {
      if (typeof location === 'undefined') throw new Error('the workspace route needs the browser GUI')
      const url = new URL(`${ROUTE}/${endpoint}`, location.href).toString()
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload ?? {})
      })
      const text = await response.text()
      let data
      try {
        data = JSON.parse(text)
      } catch {
        data = undefined
      }
      const code = typeof data?.error === 'string' ? data.error : 'unknown'
      if (!response.ok || typeof data?.error === 'string') {
        const failure = new Error(code)
        failure.code = code
        throw failure
      }
      return data
    }

    // -- one open dialog at a time -----------------------------------------
    let openRequest = null
    const listeners = new Set()
    function publish(next) {
      openRequest = next
      for (const listener of [...listeners]) {
        try {
          listener()
        } catch {
          // one broken listener must not block the others
        }
      }
    }
    function subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    }
    function useRequest() {
      return React.useSyncExternalStore(subscribe, () => openRequest, () => openRequest)
    }

    // Rows copy the models page: one bordered card per entry, actions at the right edge.
    const styles = {
      list: { display: 'flex', flexDirection: 'column', gap: '10px' },
      row: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        minHeight: '52px',
        padding: '0 16px',
        borderRadius: '12px',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'transparent'
      },
      rowPath: { flex: '1 1 auto', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', fontSize: '14px' },
      remove: {
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        borderRadius: '8px',
        padding: '4px 12px',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: '13px'
      },
      tag: { color: 'var(--dsw-alias-label-secondary)', fontSize: '12px', flex: '0 0 auto' },
      missing: { color: 'var(--dsw-alias-state-warn-primary)', fontSize: '12px' },
      error: { color: 'var(--dsw-alias-label-secondary)', fontSize: '12px', lineHeight: '1.5' },
      addRow: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        minHeight: '52px',
        width: '100%',
        borderRadius: '12px',
        border: '1px dashed var(--dsw-alias-border-l2)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: '14px'
      }
    }

    function FolderGlyph() {
      return h('svg', {
        width: 14,
        height: 14,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true
      }, [
        h('path', { key: 'folder', d: 'M1.5 3.5C1.5 2.94772 1.94772 2.5 2.5 2.5H6.5L8 4.5H13.5C14.0523 4.5 14.5 4.94772 14.5 5.5V12.5C14.5 13.0523 14.0523 13.5 13.5 13.5H2.5C1.94772 13.5 1.5 13.0523 1.5 12.5V3.5Z' }),
        h('path', { key: 'plus', d: 'M8 7.5V11.5M6 9.5H10' })
      ])
    }

    /** One workspace's attached folders, rendered inside the official Modal. */
    function FolderDialog({ request, onClose }) {
      const text = copy()
      const workspace = typeof request.path === 'string' ? request.path : ''
      const title = typeof request.title === 'string' && request.title !== '' ? request.title : workspace
      const [folders, setFolders] = React.useState([])
      const [missing, setMissing] = React.useState([])
      const [busy, setBusy] = React.useState(false)
      const [error, setError] = React.useState('')

      const load = React.useCallback(async () => {
        const data = await callRoute('list', { workspace })
        setFolders(Array.isArray(data?.folders) ? data.folders : [])
        setMissing(Array.isArray(data?.missing) ? data.missing : [])
      }, [workspace])

      React.useEffect(() => {
        load().catch((failure) => setError(describe(failure)))
      }, [load])

      const add = async () => {
        setError('')
        const ui = pluginContext?.get?.('uiWorkspace')
        if (typeof ui?.pickDirectory !== 'function') {
          setError(text.pickerUnavailable)
          return
        }
        let picked
        try {
          picked = await ui.pickDirectory()
        } catch (failure) {
          setError(describe(failure))
          return
        }
        if (typeof picked !== 'string' || picked === '') return
        setBusy(true)
        try {
          await callRoute('add', { workspace, path: picked })
          await load()
        } catch (failure) {
          setError(describe(failure))
        } finally {
          setBusy(false)
        }
      }

      const remove = async (folder) => {
        setError('')
        setBusy(true)
        try {
          await callRoute('remove', { workspace, path: folder })
          await load()
        } catch (failure) {
          setError(describe(failure))
        } finally {
          setBusy(false)
        }
      }

      /** The workspace itself always comes first and cannot be removed. */
      const rows = [
        { path: workspace, removable: false },
        ...folders.map((folder) => ({ path: folder, removable: true }))
      ]

      const body = h('div', { style: styles.list },
        rows.map((row) => h('div', { key: row.path, style: styles.row }, [
          h('span', { key: 'path', style: styles.rowPath, title: row.path }, row.path),
          row.removable ? null : h('span', { key: 'tag', style: styles.tag }, text.root),
          row.removable && missing.includes(row.path) ? h('span', { key: 'missing', style: styles.missing }, text.missing) : null,
          row.removable
            ? h('button', {
              key: 'remove',
              type: 'button',
              style: styles.remove,
              disabled: busy,
              onClick: () => {
                void remove(row.path)
              }
            }, text.remove)
            : null
        ])))

      const Modal = primitives?.Modal
      const Button = primitives?.Button
      /** forwardRef and memo components are objects, so never test `typeof x === 'function'` here. */
      const official = Modal !== undefined && Modal !== null && Button !== undefined && Button !== null
      const addRow = h('button', {
        key: 'add',
        type: 'button',
        style: { ...styles.addRow, opacity: busy ? 0.6 : 1 },
        disabled: busy,
        onClick: () => {
          void add()
        }
      }, [
        h('svg', { key: 'plus', width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', 'aria-hidden': true }, [
          h('path', { key: 'h', d: 'M8 3.5v9' }),
          h('path', { key: 'v', d: 'M3.5 8h9' })
        ]),
        h('span', { key: 'label' }, text.add)
      ])

      if (official) {
        return h(Modal, {
          open: true,
          onClose,
          closeLabel: text.close,
          title: text.title,
          className: DIALOG_CLASS,
          // Both actions stay right-aligned inside the Modal's own footer container,
          // the way the rename and delete dialogs place theirs.
          footer: h(React.Fragment, null,
            h(Button, { key: 'close', variant: 'outline', onClick: onClose }, text.close),
            h(Button, { key: 'add', variant: 'primary', disabled: busy, onClick: () => { void add() } }, text.add)),
          children: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } }, [
            body,
            error === '' ? null : h('div', { key: 'error', role: 'alert', style: styles.error }, error)
          ])
        })
      }

      // Older deployments without the primitives seed keep a usable panel.
      return h('div', {
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': text.title,
        style: {
          position: 'fixed',
          inset: '0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'color-mix(in srgb, var(--dsw-alias-bg-base) 55%, transparent)',
          zIndex: 60
        }
      }, h('div', {
        style: {
          width: 'min(520px, calc(100vw - 32px))',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          padding: '20px',
          borderRadius: '16px',
          background: 'var(--dsw-alias-bg-overlay)',
          border: '1px solid var(--dsw-alias-border-l1)',
          color: 'var(--dsw-alias-label-primary)'
        }
      }, [
          body,
          error === '' ? null : h('div', { key: 'error', style: styles.error }, error),
          addRow,
          h('button', {
            key: 'close',
            type: 'button',
            onClick: onClose,
            style: { alignSelf: 'flex-end', border: '1px solid var(--dsw-alias-border-l2)', background: 'transparent', color: 'var(--dsw-alias-label-primary)', borderRadius: '10px', padding: '6px 14px', cursor: 'pointer', font: 'inherit' }
          }, text.close)
        ]))
    }

    /** A broken dialog must not take the overlay layer with it. */
    class OverlayBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      componentDidCatch(error) {
        console.error('dsh-extra-folders: dialog failed', error)
      }

      render() {
        return this.state.failed ? null : this.props.children
      }
    }

    function OverlayHost() {
      const request = useRequest()
      if (request === null) return null
      return h(OverlayBoundary, null, h(FolderDialog, {
        key: request.path,
        request,
        onClose: () => publish(null)
      }))
    }

    /**
     * The workspace row's own more menu: the action list this plugin contributes.
     * The menu owns rendering, so an action needs a label, an optional icon key,
     * and what to run.
     */
    function registerWorkspaceAction(ctx) {
      ctx.inject(['contextMenus'], (scope) => {
        scope.effect(() => scope.contextMenus.register({
          id: 'workspace-extra-folders.attach',
          target: 'workspace',
          order: MENU_ORDER,
          observe: () => {
            const locale = ctx.get('locale')
            return locale !== undefined && typeof locale.subscribe === 'function' ? [locale] : []
          },
          resolve: (target) => [{
            id: 'attach-folders',
            label: copy().menu,
            icon: { key: ICON_KEY },
            run: () => {
              publish({ path: target?.path, title: target?.displayTitle })
            }
          }]
        }), 'dsh-extra-folders: workspace menu action')
      })
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        pluginContext = ctx
        try {
          ctx.effect(() => {
            const style = document.createElement('style')
            style.dataset.plugin = 'workspace-extra-folders'
            style.textContent = `.${DIALOG_CLASS}{width:max-content;min-width:min(380px,calc(100vw - 32px));max-width:min(680px,calc(100vw - 32px))}`
            document.head.append(style)
            return () => style.remove()
          }, 'dsh-extra-folders: dialog width')

          ctx.slots.inject('contextMenu.icon', () => ctx.slots.register({
            name: 'contextMenu.icon',
            key: ICON_KEY
          }, FolderGlyph))

          registerWorkspaceAction(ctx)

          ctx.slots.inject('shell.overlay', () => ctx.slots.register({
            name: 'shell.overlay',
            id: 'workspace-extra-folders.dialog',
            order: 20
          }, OverlayHost))
        } catch (error) {
          // A deployment without this plugin's slots must keep its boot.
          console.error('dsh-extra-folders: client half could not install', error)
        }
      }
    }
  }
})
