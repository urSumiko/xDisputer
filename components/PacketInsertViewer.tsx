'use client';

import { useEffect, useRef, useState } from 'react';
import SupportingDocumentsLayoutEditor from './SupportingDocumentsLayoutEditor';
import { getActivePacketEvidence, setActivePacketEvidence, subscribeActivePacketEvidence } from '../lib/active-packet-evidence';
import type { PacketAssets } from '../lib/packet-assets';
import { readTemplateExhibit, type ExhibitKind } from '../lib/template-exhibits';
import type { Round } from '../lib/reference-store';

type Props = {
  kind: 'SUPPORTING' | 'FCRA' | 'ATTACHMENT';
  round: string;
  evidenceKey?: string;
  evidence?: PacketAssets;
  toolbarTargetId?: string;
  onEvidenceChanged?: (assets: PacketAssets) => void;
  onMessage?: (message: string) => void;
};

const SUPPORTING_COPY_REPLACEMENTS: Array<[RegExp, string]> = [
  [/Evidence files/g, 'Supporting files'],
  [/Evidence images/g, 'Supporting document images'],
  [/Evidence position saved/g, 'Supporting document position saved'],
  [/Evidence page returned/g, 'Supporting documents page returned'],
  [/evidence files/g, 'supporting files'],
  [/evidence image/g, 'supporting document image'],
  [/evidence position/g, 'supporting document position']
];

function supportCopy(value: string) {
  return SUPPORTING_COPY_REPLACEMENTS.reduce((next, [pattern, replacement]) => next.replace(pattern, replacement), value);
}

function patchSupportingCopy(root: HTMLElement | null) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const current = node.nodeValue || '';
    const next = supportCopy(current);
    if (next !== current) node.nodeValue = next;
    node = walker.nextNode();
  }
  root.querySelectorAll('[aria-label], [title]').forEach((element) => {
    for (const name of ['aria-label', 'title']) {
      const current = element.getAttribute(name);
      if (!current) continue;
      const next = supportCopy(current);
      if (next !== current) element.setAttribute(name, next);
    }
  });
}

function EmptyInsert({ message }: { message: string }) {
  return <div className="packet-insert-status missing"><strong>None</strong><span>{message}</span></div>;
}

function StaticTemplateViewer({ kind, round }: { kind: ExhibitKind; round: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState('');
  const [missing, setMissing] = useState(false);
  const [docx, setDocx] = useState(false);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setUrl('');
    setMissing(false);
    setDocx(false);
    void readTemplateExhibit(round as Round, kind).then(async (file) => {
      if (!active) return;
      if (!file) { setMissing(true); return; }
      const isDocx = /\.docx$/i.test(file.name) || /wordprocessingml/i.test(file.type);
      if (isDocx && host.current) {
        setDocx(true);
        const { renderAsync } = await import('docx-preview');
        if (!active || !host.current) return;
        host.current.innerHTML = '';
        await renderAsync(await file.arrayBuffer(), host.current, undefined, {
          className: 'packet-static-docx', inWrapper: true, ignoreWidth: false,
          ignoreHeight: false, breakPages: true, renderHeaders: true, renderFooters: true
        });
        return;
      }
      objectUrl = URL.createObjectURL(file);
      setUrl(objectUrl);
    }).catch(() => setMissing(true));
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [kind, round]);

  if (missing) return <EmptyInsert message="Not configured for this packet position." />;
  if (url) return <div className="packet-static-file-view"><iframe title={`${kind} configured insert`} src={url} /></div>;
  return <div ref={host} className={docx ? 'packet-static-docx-host' : 'packet-insert-loading'}>{!docx && 'Loading configured insert…'}</div>;
}

export default function PacketInsertViewer({ kind, round, evidenceKey = '', evidence, toolbarTargetId, onEvidenceChanged, onMessage }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [published, setPublished] = useState(() => getActivePacketEvidence());
  const [message, setMessage] = useState('');

  useEffect(() => subscribeActivePacketEvidence(() => setPublished(getActivePacketEvidence())), []);
  useEffect(() => {
    if (kind !== 'SUPPORTING') return;
    patchSupportingCopy(rootRef.current);
    const observer = new MutationObserver(() => patchSupportingCopy(rootRef.current));
    if (rootRef.current) observer.observe(rootRef.current, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'title'] });
    return () => observer.disconnect();
  }, [kind]);

  if (kind !== 'SUPPORTING') return <StaticTemplateViewer kind={kind} round={round} />;
  const key = evidenceKey || published?.key || '';
  const assets = evidence || published?.assets;
  if (!key || !assets?.supporting.length) return <EmptyInsert message="No supporting documents have been uploaded for this packet." />;

  return <div ref={rootRef} className="packet-supporting-inline">
    <SupportingDocumentsLayoutEditor
      storageKey={key}
      assets={assets}
      toolbarTargetId={toolbarTargetId}
      onChanged={(next) => { setActivePacketEvidence(key, next); onEvidenceChanged?.(next); }}
      onMessage={(next) => { const copy = supportCopy(next); setMessage(copy); onMessage?.(copy); }}
    />
    {message && <p className="packet-supporting-message">{message}</p>}
  </div>;
}
