export type UserErrorSeverity = 'warning' | 'error' | 'critical';

export type UserFacingError = {
  id: string;
  severity: UserErrorSeverity;
  title: string;
  headline: string;
  mainCause: string;
  whatToDo: string[];
  technicalDetails: string;
  category: 'MANAGER_TEMPLATE' | 'TEMPLATE' | 'SOURCE_DATA' | 'GENERATION' | 'NETWORK' | 'ACCOUNT' | 'SYSTEM';
  suggestedPanel?: 'Templates' | 'Source Data' | 'Outputs' | 'Settings';
};

type ErrorContext = {
  operation?: string;
  round?: string;
  panel?: string;
};

function messageFrom(error: unknown) {
  if (typeof error === 'string') return error;
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || '');
  return 'An unknown error occurred.';
}

function compact(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function makeId() {
  return `ERR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function has(message: string, pattern: RegExp) {
  return pattern.test(message);
}

export function explainWebsiteError(error: unknown, context: ErrorContext = {}): UserFacingError {
  const technicalDetails = compact(messageFrom(error));
  const lower = technicalDetails.toLowerCase();
  const operation = context.operation || 'Website action';
  const roundHint = context.round ? ` This happened while using ${context.round}.` : '';

  if (has(lower, /manager template|template manager|assigned manager|manager-controlled|manager controlled|client_template_upload_disabled|no_manager_assigned/)) {
    const assignmentMissing = has(lower, /not assigned|no_manager_assigned|manager is not assigned/);
    const clientUpload = has(lower, /manager-controlled|manager controlled|client_template_upload_disabled|clients use the active templates/);

    return {
      id: makeId(),
      severity: 'error',
      category: 'MANAGER_TEMPLATE',
      suggestedPanel: 'Templates',
      title: assignmentMissing ? 'Template manager is not assigned' : clientUpload ? 'Template uploads are manager-controlled' : 'Manager template is missing',
      headline: assignmentMissing
        ? 'Your account does not have an assigned manager template library yet.'
        : clientUpload
          ? 'Only your assigned manager can upload or replace templates.'
          : 'Your assigned manager has not provided the required active template.',
      mainCause: assignmentMissing
        ? 'The system cannot load default templates until this client is assigned to a manager.'
        : clientUpload
          ? 'Clients cannot upload templates because all assigned clients must use the same manager-approved templates for consistent output.'
          : `The package cannot continue because the manager default template for this document slot is unavailable.${roundHint}`,
      whatToDo: assignmentMissing
        ? [
            'Ask an admin or manager to assign this client to a manager account.',
            'Refresh the page after the assignment is active.',
            'Try Generate again.'
          ]
        : clientUpload
          ? [
              'Ask your assigned manager to upload or replace the template.',
              'Refresh this page after the manager updates the active template.',
              'Try Generate again using the manager-approved template.'
            ]
          : [
              'Contact your assigned manager and ask them to upload the missing template for this round.',
              'Ask the manager to confirm the template is active and passes validation.',
              'Refresh this page and try Generate again.'
            ],
      technicalDetails
    };
  }

  if (has(lower, /template is missing|required component missing|could not load .*template|template .*not uploaded|missing required .*template/)) {
    return {
      id: makeId(),
      severity: 'error',
      category: 'TEMPLATE',
      suggestedPanel: 'Templates',
      title: 'Template needed',
      headline: 'A required template is missing or cannot be loaded.',
      mainCause: `The package cannot continue because one of the templates needed for generation is unavailable.${roundHint}`,
      whatToDo: [
        'Open Templates and confirm the active round has the required letter and packet templates.',
        'Re-upload the missing or changed template, then try Generate again.',
        'If the template was uploaded before, refresh the page so the active cloud template is loaded.'
      ],
      technicalDetails
    };
  }

  if (has(lower, /uploaded .*template is missing|document xml is unavailable|docx body is unavailable|template cell|template table|report-number position|contact table|affected-item tables|signed date position|account list section|required standard value positions/)) {
    return {
      id: makeId(),
      severity: 'error',
      category: 'TEMPLATE',
      suggestedPanel: 'Templates',
      title: 'Template layout problem',
      headline: 'The uploaded template does not match the structure the generator needs.',
      mainCause: 'The file was found, but its layout or required editable positions are not compatible with this generation step.',
      whatToDo: [
        'Open Templates and replace this template with a compatible DOCX file.',
        'Keep required placeholders or editable sections in the template instead of deleting them.',
        'If you intentionally changed wording or layout, add the canonical placeholders back and try again.'
      ],
      technicalDetails
    };
  }

  if (has(lower, /dynamic template engine v2 blocked|failed proof checks|missing required canonical|unknown required placeholder|unresolved required placeholder|blocked by dynamic template|contract.*blocked|placeholder/)) {
    return {
      id: makeId(),
      severity: 'error',
      category: 'TEMPLATE',
      suggestedPanel: 'Templates',
      title: 'Template placeholders need attention',
      headline: 'The template has missing or unresolved dynamic fields.',
      mainCause: 'The template loaded, but the dynamic template engine could not safely map all required client data into it.',
      whatToDo: [
        'Check the uploaded template for missing required placeholders such as client name, address, bureau, or account blocks.',
        'Use canonical placeholders instead of deleting or renaming required fields.',
        'Re-upload the corrected template and generate again.'
      ],
      technicalDetails
    };
  }

  if (has(lower, /standardize|source|client profile|no dispute|no late-payment|no .*document paths|affected accounts are required|no affected accounts|account.*required|review the affidavit state|county/)) {
    return {
      id: makeId(),
      severity: 'warning',
      category: 'SOURCE_DATA',
      suggestedPanel: 'Source Data',
      title: 'Source data needs review',
      headline: 'The system needs more client or account data before it can generate.',
      mainCause: 'The account review or source data does not contain the required information for this package step.',
      whatToDo: [
        'Go back to Source Data and confirm the client profile is standardized.',
        'Review each bureau and make sure the accounts or inquiries are present under the correct sections.',
        'Add missing Affidavit state/county or FTC affected account details if this packet requires them.'
      ],
      technicalDetails
    };
  }

  if (has(lower, /timed out|timeout|aborted|cancelled/)) {
    return {
      id: makeId(),
      severity: 'warning',
      category: 'GENERATION',
      suggestedPanel: 'Source Data',
      title: 'Generation took too long',
      headline: 'The action timed out before the package finished.',
      mainCause: 'The browser or server did not finish the generation step within the allowed time.',
      whatToDo: [
        'Try Generate again once.',
        'If the template is very large, simplify images/tables and retry.',
        'Refresh the page if the workspace appears stuck.'
      ],
      technicalDetails
    };
  }

  if (has(lower, /failed to fetch|network|not saved|could not load|response not ok|storage|supabase|server|api/)) {
    return {
      id: makeId(),
      severity: 'error',
      category: 'NETWORK',
      suggestedPanel: context.panel === 'Templates' ? 'Templates' : 'Source Data',
      title: 'Connection or storage problem',
      headline: 'The website could not finish a network or storage request.',
      mainCause: 'A required file or server request did not complete, so the action stopped.',
      whatToDo: [
        'Check your connection and refresh the page.',
        'Try the same action again.',
        'If it happens again, re-upload the affected file or template.'
      ],
      technicalDetails
    };
  }

  if (has(lower, /limit|entitlement|quota|account pending|access denied|unauthorized|forbidden/)) {
    return {
      id: makeId(),
      severity: 'error',
      category: 'ACCOUNT',
      suggestedPanel: 'Settings',
      title: 'Account or access issue',
      headline: 'Your account cannot complete this action right now.',
      mainCause: 'The action may be blocked by access, entitlement, or account limits.',
      whatToDo: [
        'Check your account status in Settings.',
        'Try again after your output limit resets if this is a limit issue.',
        'Contact an admin if your account should already have access.'
      ],
      technicalDetails
    };
  }

  return {
    id: makeId(),
    severity: 'error',
    category: 'SYSTEM',
    suggestedPanel: context.panel === 'Settings' ? 'Settings' : 'Source Data',
    title: 'Action could not continue',
    headline: `${operation} stopped before it finished.`,
    mainCause: 'The website hit an unexpected problem and stopped the action to avoid creating an incomplete package.',
    whatToDo: [
      'Review the message below for the specific cause.',
      'Try the action again after checking the current template and source data.',
      'If it repeats, copy the technical details and send them for troubleshooting.'
    ],
    technicalDetails
  };
}
