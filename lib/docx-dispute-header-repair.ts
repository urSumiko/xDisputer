import PizZip from 'pizzip';
import { hardenGeneratedDocx } from './docx-safety';
import { DOCX_MIME, type ReferenceDisputeValues } from './docx-renderer';

const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const STATIC_HEADER_PLACEHOLDER = /^(?:NAME|ADDRESS|CITY,?\s*STATE\s+ZIP|DOB:?|SSN:?|\[DATE\]|\[CREDIT\s+BUREAU\s+NAME\]|\[DISPUTE\s+ADDRESS\])$/i;

function paragraphs(body: Element) {
  return Array.from(body.children).filter((node) => node.namespaceURI === WORD_NS && node.localName === 'p') as Element[];
}

function textOf(paragraph: Element) {
  return Array.from(paragraph.getElementsByTagNameNS(WORD_NS, 't')).map((node) => node.textContent || '').join('').replace(/\s+/g, ' ').trim();
}

function keyOf(value: string) {
  return value.replace(/[\[\]]/g, '').replace(/\s+/g, ' ').replace(/:$/, '').trim().toUpperCase();
}

function hasGeneratedHeaderBefore(all: Element[], startIndex: number, values: ReferenceDisputeValues) {
  const before = all.slice(0, startIndex).map(textOf).join('\n');
  return before.includes(values.consumerName) && before.includes(values.bureauName) && before.includes(values.letterDate);
}

function staticHeaderRegion(all: Element[], startIndex: number) {
  const region: Element[] = [];
  for (let index = startIndex; index < all.length; index += 1) {
    const paragraph = all[index];
    const value = textOf(paragraph);

    if (!value) {
      region.push(paragraph);
      continue;
    }

    if (/^RE:/i.test(value)) break;

    if (STATIC_HEADER_PLACEHOLDER.test(value)) {
      region.push(paragraph);
      continue;
    }

    break;
  }

  const keys = region.map((paragraph) => keyOf(textOf(paragraph))).filter(Boolean);
  const hasClientPlaceholders = keys.includes('NAME') && keys.includes('ADDRESS');
  const hasDatePlaceholder = keys.includes('DATE');
  const hasBureauPlaceholders = keys.includes('CREDIT BUREAU NAME') || keys.includes('DISPUTE ADDRESS');

  return hasClientPlaceholders && hasDatePlaceholder && hasBureauPlaceholders ? region : [];
}

function removeDuplicateStaticHeader(body: Element, values: ReferenceDisputeValues) {
  const all = paragraphs(body);

  for (let index = 0; index < all.length; index += 1) {
    if (!/^NAME$/i.test(textOf(all[index]))) continue;
    if (!hasGeneratedHeaderBefore(all, index, values)) continue;

    const region = staticHeaderRegion(all, index);
    if (!region.length) continue;

    region.forEach((paragraph) => paragraph.parentNode?.removeChild(paragraph));
    return true;
  }

  return false;
}

export async function repairDisputeStaticHeaderDuplication(blob: Blob, values: ReferenceDisputeValues): Promise<Blob> {
  const zip = new PizZip(await blob.arrayBuffer());
  const file = zip.file('word/document.xml');
  if (!file) return blob;

  const xml = new DOMParser().parseFromString(file.asText(), 'application/xml');
  const body = xml.getElementsByTagNameNS(WORD_NS, 'body')[0];
  if (!body) return blob;

  const changed = removeDuplicateStaticHeader(body, values);
  if (!changed) return blob;

  zip.file('word/document.xml', new XMLSerializer().serializeToString(xml));
  return hardenGeneratedDocx(zip.generate({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' }));
}
