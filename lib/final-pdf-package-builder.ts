'use client';

import type { ReviewOutput } from '../components/OutputReviewWorkspace';
import { assembleFinalPdf, mergePdfBlobs, type PdfPacketPart } from './final-pdf-packet';
import { type Bureau, type LetterType } from './letter-engine';
import { createSupportingDocumentsPdf } from './packet-renderer';
import type { Round } from './reference-store';
import { readTemplateExhibit } from './template-exhibits';
import { isFtcEnabled } from './workflow-framework';

type PacketRoute = { type: LetterType; bureau: string };

export type FinalMergedPdfPackage = {
  name: string;
  blob: Blob;
  packetCount: number;
  packetNames: string[];
};

function safe(value: string) {
  return (value || 'CLIENT').replace(/[\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function fileBase(value: string) {
  return safe(value).replace(/[^A-Z0-9]+/g, '_');
}

function uniqueRoutes(docs: ReviewOutput[], routeHints: PacketRoute[] = []) {
  const fromDocs = docs
    .filter((doc) => !doc.role || doc.role === 'LETTER')
    .map((doc) => ({ type: doc.type, bureau: doc.bureau }));
  return Array.from(new Map([...fromDocs, ...routeHints].map((route) => [`${route.type}:${route.bureau}`, route])).values());
}

function findDocument(docs: ReviewOutput[], route: PacketRoute, role: 'LETTER' | 'AFFIDAVIT' | 'FTC') {
  return docs.find((doc) => doc.type === route.type && (
    role === 'LETTER'
      ? doc.bureau === route.bureau && (!doc.role || doc.role === 'LETTER')
      : route.type === 'DISPUTE' && doc.role === role && (doc.bureau === route.bureau || doc.bureau === 'CLIENT')
  ));
}

function letterLabel(type: LetterType) {
  return type === 'LATE_PAYMENT' ? 'Late Payment Letter' : 'Dispute Letter';
}

async function buildPacketPdf(input: {
  docs: ReviewOutput[];
  round: Round;
  evidenceKey: string;
  route: PacketRoute;
}) {
  const supporting = input.evidenceKey ? await createSupportingDocumentsPdf(input.evidenceKey).catch(() => null) : null;
  if (!supporting) throw new Error('Required component missing: 02 Supporting Documents.pdf could not be prepared.');

  const letter = findDocument(input.docs, input.route, 'LETTER');
  if (!letter) throw new Error(`Required component missing: ${input.route.bureau} 01 ${letterLabel(input.route.type)}.docx was not generated.`);

  const parts: PdfPacketPart[] = [
    { label: `01 ${letterLabel(input.route.type)}`, kind: 'DOCX', blob: letter.blob },
    { label: '02 Supporting Documents', kind: 'PDF', blob: supporting }
  ];

  if (input.route.type === 'DISPUTE') {
    const attachment = await readTemplateExhibit(input.round, 'ATTACHMENT');
    const fcra = await readTemplateExhibit(input.round, 'FCRA');
    const affidavit = findDocument(input.docs, input.route, 'AFFIDAVIT');
    if (!attachment) throw new Error('Required component missing: 03 Attachment.pdf is not configured.');
    if (!fcra) throw new Error('Required component missing: 04 FCRA Legal Exhibit.pdf is not configured.');
    if (!affidavit) throw new Error('Required component missing: 05 Affidavit.docx was not generated.');

    parts.push(
      { label: '03 Attachment', kind: 'PDF', blob: attachment },
      { label: '04 FCRA Legal Exhibit', kind: 'PDF', blob: fcra },
      { label: '05 Affidavit', kind: 'DOCX', blob: affidavit.blob }
    );

    if (isFtcEnabled()) {
      const ftc = findDocument(input.docs, input.route, 'FTC');
      if (!ftc) throw new Error('Required component missing: 06 FTC Identity Theft Report.docx was not generated.');
      parts.push({ label: '06 FTC Identity Theft Report', kind: 'DOCX', blob: ftc.blob });
    }
  }

  return assembleFinalPdf(parts, { requireAllParts: true });
}

export async function buildFinalMergedPdfPackage(input: {
  docs: ReviewOutput[];
  round: Round;
  evidenceKey: string;
  clientName: string;
  routeHints?: PacketRoute[];
}): Promise<FinalMergedPdfPackage> {
  const routes = uniqueRoutes(input.docs, input.routeHints);
  if (!routes.length) throw new Error('No generated packet routes are available for final PDF assembly.');

  const client = safe(input.clientName);
  const packets: Array<{ label: string; blob: Blob }> = [];
  for (const route of routes) {
    const title = `${client} ${route.bureau} ${route.type === 'DISPUTE' ? 'DISPUTE' : 'LATE PAYMENT'} PACKET.pdf`;
    packets.push({ label: title, blob: await buildPacketPdf({ docs: input.docs, round: input.round, evidenceKey: input.evidenceKey, route }) });
  }

  const merged = await mergePdfBlobs(packets);
  return {
    name: `${fileBase(input.clientName)}_${fileBase(input.round)}_FINAL_MERGED_PACKET.pdf`,
    blob: merged.blob,
    packetCount: packets.length,
    packetNames: packets.map((packet) => packet.label)
  };
}
