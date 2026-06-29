'use client';

import { useMemo, useState, useTransition, type ChangeEvent } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import { restrictToParentElement, restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import SortableHologramBlock from './SortableHologramBlock';
import {
  createSuggestedNavItem,
  HOLOGRAM_GUARD_COMMANDS,
  HOLOGRAM_MODES,
  HOLOGRAM_THEME_TOKENS,
  INITIAL_HOLOGRAM_BLOCKS,
  INITIAL_HOLOGRAM_NAV_ITEMS,
  moveHologramBlock,
  type HologramAlignment,
  type HologramBlock,
  type HologramBlockBehavior,
  type HologramBlockProps,
  type HologramColumnPreset,
  type HologramDensity,
  type HologramInteraction,
  type HologramMode,
  type HologramRole,
  type HologramThemeToken,
  type HologramViewport
} from '../../lib/master-ui-workspace/model';

type Props = {
  masterEmail: string;
};

function roleLabel(role: HologramRole) {
  if (role === 'client') return 'Client/Auth Aurora';
  if (role === 'manager') return 'Manager Graphite';
  return 'Master Executive';
}

function modeTitle(mode: HologramMode) {
  if (mode === 'live') return 'Published role preview';
  if (mode === 'edit') return 'MS Word-style drag canvas';
  if (mode === 'navigation') return 'Navigation table of contents';
  if (mode === 'theme') return 'Theme styles panel';
  if (mode === 'content') return 'Content editing panel';
  if (mode === 'behavior') return 'Behavior properties panel';
  if (mode === 'ai') return 'AI proposal gate';
  return 'Publish readiness map';
}

function impactScore(block: HologramBlock) {
  return block.impact === 'high' ? 12 : block.impact === 'medium' ? 7 : 3;
}

export default function MasterHologramWorkspaceShell({ masterEmail }: Props) {
  const [mode, setMode] = useState<HologramMode>('live');
  const [rolePreview, setRolePreview] = useState<HologramRole>('master');
  const [viewport, setViewport] = useState<HologramViewport>('desktop');
  const [blocks, setBlocks] = useState(INITIAL_HOLOGRAM_BLOCKS);
  const [navItems, setNavItems] = useState(INITIAL_HOLOGRAM_NAV_ITEMS);
  const [themeTokens, setThemeTokens] = useState(HOLOGRAM_THEME_TOKENS);
  const [selectedBlockId, setSelectedBlockId] = useState(INITIAL_HOLOGRAM_BLOCKS[0]?.id || '');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('Make the master account directory more compact, move critical status blocks above the table, and keep rollback metadata.');
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const selectedBlock = useMemo(() => blocks.find((block) => block.id === selectedBlockId) || blocks[0], [blocks, selectedBlockId]);
  const visibleBlocks = useMemo(() => blocks.filter((block) => block.roles.includes(rolePreview)), [blocks, rolePreview]);
  const visibleNavItems = useMemo(() => navItems.filter((item) => item.roles.includes(rolePreview) && item.enabled), [navItems, rolePreview]);
  const activeDragBlock = useMemo(() => blocks.find((block) => block.id === activeDragId) || null, [blocks, activeDragId]);
  const riskScore = useMemo(() => Math.min(100, visibleBlocks.reduce((score, block) => score + impactScore(block), 0)), [visibleBlocks]);
  const visibleBlockIds = useMemo(() => visibleBlocks.map((block) => block.id), [visibleBlocks]);
  const selectedLocked = Boolean(selectedBlock?.locked);

  const aiPatchPreview = useMemo(() => ({
    intent: 'master_hologram_ui_patch',
    prompt: aiPrompt,
    riskScore,
    affectedRoutes: ['/master/ui-workspace', '/master/accounts'],
    affectedBlocks: selectedBlock ? [selectedBlock.id] : [],
    patch: selectedBlock ? [{ op: 'update-props', blockId: selectedBlock.id, props: selectedBlock.props }] : [],
    guardsRequired: HOLOGRAM_GUARD_COMMANDS.slice(0, 4),
    publishPolicy: 'draft-only-until-backend-versioning-is-wired'
  }), [aiPrompt, riskScore, selectedBlock]);

  function switchMode(nextMode: HologramMode) {
    startTransition(() => setMode(nextMode));
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeId = String(event.active.id);
    const overId = event.over ? String(event.over.id) : '';
    if (overId) {
      setBlocks((current) => moveHologramBlock(current, activeId, overId));
      setSelectedBlockId(activeId);
    }
    setActiveDragId(null);
  }

  function updateSelectedBlock(updater: (block: HologramBlock) => HologramBlock) {
    if (!selectedBlock) return;
    setBlocks((current) => current.map((block) => block.id === selectedBlock.id ? updater(block) : block));
  }

  function updateBlockProp<K extends keyof HologramBlockProps>(key: K, value: HologramBlockProps[K]) {
    if (selectedLocked) return;
    updateSelectedBlock((block) => ({
      ...block,
      title: key === 'title' ? String(value) : block.title,
      description: key === 'description' ? String(value) : block.description,
      props: { ...block.props, [key]: value }
    }));
  }

  function updateBlockBehavior<K extends keyof HologramBlockBehavior>(key: K, value: HologramBlockBehavior[K]) {
    if (selectedLocked) return;
    updateSelectedBlock((block) => ({ ...block, behavior: { ...block.behavior, [key]: value } }));
  }

  function updateThemeToken(key: string, value: string) {
    setThemeTokens((current) => current.map((token) => token.key === key && token.editable ? { ...token, value } : token));
  }

  function addNavigationDraft() {
    setNavItems((current) => [...current, createSuggestedNavItem(current.length)]);
    switchMode('navigation');
  }

  function updateNavItem(id: string, field: 'label' | 'route', value: string) {
    setNavItems((current) => current.map((item) => item.id === id && !item.locked ? { ...item, [field]: value } : item));
  }

  function toggleNavItem(id: string) {
    setNavItems((current) => current.map((item) => item.id === id && !item.locked ? { ...item, enabled: !item.enabled } : item));
  }

  return <section className="hologram-workspace" data-hologram-workspace="true" data-hologram-mode={mode} data-hologram-role-preview={rolePreview} data-hologram-viewport={viewport} aria-busy={isPending}>
    <div className="hologram-command-panel" data-theme-surface="card">
      <div className="hologram-command-copy">
        <p>Master UI/UX Switch Mode 2.0</p>
        <h2>MS Word for your UI.</h2>
        <span>Move approved blocks, edit properties, preview role surfaces, add navigation drafts, tune tokens, and prepare guarded AI proposals. Signed in as {masterEmail}.</span>
      </div>
      <div className="hologram-toolbar" aria-label="Hologram toolbar">
        <div className="hologram-role-switch" aria-label="Preview role">
          {(['client', 'manager', 'master'] as HologramRole[]).map((role) => <button key={role} type="button" className={rolePreview === role ? 'active' : ''} onClick={() => setRolePreview(role)}>{roleLabel(role)}</button>)}
        </div>
        <div className="hologram-role-switch" aria-label="Viewport preview">
          {(['desktop', 'tablet', 'mobile'] as HologramViewport[]).map((item) => <button key={item} type="button" className={viewport === item ? 'active' : ''} onClick={() => setViewport(item)}>{item}</button>)}
        </div>
      </div>
    </div>

    <div className="hologram-mode-strip" role="tablist" aria-label="Workspace modes">
      {HOLOGRAM_MODES.map((item) => <button key={item.id} type="button" role="tab" aria-selected={mode === item.id} className={mode === item.id ? 'active' : ''} onClick={() => switchMode(item.id)}>
        <strong>{item.label}</strong>
        <span>{item.purpose}</span>
      </button>)}
    </div>

    <div className="hologram-grid">
      <section className="hologram-canvas" data-theme-surface="card" aria-label="Hologram visual canvas">
        <div className="hologram-section-header">
          <div><p>{roleLabel(rolePreview)} • {viewport}</p><h3>{modeTitle(mode)}</h3></div>
          <span className="hologram-chip">{visibleBlocks.length} visible block(s)</span>
        </div>

        <div className="hologram-ruler" aria-hidden="true"><span>0</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div>

        {mode === 'navigation' ? <div className="hologram-nav-preview" aria-label="Navigation builder preview">
          <button type="button" className="hologram-add-button" onClick={addNavigationDraft}>Add best-practice navigation draft</button>
          {navItems.filter((item) => item.roles.includes(rolePreview)).map((item, index) => <article key={item.id} className="hologram-nav-card" data-theme-surface="card">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <label><small>Label</small><input value={item.label} disabled={item.locked} onChange={(event) => updateNavItem(item.id, 'label', event.target.value)} /></label>
            <label><small>Route</small><input value={item.route} disabled={item.locked} onChange={(event) => updateNavItem(item.id, 'route', event.target.value)} /></label>
            <button type="button" disabled={item.locked} onClick={() => toggleNavItem(item.id)}>{item.enabled ? 'Enabled' : 'Disabled'}</button>
          </article>)}
        </div> : null}

        {mode === 'theme' ? <div className="hologram-token-grid" aria-label="Theme Studio token map">
          {themeTokens.map((token: HologramThemeToken) => <article key={token.key} className="hologram-token-card" data-theme-surface="card"><span>{token.scope}</span><strong>{token.label}</strong><code>{token.key}</code><input value={token.value} disabled={!token.editable} onChange={(event) => updateThemeToken(token.key, event.target.value)} /></article>)}
        </div> : null}

        {mode === 'ai' ? <div className="hologram-ai-panel" data-theme-surface="card">
          <label><span>AI command prompt</span><textarea value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} /></label>
          <pre>{JSON.stringify(aiPatchPreview, null, 2)}</pre>
        </div> : null}

        {mode !== 'navigation' && mode !== 'theme' && mode !== 'ai' ? <div className={`hologram-viewport-frame ${viewport}`} data-hologram-live-preview="true">
          <div className="hologram-viewport-topbar"><span>{roleLabel(rolePreview)}</span><strong>{viewport} preview</strong><em>{mode === 'edit' ? 'dnd-kit active' : 'read-only preview'}</em></div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis, restrictToParentElement]} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveDragId(null)}>
            <SortableContext items={visibleBlockIds} strategy={verticalListSortingStrategy}>
              <div className="hologram-block-stack">
                {visibleBlocks.map((block) => <SortableHologramBlock key={block.id} block={block} selected={selectedBlock?.id === block.id} dragging={activeDragId === block.id} sortableEnabled={mode === 'edit'} onSelect={setSelectedBlockId} />)}
              </div>
            </SortableContext>
            <DragOverlay dropAnimation={{ duration: 120, easing: 'cubic-bezier(.2, .8, .2, 1)' }}>{activeDragBlock ? <div className="hologram-drag-overlay"><strong>{activeDragBlock.props.title}</strong><span>{activeDragBlock.type}</span></div> : null}</DragOverlay>
          </DndContext>
        </div> : null}
      </section>

      <aside className="hologram-inspector" data-theme-surface="card" aria-label="Inspector panel">
        <div className="hologram-section-header"><div><p>Inspector</p><h3>{selectedBlock?.props.title || 'Select block'}</h3></div><span className="hologram-chip">Risk {riskScore}</span></div>
        {selectedBlock ? <div className="hologram-inspector-stack">
          <label><span>Component type</span><input readOnly value={selectedBlock.type} /></label>
          <label><span>Eyebrow</span><input disabled={selectedLocked} value={selectedBlock.props.eyebrow} onChange={(event) => updateBlockProp('eyebrow', event.target.value)} /></label>
          <label><span>Title</span><input disabled={selectedLocked} value={selectedBlock.props.title} onChange={(event) => updateBlockProp('title', event.target.value)} /></label>
          <label><span>Description</span><textarea disabled={selectedLocked} value={selectedBlock.props.description} onChange={(event) => updateBlockProp('description', event.target.value)} /></label>
          <label><span>Density</span><select disabled={selectedLocked} value={selectedBlock.props.density} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateBlockProp('density', event.target.value as HologramDensity)}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></label>
          <label><span>Alignment</span><select disabled={selectedLocked} value={selectedBlock.props.alignment} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateBlockProp('alignment', event.target.value as HologramAlignment)}><option value="left">Left</option><option value="center">Center</option></select></label>
          <label><span>Columns</span><select disabled={selectedLocked} value={selectedBlock.props.columns} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateBlockProp('columns', event.target.value as HologramColumnPreset)}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="auto">Auto</option></select></label>
          <label><span>Interaction</span><select disabled={selectedLocked} value={selectedBlock.behavior.interaction} onChange={(event: ChangeEvent<HTMLSelectElement>) => updateBlockBehavior('interaction', event.target.value as HologramInteraction)}><option value="static">Static</option><option value="link">Link</option><option value="action">Action</option><option value="dataset">Dataset</option></select></label>
          <label><span>Data source</span><input disabled={selectedLocked} value={selectedBlock.behavior.dataSource} onChange={(event) => updateBlockBehavior('dataSource', event.target.value)} /></label>
          <label className="hologram-check-row"><input type="checkbox" disabled={selectedLocked} checked={selectedBlock.behavior.hideOnMobile} onChange={(event) => updateBlockBehavior('hideOnMobile', event.target.checked)} /><span>Hide this block on mobile preview</span></label>
          <label className="hologram-check-row"><input type="checkbox" disabled={selectedLocked} checked={selectedBlock.behavior.resizable} onChange={(event) => updateBlockBehavior('resizable', event.target.checked)} /><span>Resizable in future backend phase</span></label>
        </div> : null}
      </aside>
    </div>

    <div className="hologram-bottom-grid">
      <article data-theme-surface="card"><p>5 Custom Features</p><h3>Impact controls</h3><ul><li>Visual Layout Builder</li><li>Navigation Builder</li><li>Theme Studio</li><li>Content + Context Editor</li><li>AI Proposal Gate</li></ul></article>
      <article data-theme-surface="card"><p>Publish Center</p><h3>Guarded proposal</h3><span>AI proposes. Master previews. Guards validate. Publish and rollback remain backend-gated in the persistence phase.</span></article>
      <article data-theme-surface="card"><p>Required guards</p><h3>Before publish</h3><div className="hologram-guard-list">{HOLOGRAM_GUARD_COMMANDS.slice(0, 5).map((command) => <code key={command}>{command}</code>)}</div></article>
    </div>
  </section>;
}
