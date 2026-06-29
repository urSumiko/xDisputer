'use client';

import { useEffect, useMemo, useState } from 'react';
import SimpleDocxEditor from './SimpleDocxEditor';
import { isFtcEnabled } from '../lib/workflow-framework';
import type { PacketAssets } from '../lib/packet-assets';
import type { LetterRoute, LetterType } from '../lib/letter-engine';
import { buildPacketReviewSummary } from '../lib/packet-review-contract';
import { userFacingText } from '../lib/ux-copy-contract';
import { buildFinalMergedPdfPackage, type FinalMergedPdfPackage } from '../lib/final-pdf-package-builder';

export interface ReviewOutput { id?: string; path: string; type: LetterType; role?: 'LETTER' | 'AFFIDAVIT' | 'FTC'; sequence?: number; bureau: string; count: number; detail: string; blob: Blob; packetSteps?: string[]; }
interface OutputReviewWorkspaceProps { round: string; outputs: ReviewOutput[]; expectedRoutes?: LetterRoute[]; zipName?: string; warnings: string[]; evidenceKey?: string; evidence?: PacketAssets; onEvidenceChanged?: (assets: PacketAssets) => void; onMessage?: (message: string) => void; onZip: () => void; onReplace: (output: ReviewOutput, file: File) => void | Promise<void>; mergedPdfName?: string; mergedPdfReady?: boolean; mergedPdfError?: string; onMergedPdfDownload?: () => void; }

function packetDocuments(anchor: ReviewOutput, allOutputs: ReviewOutput[]) { return allOutputs.filter((item) => { if (item.role === 'FTC' && !isFtcEnabled()) return false; if (item.bureau === anchor.bureau && item.type === anchor.type) return true; return anchor.type === 'DISPUTE' && (item.role === 'AFFIDAVIT' || (item.role === 'FTC' && isFtcEnabled())) && item.bureau === 'CLIENT'; }).sort((a, b) => (a.sequence || 1) - (b.sequence || 1)); }
function clientNameFromOutputs(outputs: ReviewOutput[]) { const file = (outputs.find((output) => output.role === 'LETTER' || !output.role)?.path || outputs[0]?.path || 'CLIENT').split('/').pop() || 'CLIENT'; return file.replace(/\s+(TRANSUNION|EQUIFAX|EXPERIAN)\b.*$/i, '').replace(/\.(docx|pdf)$/i, '').trim() || 'CLIENT'; }
function routeHints(expectedRoutes: LetterRoute[] | undefined, outputs: ReviewOutput[]) { const hints = (expectedRoutes || []).map((route) => ({ type: route.type, bureau: route.bureau })); const generated = outputs.filter((output) => !output.role || output.role === 'LETTER').map((output) => ({ type: output.type, bureau: output.bureau })); return Array.from(new Map([...hints, ...generated].map((route) => [`${route.type}:${route.bureau}`, route])).values()); }
function blobToDataUrl(blob: Blob) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(reader.error || new Error('Could not prepare PDF ZIP download.')); reader.onload = () => resolve(String(reader.result || '')); reader.readAsDataURL(blob); }); }

export default function OutputReviewWorkspace({ round, outputs, expectedRoutes, zipName, warnings, evidenceKey, evidence, onEvidenceChanged, onMessage, onZip, onReplace, mergedPdfName, mergedPdfReady, mergedPdfError, onMergedPdfDownload }: OutputReviewWorkspaceProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [reviewedPaths, setReviewedPaths] = useState<string[]>([]);
  const [localFinalPdf, setLocalFinalPdf] = useState<FinalMergedPdfPackage | null>(null);
  const [localPdfUrl, setLocalPdfUrl] = useState('');
  const [localPdfError, setLocalPdfError] = useState('');
  const [localPreparing, setLocalPreparing] = useState(false);
  const activeOutputs = useMemo(() => outputs.filter((output) => output.role !== 'FTC' || isFtcEnabled()), [outputs]);
  const review = useMemo(() => buildPacketReviewSummary({ outputs: activeOutputs, reviewedPaths, evidence, expectedRoutes }), [activeOutputs, reviewedPaths, evidence, expectedRoutes]);
  const selected = activeOutputs.find((output) => output.path === selectedPath) || null;
  const selectedDocuments = selected ? packetDocuments(selected, activeOutputs) : [];
  const effectivePdfName = mergedPdfName || localFinalPdf?.name || 'MERGED_PDF_PACKETS.zip';
  const effectivePdfReady = Boolean(mergedPdfReady || localFinalPdf);
  const effectivePdfError = mergedPdfError || localPdfError;

  async function prepareLocalMergedPdf() {
    if (!evidenceKey || !activeOutputs.length || localPreparing || localFinalPdf || mergedPdfReady) return;
    setLocalPreparing(true);
    setLocalPdfError('');
    try {
      const pdf = await buildFinalMergedPdfPackage({ docs: activeOutputs, round: round as any, evidenceKey, clientName: clientNameFromOutputs(activeOutputs), routeHints: routeHints(expectedRoutes, activeOutputs) });
      setLocalFinalPdf(pdf);
      setLocalPdfUrl(await blobToDataUrl(pdf.blob));
      onMessage?.('Editable DOCX packet and merged PDF ZIP are ready.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Merged PDF ZIP generation failed.';
      setLocalFinalPdf(null);
      setLocalPdfUrl('');
      setLocalPdfError(message);
      onMessage?.(`Merged PDF ZIP generation failed: ${message}`);
    } finally {
      setLocalPreparing(false);
    }
  }

  useEffect(() => { setLocalFinalPdf(null); setLocalPdfUrl(''); setLocalPdfError(''); }, [activeOutputs, evidenceKey, round]);
  useEffect(() => { if (!zipName || !evidenceKey || !activeOutputs.length || localFinalPdf || mergedPdfReady) return; void prepareLocalMergedPdf(); }, [zipName, evidenceKey, activeOutputs]);
  function openPacket(path: string) { setSelectedPath(path); setReviewedPaths((current) => current.includes(path) ? current : [...current, path]); }

  const mergedPdfControl = onMergedPdfDownload
    ? <button type="button" className="action-button" disabled={!effectivePdfReady} onClick={onMergedPdfDownload}>{effectivePdfReady ? 'Merged PDF ZIP' : 'Preparing PDF ZIP'}</button>
    : localPdfUrl
      ? <a className="action-button" href={localPdfUrl} download={effectivePdfName}>Merged PDF ZIP</a>
      : <button type="button" className="action-button" disabled={!evidenceKey || !activeOutputs.length || localPreparing} onClick={() => void prepareLocalMergedPdf()}>{localPreparing ? 'Preparing PDF ZIP' : localPdfError ? 'Retry Merged PDF ZIP' : 'Prepare Merged PDF ZIP'}</button>;

  return <section className="outputs-workspace guided-output-workspace progressive-output-workspace"><section className="panel output-stage output-review-stage shared-stage-surface compact-output-review-stage"><header className="output-stage-header output-progressive-command output-review-command-merged"><div className="output-stage-heading"><p className="eyebrow">Review and delivery</p><h2>{review.headline}</h2><p>{review.instruction}</p></div><div className="output-download-command"><span>{review.reviewedPackets}/{review.totalPackets} reviewed</span><button type="button" className="secondary-button" disabled={!zipName} onClick={onZip}>Editable DOCX packet</button>{mergedPdfControl}</div></header>{effectivePdfError && <section className="output-notices" role="alert"><strong>Merged PDF ZIP needs attention</strong><p>{userFacingText(effectivePdfError, 'error')}</p><button type="button" className="secondary-button" disabled={localPreparing} onClick={() => void prepareLocalMergedPdf()}>{localPreparing ? 'Retrying…' : 'Retry Merged PDF ZIP'}</button></section>}<section className="output-packet-review canonical-package-review" aria-label="Packet review"><div className="review-cards output-packet-grid">{review.cards.map((packet) => <article className={`review-card packet-card component-package-card ${packet.reviewed ? 'reviewed' : ''}`} key={packet.key}><header className="output-card-head"><span className="output-bureau">{packet.bureau}</span><span className={`packet-status ${packet.ready ? 'ready' : 'pending'}`}>{packet.reviewed ? 'Reviewed' : packet.ready ? 'Ready' : 'Needs review'}</span></header><h3>{packet.title}</h3><p className="output-card-order">{packet.subtitle}</p><div className="package-file-list">{packet.documents.map((row) => <div key={row.id}><b>{row.id}</b><strong>{row.label}</strong><small>{row.detail}</small><span>{row.included ? 'Included' : 'Missing'}</span></div>)}</div><button type="button" className="edit-document" onClick={() => openPacket(packet.key)}>Review packet</button></article>)}</div></section>{warnings.length > 0 && <section className="output-notices"><strong>Items to review</strong>{warnings.slice(0, 3).map((warning, index) => <p key={index}>{userFacingText(warning, 'error')}</p>)}</section>}</section>{selected && <SimpleDocxEditor round={round} output={selected} documents={selectedDocuments} initialDocumentPath={selected.path} evidenceKey={evidenceKey} evidence={evidence} warnings={warnings} onEvidenceChanged={onEvidenceChanged} onMessage={onMessage} onClose={() => setSelectedPath(null)} onSave={onReplace} />}</section>;
}
