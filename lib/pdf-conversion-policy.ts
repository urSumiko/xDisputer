export type PdfConversionPolicy = {
  mode: 'SERVER_REQUIRED' | 'SERVER_PREFERRED_WITH_BROWSER_FALLBACK';
  allowBrowserFallback: boolean;
  conversionEndpoint: string;
  reason: string;
};

export function pdfConversionPolicy(): PdfConversionPolicy {
  const explicitMode = (process.env.NEXT_PUBLIC_PDF_CONVERSION_MODE || '').trim().toLowerCase();
  const deterministic = process.env.NEXT_PUBLIC_DETERMINISTIC_PDF_CONVERSION === '1';
  const serverRequired = explicitMode === 'server_required' || deterministic;

  if (serverRequired) {
    return {
      mode: 'SERVER_REQUIRED',
      allowBrowserFallback: false,
      conversionEndpoint: '/api/convert/docx-to-pdf',
      reason: 'Deterministic packet output requires the server LibreOffice conversion endpoint because strict PDF mode was explicitly requested.'
    };
  }

  return {
    mode: 'SERVER_PREFERRED_WITH_BROWSER_FALLBACK',
    allowBrowserFallback: true,
    conversionEndpoint: '/api/convert/docx-to-pdf',
    reason: 'Server conversion is preferred. Browser fallback remains enabled unless strict deterministic PDF mode is explicitly requested.'
  };
}

export function deterministicPdfConversionUnavailableMessage(label: string, error: unknown) {
  const detail = error instanceof Error && error.message ? error.message : 'server converter unavailable';
  return `${label} could not be converted with the deterministic server PDF converter. Install LibreOffice in the runtime or remove NEXT_PUBLIC_PDF_CONVERSION_MODE=server_required / NEXT_PUBLIC_DETERMINISTIC_PDF_CONVERSION=1 for browser fallback. Details: ${detail}`;
}
