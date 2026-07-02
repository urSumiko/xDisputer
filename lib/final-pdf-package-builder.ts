'use client';

import JSZip from 'jszip';
import type { ReviewOutput } from '../components/OutputReviewWorkspace';
import { assembleFinalPdf, type PdfPacketPart } from './final-pdf-packet';
import { type LetterType } from './letter-engine';
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

function cleanClientName(value: string) {
  let text = (value || 'CLIENT')
    .replace(/\.(docx|pdf|zip)$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  text = text.replace(/\b(TRANSUNION|EQUIFAX|EXPERIAN)\b.*$/i, '').trim();
  text = text.replace(/\b(DISPUTE|LATE PAYMENT)\s+LETTER\b.*$/i, '').trim();
  text = text.replace(/\b(1ST|2ND|3RD|FIRST|SECOND|THIRD|FINAL)\s+ROUND\b.*$/i, '').trim();
  text = text.replace(/\bMERGED\s+PDF\b.*$/i, '').trim();
  return safe(text || value || 'CLIENT');
}

function uniqueRoutes(docs: ReviewOutput[], routeHints: PacketRoute[] = []) {
  const generated = new Set(docs.filter((doc) => !doc.role || doc.role === 'LETTER').map((doc) => `${doc.type}:${doc.bureau}`));
  const fromDocs = docs.filter((doc) => !doc.role || doc.role === 'LETTER').map((doc) => ({ type: doc.type, bureau: doc.bureau }));
  const fromHints = routeHints.filter((route) => generated.has(`${route.type}:${route.bureau}`));
  return Array.from(new Map([...fromDocs, ...fromHints].map((route) => [`${route.type}:${route.bureau}`, route])).values());
}

function findDocument(docs: ReviewOutput[], route: PacketRoute, role: 'LETTER' | 'AFFIDAVIT' | 'FTC') {
  return docs.find((doc) => doc.type === route.type && (
    role === 'LETTER'
      ? doc.bureau === route.bureau && (!doc.role || doc.role === 'LETTER')
      : route.type === 'DISPUTE' && doc.role === role && (doc.bureau === route.bureau || doc.bureau === 'CLIENT')
  ));
}

function packetFileName(input: { client: string; route: PacketRoute }) {
  return `${input.client} ${input.route.bureau} MERGED PDF.pdf`;
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
  if (!letter) throw new Error(`Required component missing: ${input.route.bureau} Dispute Letter was not generated.`);

  const parts: PdfPacketPart[] = [
    { label: '01 Dispute Letter', kind: 'DOCX', blob: letter.blob },
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

  const client = cleanClientName(input.clientName);
  const zip = new JSZip();
  const packetNames: string[] = [];

  for (const route of routes) {
    const pdf = await buildPacketPdf({ docs: input.docs, round: input.round, evidenceKey: input.evidenceKey, route });
    const path = packetFileName({ client, route });
    zip.file(path, pdf);
    packetNames.push(path);
  }

  return {
    name: `${client} MERGED PDF.zip`,
    blob: await zip.generateAsync({ type: 'blob' }),
    packetCount: packetNames.length,
    packetNames
  };
}
