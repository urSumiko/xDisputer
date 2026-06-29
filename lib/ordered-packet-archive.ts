'use client';

import JSZip from 'jszip';
import type { ReviewOutput } from '../components/OutputReviewWorkspace';
import { assertGeneratedDocx } from './docx-review-marker';
import { bureauInfo, type Bureau } from './letter-engine';
import { fetchManagerTemplateFile, type ManagerTemplateFileAsset } from './manager-template-file-resolver';
import { createSupportingDocumentsPdf } from './packet-renderer';
import type { Round } from './reference-store';
import { readTemplateExhibit, type ExhibitKind } from './template-exhibits';
import { isFtcEnabled } from './workflow-framework';

type PacketType = 'DISPUTE' | 'LATE_PAYMENT';
export type PacketRoute = { type: PacketType; bureau: string };

function safe(value: string) {
  return value.replace(/[\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function findDocument(docs: ReviewOutput[], route: PacketRoute, role: 'LETTER' | 'AFFIDAVIT' | 'FTC') {
  return docs.find((doc) => doc.type === route.type && (
    role === 'LETTER'
      ? doc.bureau === route.bureau && (!doc.role || doc.role === 'LETTER')
      : route.type === 'DISPUTE' && doc.role === role && (doc.bureau === route.bureau || doc.bureau === 'CLIENT')
  ));
}

function exhibitAsset(round: Round, kind: ExhibitKind): ManagerTemplateFileAsset {
  return { id: `${round}-EXHIBIT-${kind}`, round_label: round, template_kind: 'EXHIBIT', letter_type: null, exhibit_kind: kind, original_filename: `${kind}.pdf` };
}

async function readLatestPacketExhibit(round: Round, kind: ExhibitKind) {
  const cloud = await fetchManagerTemplateFile({ round, asset: exhibitAsset(round, kind) }).catch(() => null);
  if (cloud) return cloud;
  return readTemplateExhibit(round, kind).catch(() => null);
}

export async function addOrderedPacketFolders(
  zip: JSZip,
  docs: ReviewOutput[],
  round: Round,
  caseKey: string,
  clientName: string,
  routeHints: PacketRoute[] = []
) {
  const docRoutes = docs
    .filter((doc) => !doc.role || doc.role === 'LETTER')
    .map((doc) => ({ type: doc.type, bureau: doc.bureau }));
  const routes = Array.from(new Map([...docRoutes, ...routeHints].map((route) => [`${route.type}:${route.bureau}`, route])).values());
  const client = safe(clientName) || 'CLIENT';
  const supporting = caseKey ? await createSupportingDocumentsPdf(caseKey).catch(() => null) : null;
  if (!supporting) throw new Error('Required component missing: 02 Supporting Documents.pdf could not be prepared.');

  const disputeRoutes = routes.filter((route) => route.type === 'DISPUTE');
  const lateRoutes = routes.filter((route) => route.type === 'LATE_PAYMENT');
  const disputePresent = disputeRoutes.length > 0;
  const hasLatePayment = lateRoutes.length > 0;

  const fcra = disputePresent ? await readLatestPacketExhibit(round, 'FCRA') : null;
  const attachment = disputePresent ? await readLatestPacketExhibit(round, 'ATTACHMENT') : null;
  if (disputePresent && !fcra) throw new Error('Required component missing: 04 FCRA Legal Exhibit.pdf could not be loaded from the active manager template library.');
  if (disputePresent && !attachment) throw new Error('Required component missing: 03 Attachment.pdf could not be loaded from the active manager template library.');

  for (const route of routes) {
    const title = route.type === 'DISPUTE' ? 'Dispute Letter' : 'Late Payment Letter';
    const group = hasLatePayment ? `${title}/` : '';
    const folder = `${group}${client} ${route.bureau}/`;
    const letter = findDocument(docs, route, 'LETTER');
    if (!letter) throw new Error(`Required component missing: ${route.bureau} 01 ${title}.docx was not generated.`);
    const recipient = bureauInfo[route.bureau as Bureau]?.name || route.bureau;
    const validated = await assertGeneratedDocx(letter.blob, `${route.bureau} ${title}`, [clientName, recipient]);

    zip.file(`${folder}01 ${title}.docx`, validated);
    zip.file(`${folder}02 Supporting Documents.pdf`, supporting);

    if (route.type === 'DISPUTE') {
      zip.file(`${folder}03 Attachment.pdf`, attachment!);
      zip.file(`${folder}04 FCRA Legal Exhibit.pdf`, fcra!);
      const affidavit = findDocument(docs, route, 'AFFIDAVIT');
      if (!affidavit) throw new Error('Required component missing: 05 Affidavit.docx was not generated.');
      zip.file(`${folder}05 Affidavit.docx`, await assertGeneratedDocx(affidavit.blob, 'Affidavit', [clientName]));
      if (isFtcEnabled()) {
        const ftc = findDocument(docs, route, 'FTC');
        if (!ftc) throw new Error('Required component missing: 06 FTC Report.docx was not generated.');
        zip.file(`${folder}06 FTC Report.docx`, await assertGeneratedDocx(ftc.blob, 'FTC Report', []));
      }
    }
  }
}
