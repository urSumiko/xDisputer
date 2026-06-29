import JSZip from 'jszip';

const WORD_TEXT_PART = /^word\/(?:document|header\d+|footer\d+)\.xml$/i;

function xmlToVisibleText(xml: string) {
  return xml
    .replace(/<w:tab\b[^>]*\/>/gi, '\t')
    .replace(/<w:(?:br|cr)\b[^>]*\/>/gi, '\n')
    .replace(/<\/w:p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export async function extractDocxVisibleText(blob: Blob) {
  try {
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const parts = Object.keys(zip.files).filter((name) => WORD_TEXT_PART.test(name));
    const textParts = await Promise.all(parts.map(async (name) => xmlToVisibleText(await zip.file(name)!.async('text'))));
    return textParts.join('\n');
  } catch {
    return '';
  }
}
