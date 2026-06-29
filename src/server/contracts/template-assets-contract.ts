import type { Round } from '../../../lib/reference-store';

export const templateAssetRounds = ['1st Round', '2nd Round', '3rd Round', 'Final'] as const;

export function parseTemplateAssetRound(value: string | null): Round | null {
  if (!value) return null;
  return templateAssetRounds.includes(value as never) ? value as Round : null;
}

export type TemplateAssetsListInput = {
  round: Round | null;
};

export type TemplateAssetsListPayload = {
  assets: unknown[];
  managerTemplateScope: unknown;
  templateStorage: {
    mode: string;
    mutationMode: string;
    warning: string | null;
  };
};
