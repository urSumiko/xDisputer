export type PdfConversionPolicy = {
  mode: 'SERVER_REQUIRED' | 'SERVER_PREFERRED_WITH_BROWSER_FALLBACK';
  allowBrowserFallback: boolean;
  conversionEndpoint: string;
  reason: string;
};

export function pdfConversionPolicy(): PdfConversionPolicy {
  const explicitMode = (process.env.NEXT_PUBLIC_PDF_CONVERSION_MODE || '').trim().toLowerCase();
  const deterministic = process.env.NEXT_PUBLIC_DETERMINISTIC_PDF_CONVERSION === '1';
  const productionStrict = process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ALLOW_BROWSER_PDF_FALLBACK !== '1';
  const serverRequired = explicitMode === 'server_required' || deterministic || productionStrict;

  if (serverRequired) {
    return {
      mode: 'SERVER_REQUIRED',
      allowBrowserFallback: false,
      conversionEndpoint: '/api/convert/docx-to-pdf',
      reason: 'Deterministic packet output requires the server LibreOffice conversion endpoint.'
    };
  }

  return {
    mode: 'SERVER_PREFERRED_WITH_BROWSER_FALLBACK',
    allowBrowserFallback: true,
    conversionEndpoint: '/api/convert/docx-to-pdf',
    reason: 'Development compatibility allows browser fallback when the server converter is unavailable.'
  };
}

export function deterministicPdfConversionUnavailableMessage(label: string, error: unknown) {
  const detail = error instanceof Error && error.message ? error.message : 'server converter unavailable';
  return `${label} could not be converted with the deterministic server PDF converter. Install LibreOffice in the runtime or set NEXT_PUBLIC_ALLOW_BROWSER_PDF_FALLBACK=1 for development only. Details: ${detail}`;
}
