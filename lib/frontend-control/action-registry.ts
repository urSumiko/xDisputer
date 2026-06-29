export type ActionOwner = 'global' | 'workspace' | 'component';

export type ActionId =
  | 'click.feedback'
  | 'pending.guard'
  | 'notice.inline'
  | 'search.local'
  | 'sort.local'
  | 'page.server'
  | 'refresh.manual'
  | 'upload.pending'
  | 'validate.beforeSave'
  | 'mark.read'
  | 'navigate.href';

export type ActionContract = {
  id: ActionId;
  owner: ActionOwner;
  singleRun: boolean;
  uiEvent: boolean;
  serverRoundtrip: boolean;
  summary: string;
};

export const actionRegistry: Record<ActionId, ActionContract> = {
  'click.feedback': { id: 'click.feedback', owner: 'global', singleRun: false, uiEvent: true, serverRoundtrip: false, summary: 'Standard action feedback.' },
  'pending.guard': { id: 'pending.guard', owner: 'global', singleRun: true, uiEvent: true, serverRoundtrip: false, summary: 'Prevents duplicate pending actions.' },
  'notice.inline': { id: 'notice.inline', owner: 'global', singleRun: false, uiEvent: true, serverRoundtrip: false, summary: 'Inline status messaging.' },
  'search.local': { id: 'search.local', owner: 'component', singleRun: false, uiEvent: false, serverRoundtrip: false, summary: 'Local collection filtering.' },
  'sort.local': { id: 'sort.local', owner: 'component', singleRun: false, uiEvent: false, serverRoundtrip: false, summary: 'Local collection sorting.' },
  'page.server': { id: 'page.server', owner: 'workspace', singleRun: true, uiEvent: true, serverRoundtrip: true, summary: 'Server-owned pagination.' },
  'refresh.manual': { id: 'refresh.manual', owner: 'workspace', singleRun: true, uiEvent: true, serverRoundtrip: true, summary: 'Manual workspace refresh.' },
  'upload.pending': { id: 'upload.pending', owner: 'workspace', singleRun: true, uiEvent: true, serverRoundtrip: false, summary: 'Upload pending state.' },
  'validate.beforeSave': { id: 'validate.beforeSave', owner: 'global', singleRun: true, uiEvent: true, serverRoundtrip: false, summary: 'Pre-save validation.' },
  'mark.read': { id: 'mark.read', owner: 'workspace', singleRun: true, uiEvent: true, serverRoundtrip: true, summary: 'Mark item as read.' },
  'navigate.href': { id: 'navigate.href', owner: 'global', singleRun: false, uiEvent: true, serverRoundtrip: false, summary: 'Known route navigation.' }
} as const;

export function getActionContract(id: ActionId): ActionContract {
  return actionRegistry[id];
}
