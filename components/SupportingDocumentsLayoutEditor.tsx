'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { loadPacketFile, resetSupportingPlacements, saveSupportingPlacement, type PacketAsset, type PacketAssets, type SupportingPlacement, type SupportingRotation } from '../lib/packet-assets';

type SupportingManagerRenderer = (selectedId: string | null, selectDocument: (id: string) => void) => ReactNode;
type Props = { storageKey: string; assets: PacketAssets; toolbarTargetId?: string; managerPanel?: ReactNode | SupportingManagerRenderer; onChanged: (assets: PacketAssets) => void; onMessage: (message: string) => void };
type Preview = { id: string; url: string };
type Drag = { id: string; pointerId: number; x: number; y: number; placement: SupportingPlacement; moved: boolean } | null;
type SupportingCanvasStyle = CSSProperties & { '--supporting-canvas-width'?: string; '--supporting-canvas-height'?: string };

const MIN = 0.08;
const PAGE_RATIO = 8.5 / 11;

function clamp(value: number, low: number, high: number) { return Math.max(low, Math.min(high, value)); }
function pct(value: number) { return `${Math.round(value * 10000) / 100}%`; }
function safeRotation(value: number): SupportingRotation { return (((value % 360) + 360) % 360) as SupportingRotation; }

function supportSlot(index: number, total: number): Pick<SupportingPlacement, 'x' | 'y' | 'width' | 'height'> {
  const count = Math.max(1, Math.min(total || 1, 12));
  if (count === 1) return { x: 0.04, y: 0.13, width: 0.92, height: 0.52 };
  if (count === 2) return { x: 0.04, y: 0.08 + index * 0.44, width: 0.92, height: 0.4 };
  if (count === 3) return { x: 0.04, y: 0.06 + index * 0.3, width: 0.92, height: 0.28 };
  const height = 0.92 / count;
  return { x: 0.04, y: 0.04 + index * height, width: 0.92, height };
}

function auto(index: number, total: number): SupportingPlacement {
  const slot = supportSlot(index, total);
  return { ...slot, cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1, rotation: 0, fit: 'contain' };
}

function sanitize(next: SupportingPlacement): SupportingPlacement {
  const width = clamp(next.width, MIN, 1);
  const height = clamp(next.height, MIN, 1);
  const cropWidth = clamp(next.cropWidth ?? 1, 0.1, 1);
  const cropHeight = clamp(next.cropHeight ?? 1, 0.1, 1);
  return {
    ...next,
    width,
    height,
    x: clamp(next.x, 0, 1 - width),
    y: clamp(next.y, 0, 1 - height),
    cropWidth,
    cropHeight,
    cropX: clamp(next.cropX ?? 0, 0, 1 - cropWidth),
    cropY: clamp(next.cropY ?? 0, 0, 1 - cropHeight),
    rotation: next.rotation || 0,
    fit: next.fit || 'contain'
  };
}

function placement(asset: PacketAsset, index: number, count: number): SupportingPlacement {
  const existing = asset.placement ? sanitize(asset.placement) : auto(index, count);
  if (count === 1 && (existing.width < 0.86 || existing.height < 0.38)) {
    return sanitize({ ...existing, x: 0.04, y: clamp(existing.y, 0.08, 0.28), width: 0.92, height: Math.max(existing.height, 0.48) });
  }
  return existing;
}

function PreviewCanvas({ url, box, label }: { url?: string; box: SupportingPlacement; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!url || !canvas.current) return;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled || !canvas.current) return;
      const rotated = document.createElement('canvas');
      const swap = box.rotation === 90 || box.rotation === 270;
      rotated.width = swap ? image.naturalHeight : image.naturalWidth;
      rotated.height = swap ? image.naturalWidth : image.naturalHeight;
      const sourceContext = rotated.getContext('2d');
      const output = canvas.current;
      const outputWidth = Math.max(1, Math.round(box.width * 1800));
      const outputHeight = Math.max(1, Math.round(box.height * 2400));
      output.width = outputWidth;
      output.height = outputHeight;
      const context = output.getContext('2d');
      if (!sourceContext || !context) return;
      sourceContext.translate(rotated.width / 2, rotated.height / 2);
      sourceContext.rotate(((box.rotation || 0) * Math.PI) / 180);
      sourceContext.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
      const sx = (box.cropX || 0) * rotated.width;
      const sy = (box.cropY || 0) * rotated.height;
      const sw = Math.max(1, (box.cropWidth || 1) * rotated.width);
      const sh = Math.max(1, (box.cropHeight || 1) * rotated.height);
      const fit = box.fit || 'contain';
      const scale = fit === 'stretch' ? 0 : fit === 'cover' ? Math.max(outputWidth / sw, outputHeight / sh) : Math.min(outputWidth / sw, outputHeight / sh);
      const drawWidth = fit === 'stretch' ? outputWidth : sw * scale;
      const drawHeight = fit === 'stretch' ? outputHeight : sh * scale;
      context.clearRect(0, 0, outputWidth, outputHeight);
      context.drawImage(rotated, sx, sy, sw, sh, (outputWidth - drawWidth) / 2, (outputHeight - drawHeight) / 2, drawWidth, drawHeight);
    };
    image.src = url;
    return () => { cancelled = true; };
  }, [url, box.width, box.height, box.cropX, box.cropY, box.cropWidth, box.cropHeight, box.rotation, box.fit]);
  return url ? <canvas ref={canvas} className="support-cropped-preview" role="img" aria-label={label} /> : null;
}

function canvasWidth(hasManagerPanel: boolean) {
  if (typeof window === 'undefined') return hasManagerPanel ? 620 : 760;
  const reserved = hasManagerPanel ? 620 : 360;
  return clamp(window.innerWidth - reserved, hasManagerPanel ? 520 : 580, hasManagerPanel ? 620 : 760);
}

export default function SupportingDocumentsLayoutEditor({ storageKey, assets, managerPanel, onChanged, onMessage }: Props) {
  const [workingAssets, setWorkingAssets] = useState<PacketAssets>(assets);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(assets.supporting[0]?.id || null);
  const [drag, setDrag] = useState<Drag>(null);
  const [width, setWidth] = useState(() => canvasWidth(Boolean(managerPanel)));
  const latestAssets = useRef<PacketAssets>(assets);
  const page = useRef<HTMLDivElement>(null);

  useEffect(() => { setWorkingAssets(assets); latestAssets.current = assets; }, [assets]);
  useEffect(() => { if (!workingAssets.supporting.some((asset) => asset.id === selectedId)) setSelectedId(workingAssets.supporting[0]?.id || null); }, [workingAssets.supporting, selectedId]);
  useEffect(() => {
    let live = true;
    const urls: string[] = [];
    void Promise.all(workingAssets.supporting.map(async (asset) => {
      const file = await loadPacketFile(storageKey, asset.id);
      if (!file) return null;
      const url = URL.createObjectURL(file);
      urls.push(url);
      return { id: asset.id, url };
    })).then((next) => { if (live) setPreviews(next.filter(Boolean) as Preview[]); });
    return () => { live = false; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [storageKey, workingAssets.supporting]);
  useEffect(() => {
    const resize = () => setWidth(canvasWidth(Boolean(managerPanel)));
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [managerPanel]);

  const selectedIndex = workingAssets.supporting.findIndex((asset) => asset.id === selectedId);
  const selected = selectedIndex < 0 ? null : workingAssets.supporting[selectedIndex];
  const current = selected ? placement(selected, selectedIndex, workingAssets.supporting.length) : null;
  const images = useMemo(() => new Map(previews.map((preview) => [preview.id, preview.url])), [previews]);
  const canvasVars: SupportingCanvasStyle = { '--supporting-canvas-width': `${width}px`, '--supporting-canvas-height': `${Math.round(width / PAGE_RATIO)}px` };

  function persist(id: string, next: SupportingPlacement, publish = true) {
    const updated = saveSupportingPlacement(storageKey, id, sanitize(next));
    latestAssets.current = updated;
    setWorkingAssets(updated);
    if (publish) onChanged(updated);
  }

  function edit(values: Partial<SupportingPlacement>) {
    if (!selected || !current) return;
    persist(selected.id, { ...current, ...values });
  }

  function choose(id: string) {
    setSelectedId(id);
  }

  function resizeSelected(scale: number) {
    if (!selected || !current) return;
    const centerX = current.x + current.width / 2;
    const centerY = current.y + current.height / 2;
    const width = clamp(current.width * scale, MIN, 1);
    const height = clamp(current.height * scale, MIN, 1);
    persist(selected.id, sanitize({ ...current, width, height, x: centerX - width / 2, y: centerY - height / 2 }));
    onMessage(scale > 1 ? 'Selected document enlarged.' : 'Selected document reduced.');
  }

  function fitSelectedToWidth() {
    if (!selected || !current) return;
    persist(selected.id, sanitize({ ...current, x: 0.04, width: 0.92, fit: current.fit || 'contain' }));
    onMessage('Selected document fit to the maximum readable width.');
  }

  function centerSelected() {
    if (!selected || !current) return;
    persist(selected.id, sanitize({ ...current, x: (1 - current.width) / 2, y: current.y }));
    onMessage('Selected document centered.');
  }

  function rotate(direction: -90 | 90) {
    if (!current) return;
    edit({ rotation: safeRotation((current.rotation || 0) + direction), fit: current.fit || 'contain' });
    onMessage(`Document rotated ${direction === 90 ? 'right' : 'left'} 90°.`);
  }

  function resetPage() {
    const updated = resetSupportingPlacements(storageKey);
    latestAssets.current = updated;
    setWorkingAssets(updated);
    onChanged(updated);
    onMessage('Supporting Documents page returned to maximum-width alignment.');
  }

  function startImage(event: PointerEvent<HTMLDivElement>, asset: PacketAsset, index: number) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    choose(asset.id);
    setDrag({ id: asset.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, placement: placement(asset, index, workingAssets.supporting.length), moved: false });
  }

  function move(event: PointerEvent<HTMLElement>) {
    if (!drag || drag.pointerId !== event.pointerId || !page.current) return;
    const bounds = page.current.getBoundingClientRect();
    const deltaX = (event.clientX - drag.x) / bounds.width;
    const deltaY = (event.clientY - drag.y) / bounds.height;
    const moved = Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 2;
    if (moved && !drag.moved) setDrag((value) => value && value.pointerId === event.pointerId ? { ...value, moved: true } : value);
    persist(drag.id, { ...drag.placement, x: clamp(drag.placement.x + deltaX, 0, 1 - drag.placement.width), y: clamp(drag.placement.y + deltaY, 0, 1 - drag.placement.height) }, false);
  }

  function finish(event: PointerEvent<HTMLElement>) {
    if (drag?.pointerId !== event.pointerId) return;
    const moved = drag.moved || Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 2;
    setDrag(null);
    if (!moved) return;
    onChanged(latestAssets.current);
    onMessage('Supporting document position saved for packet position 02.');
  }

  if (!workingAssets.supporting.length) return null;

  const toolbar: ReactNode = <div className="supporting-header-tools"><nav className="support-image-strip" aria-label="Supporting document images">{workingAssets.supporting.map((asset, index) => <button type="button" key={asset.id} className={asset.id === selectedId ? 'selected' : ''} onClick={() => choose(asset.id)}><span>{images.get(asset.id) && <img src={images.get(asset.id)} alt="" />}</span><strong>{String(index + 1).padStart(2, '0')}</strong><small>{asset.name}</small></button>)}</nav><button type="button" className="supporting-auto-align" onClick={resetPage}>Reset page</button></div>;

  return <section className="support-layout-editor professional-supporting-editor word-crop-editor" data-manager-panel={managerPanel ? 'true' : 'false'} data-supporting-canvas-contract="measured-grid-center-width" style={canvasVars}>
    <div className="support-layout-grid word-crop-grid">
      {managerPanel ? <aside className="word-left-evidence-manager"><div className="word-side-evidence-heading"><p>Supporting documents</p><span>Position 02</span></div>{typeof managerPanel === 'function' ? (managerPanel as SupportingManagerRenderer)(selectedId, (id: string) => choose(id)) : managerPanel}</aside> : null}
      <div className="support-page-frame"><div className="support-canvas-caption evidence-preview-header evidence-preview-toolbar-header">{toolbar}</div><div ref={page} className="support-page-canvas tool-position">{workingAssets.supporting.map((asset, index) => { const box = placement(asset, index, workingAssets.supporting.length); const selectedItem = asset.id === selectedId; return <div key={asset.id} className={`support-canvas-item ${selectedItem ? 'selected' : ''}`} style={{ left: pct(box.x), top: pct(box.y), width: pct(box.width), height: pct(box.height) }} onPointerDown={(event) => startImage(event, asset, index)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}><PreviewCanvas url={images.get(asset.id)} box={box} label={asset.name} /><span>{index + 1}</span></div>; })}</div></div>
      {selected && current && <aside className="support-layout-controls word-crop-controls"><header><div><p className="eyebrow">Selected document</p><strong>{selected.name}</strong></div><span>{String(selectedIndex + 1).padStart(2, '0')}</span></header><div className="word-crop-actions"><button type="button" className="action-button crop-command" onClick={fitSelectedToWidth}>Fit document</button></div><div className="word-control-section"><p>Document fit</p><div className="word-fit-actions" aria-label="Document fit mode"><label><span>Fit mode</span><select value={current.fit || 'contain'} onChange={(event) => edit({ fit: event.target.value as SupportingPlacement['fit'] })}><option value="contain">Contain — no stretch</option><option value="cover">Cover frame</option><option value="stretch">Stretch/manual</option></select></label></div></div><div className="word-control-section"><p>Frame size</p><div className="word-resize-actions"><button type="button" onClick={() => resizeSelected(0.92)}>− Smaller</button><button type="button" onClick={() => resizeSelected(1.08)}>+ Larger</button><button type="button" onClick={fitSelectedToWidth}>Fit width</button><button type="button" onClick={centerSelected}>Center</button></div></div><div className="word-control-section"><p>Orientation</p><div className="word-rotate-actions"><button type="button" onClick={() => rotate(-90)} aria-label="Rotate document left 90 degrees">↶ Rotate left</button><button type="button" onClick={() => rotate(90)} aria-label="Rotate document right 90 degrees">Rotate right ↷</button></div></div><div className="word-control-section"><p>Reset</p><div className="word-position-actions"><button type="button" onClick={() => selected && persist(selected.id, auto(selectedIndex, workingAssets.supporting.length))}>Reset slot</button><button type="button" onClick={() => selected && edit({ cropX: 0, cropY: 0, cropWidth: 1, cropHeight: 1 })}>Reset crop</button></div></div></aside>}
    </div>
  </section>;
}
