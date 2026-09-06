'use client'

/**
 * ConfigurationStudioLayout — P9.3 Phase B (Framework Improvement)
 *
 * The permanent Studio shell every Platform Configuration route renders
 * through: global toolbar, resizable/collapsible Modules rail, the active
 * module's workspace (`ConfigurationModulePage`, unmodified from P9.1.3/
 * P9.2 aside from the additive props wired below), and a resizable
 * Inspector panel. Below the `lg` breakpoint, the nav and Inspector move
 * into slide-over `Drawer` s (Phase P) so the workspace stays usable on a
 * tablet/phone_number. Command palette (Ctrl/Cmd+K) and the Ctrl/Cmd+S shortcut
 * are wired once, here, for every module — not re-implemented per page.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { Drawer } from '@/components/ui/Modal'
import { useAuthStore } from '@/stores'
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut'
import { useResizablePanel } from '@/hooks/use-resizable-panel'
import { useConfigurationStudioNav } from '@/hooks/use-configuration-studio-nav'
import { usePlatformConfiguration } from '@/hooks/use-platform-configuration'
import { ConfigurationStudioNav } from './ConfigurationStudioNav'
import { ConfigurationStudioToolbar, type ConfigurationDraftStatus, type ConfigurationModuleActions } from './ConfigurationStudioToolbar'
import { ConfigurationInspector } from './ConfigurationInspector'
import { ConfigurationCommandPalette } from './ConfigurationCommandPalette'
import { ConfigurationModulePage } from './ConfigurationModulePage'
import { ConfigurationWorkspaceSkeleton } from './ConfigurationWorkspaceSkeleton'
import type { ConfigurationPermissionContext } from '@/lib/configuration-studio-permissions'

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    setIsDesktop(mq.matches)
    const onChange = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return isDesktop
}

export interface ConfigurationStudioLayoutProps {
  activeModuleId?: string
  onNavigate: (moduleId: string) => void
  /**
   * P9.4 Phase D/E — what the workspace pane shows when no module is
   * selected. Optional; omitting it keeps the exact P9.1.3/P9.3 behavior
   * (a plain "Select a module…" prompt), so the existing Configuration
   * routes are unaffected. The Platform Administration Center route passes
   * `<PlatformDashboard />` here instead of introducing a second shell.
   */
  emptyWorkspace?: ReactNode
  /**
   * `'tenant'` (default) keeps Console Settings on tenant RBAC.
   * Platform Admin routes must pass `'platform'` explicitly.
   */
  permissionContext?: ConfigurationPermissionContext
  /**
   * Optional workspace replacement for modules that are not field-row CMS
   * (e.g. Platform Homepage gallery). Tenant Configuration Studio omits this.
   */
  customWorkspace?: ReactNode
}

export function ConfigurationStudioLayout({
  activeModuleId,
  onNavigate,
  emptyWorkspace,
  permissionContext = 'tenant',
  customWorkspace,
}: ConfigurationStudioLayoutProps) {
  const t = useTranslations('console')
  const modules = usePlatformConfiguration()
  const activeModule = modules.find((m) => m.id === activeModuleId)
  const { recordVisit } = useConfigurationStudioNav()
  const actorUser = useAuthStore((s) => s.user)
  const isDesktop = useIsDesktop()

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [draftStatus, setDraftStatus] = useState<ConfigurationDraftStatus | null>(null)
  const [actions, setActions] = useState<ConfigurationModuleActions | null>(null)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const nav = useResizablePanel({ storageKey: 'configuration-studio.nav-width', defaultWidth: 240, minWidth: 180, maxWidth: 360, side: 'left' })
  const inspector = useResizablePanel({ storageKey: 'configuration-studio.inspector-width', defaultWidth: 320, minWidth: 260, maxWidth: 480, side: 'right' })

  // Only clears the Inspector selection on module change — `draftStatus`/
  // `actions` are deliberately NOT reset here. `ConfigurationModulePage` is
  // remounted (via its `key`) whenever ` activeModuleId`changes, so its own
  // mount effects already report fresh draft state/actions for the new
  // module. Resetting them here too used to race those effects: React
  // flushes a newly-mounted child's effects before this parent effect in
  // the same commit, so `setActions(null)` here ran *after* the child's own
  // `onActionsReady` call and silently wiped it back to `null` on the very
  // first mount, leaving the toolbar's Save button permanently inert.
  useEffect(() => {
    if (activeModuleId) recordVisit(activeModuleId)
    setSelectedFieldId(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModuleId])

  const actor = { id: actorUser?.id ?? 'platform-admin', name: actorUser ? `${actorUser.first_name} ${actorUser.last_name}`.trim() : 'Platform Administrator' }

  useKeyboardShortcut('k', () => setPaletteOpen(true), { meta: true, allowInFormFields: true })

  const handleNavigateToField = useCallback((moduleId: string, fieldId: string) => {
    onNavigate(moduleId)
    setSelectedFieldId(fieldId)
    if (!isDesktop) setMobileInspectorOpen(true)
  }, [onNavigate, isDesktop])

  const handleFieldSelect = useCallback((fieldId: string) => {
    setSelectedFieldId(fieldId)
    if (!isDesktop) setMobileInspectorOpen(true)
  }, [isDesktop])

  const workspace = modules.length === 0 ? (
    <ConfigurationWorkspaceSkeleton />
  ) : customWorkspace && activeModuleId ? (
    customWorkspace
  ) : activeModuleId ? (
    <ConfigurationModulePage
      key={`${activeModuleId}-${refreshKey}`}
      moduleId={activeModuleId}
      onFieldSelect={handleFieldSelect}
      onDraftStateChange={setDraftStatus}
      onActionsReady={setActions}
      permissionContext={permissionContext}
    />
  ) : emptyWorkspace ? (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">{emptyWorkspace}</div>
  ) : (
    <div className="flex h-full items-center justify-center text-sm text-[var(--fg-muted)]">
      {t('selectModuleToBegin')}
    </div>
  )

  const inspectorPanel = <ConfigurationInspector fieldId={selectedFieldId} actor={actor} permissionContext={permissionContext} />

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg)]">
      <ConfigurationStudioToolbar
        activeModule={activeModule}
        draftStatus={draftStatus}
        actions={actions}
        actor={actor}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onRefresh={() => setRefreshKey((k) => k + 1)}
      />

      <div className="flex min-h-0 flex-1">
        {isDesktop ? (
          <>
            {!nav.collapsed && (
              <div style={{ width: nav.width }} className="relative shrink-0 border-r border-[var(--border)] motion-safe:animate-[fade-in_150ms_ease-out]">
                <ConfigurationStudioNav activeModuleId={activeModuleId} onSelect={onNavigate} />
                <div
                  onPointerDown={nav.onDragStart}
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--accent-subtle)]"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={t('resizeModulesPanelAria')}
                />
              </div>
            )}
            <button
              type="button"
              onClick={nav.toggleCollapsed}
              aria-label={nav.collapsed ? t('showModulesPanelAria') : t('hideModulesPanelAria')}
              className="shrink-0 border-r border-[var(--border)] px-1 text-[var(--fg-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--fg)]"
            >
              {nav.collapsed ? <PanelLeftOpen className="h-4 w-4"/> : <PanelLeftClose className="h-4 w-4"/>}
            </button>
          </>
        ) : (
          <Drawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title={t('modulesDrawerTitle')} side="left">
            <div className="min-h-0 flex-1 overflow-hidden flex flex-col">
            <ConfigurationStudioNav
              activeModuleId={activeModuleId}
              onSelect={(id) => { onNavigate(id); setMobileNavOpen(false) }}
            />
            </div>
          </Drawer>
        )}

        <div className="min-w-0 flex-1 overflow-y-auto">
          {!isDesktop && (
            <div className="flex items-center gap-2 border-b border-[var(--border)] p-2">
              <button type="button"onClick={() => setMobileNavOpen(true)} className="rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--card-hover)]">
                <PanelLeftOpen className="h-4 w-4"/>
              </button>
              <button type="button" onClick={() => setMobileInspectorOpen(true)} className="ms-auto rounded-lg px-2 py-1 text-xs text-[var(--fg-muted)] hover:bg-[var(--card-hover)]">
                <PanelRightOpen className="h-4 w-4"/>
              </button>
            </div>
          )}
          {workspace}
        </div>

        {isDesktop ? (
          <>
            <button
              type="button"
              onClick={inspector.toggleCollapsed}
              aria-label={inspector.collapsed ? t('showInspectorPanelAria') : t('hideInspectorPanelAria')}
              className="shrink-0 border-l border-[var(--border)] px-1 text-[var(--fg-muted)] hover:bg-[var(--card-hover)] hover:text-[var(--fg)]"
            >
              {inspector.collapsed ? <PanelRightOpen className="h-4 w-4"/> : <PanelRightClose className="h-4 w-4"/>}
            </button>
            {!inspector.collapsed && (
              <div style={{ width: inspector.width }} className="relative shrink-0 border-l border-[var(--border)] motion-safe:animate-[fade-in_150ms_ease-out]">
                <div
                  onPointerDown={inspector.onDragStart}
                  className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--accent-subtle)]"
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={t('resizeInspectorPanelAria')}
                />
                {inspectorPanel}
              </div>
            )}
          </>
        ) : (
          <Drawer open={mobileInspectorOpen} onClose={() => setMobileInspectorOpen(false)} title={t('inspectorDrawerTitle')} side="right">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {inspectorPanel}
            </div>
          </Drawer>
        )}
      </div>

      <ConfigurationCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigateToModule={onNavigate}
        onNavigateToField={handleNavigateToField}
        draftStatus={draftStatus}
        actions={actions}
      />
    </div>
  )
}
