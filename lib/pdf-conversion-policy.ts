export type PdfConversionPolicy = {
  mode: 'SERVER_REQUIRED' | 'SERVER_PREFERRED_WITH_BROWSER_FALLBACK';
  allowBrowserFallback: boolean;
  conversionEndpoint: string;
  reason: string;
};

function envValue(name: string) {
  try {
    return process.env[name];
  } catch {
    return undefined;
  }
}

export function pdfConversionPolicy(): PdfConversionPolicy {
  const explicitMode = (envValue('NEXT_PUBLIC_PDF_CONVERSION_MODE') || envValue('PDF_CONVERSION_MODE') || '').trim().toLowerCase();
  const deterministic = envValue('NEXT_PUBLIC_DETERMINISTIC_PDF_CONVERSION') === '1' || envValue('DETERMINISTIC_PDF_CONVERSION') === '1';
  const productionStrict = envValue('NODE_ENV') === 'production' && envValue('NEXT_PUBLIC_ALLOW_BROWSER_PDF_FALLBACK') !== '1';
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
