import PizZip from 'pizzip';
import { normalizeTemplateAnchorText } from './anchor-alias-registry';

export type DocxParagraphNode = {
  index: number;
  text: string;
  normalizedText: string;
  styleId: string | null;
  runCount: number;
  hasBookmark: boolean;
  bookmarkNames: string[];
  hasContentControl: boolean;
  contentControlTags: string[];
  xml: string;
};

export type DocxStructureMap = {
  paragraphCount: number;
  tableCount: number;
  bookmarks: string[];
  contentControls: string[];
  paragraphs: DocxParagraphNode[];
  documentXml: string;
};

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripXmlTags(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, ''));
}

function allMatches(source: string, pattern: RegExp) {
  return Array.from(source.matchAll(pattern));
}

function textFromParagraphXml(xml: string) {
  const textNodes = allMatches(xml, /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g).map((match) => decodeXml(match[1] || ''));
  const tabs = xml.includes('<w:tab') ? '\t' : '';
  const breaks = xml.includes('<w:br') || xml.includes('<w:cr') ? '\n' : '';
  const text = textNodes.join('') || stripXmlTags(xml);
  return [text, tabs, breaks].join('').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

function attr(xml: string, localName: string) {
  const escaped = localName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`(?:w:)?${escaped}="([^"]+)"`));
  return match?.[1] || null;
}

function styleId(xml: string) {
  const style = xml.match(/<w:pStyle\b[^>]*(?:w:)?val="([^"]+)"[^>]*>/);
  return style?.[1] || null;
}

function bookmarkNames(xml: string) {
  return allMatches(xml, /<w:bookmarkStart\b[^>]*(?:w:)?name="([^"]+)"[^>]*>/g).map((match) => match[1]).filter(Boolean);
}

function contentControlTags(xml: string) {
  return allMatches(xml, /<w:tag\b[^>]*(?:w:)?val="([^"]+)"[^>]*>/g).map((match) => match[1]).filter(Boolean);
}

function paragraphXmlBlocks(documentXml: string) {
  return allMatches(documentXml, /<w:p\b[\s\S]*?<\/w:p>/g).map((match) => match[0]);
}

export async function readDocxDocumentXml(input: Blob | ArrayBuffer | Uint8Array | string) {
  if (typeof input === 'string') {
    if (input.includes('<w:document') || input.includes('<w:p')) return input;
    const zip = new PizZip(input);
    const file = zip.file('word/document.xml');
    if (!file) throw new Error('DOCX document XML is unavailable.');
    return file.asText();
  }
  const buffer = input instanceof Blob ? await input.arrayBuffer() : input;
  const zip = new PizZip(buffer);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('DOCX document XML is unavailable.');
  return file.asText();
}

export async function readDocxStructure(input: Blob | ArrayBuffer | Uint8Array | string): Promise<DocxStructureMap> {
  const documentXml = await readDocxDocumentXml(input);
  return createDocxStructureMap(documentXml);
}

export function createDocxStructureMap(documentXml: string): DocxStructureMap {
  const paragraphXml = paragraphXmlBlocks(documentXml);
  const paragraphs = paragraphXml.map((xml, index) => {
    const text = textFromParagraphXml(xml);
    const bookmarks = bookmarkNames(xml);
    const tags = contentControlTags(xml);
    return {
      index,
      text,
      normalizedText: normalizeTemplateAnchorText(text),
      styleId: styleId(xml),
      runCount: allMatches(xml, /<w:r\b/g).length,
      hasBookmark: bookmarks.length > 0,
      bookmarkNames: bookmarks,
      hasContentControl: tags.length > 0,
      contentControlTags: tags,
      xml
    } satisfies DocxParagraphNode;
  });
  const bookmarks = paragraphs.flatMap((paragraph) => paragraph.bookmarkNames);
  const contentControls = paragraphs.flatMap((paragraph) => paragraph.contentControlTags);
  return {
    paragraphCount: paragraphs.length,
    tableCount: allMatches(documentXml, /<w:tbl\b/g).length,
    bookmarks,
    contentControls,
    paragraphs,
    documentXml
  };
}

export { normalizeTemplateAnchorText };
