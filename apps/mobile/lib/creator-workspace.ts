export type CreatorWorkspaceView =
  'overview' | 'recommendations' | 'storefront' | 'analytics' | 'profile';

export const creatorWorkspaceTabs: readonly {
  key: CreatorWorkspaceView;
  label: string;
}[] = [
  { key: 'overview', label: 'Home' },
  { key: 'recommendations', label: 'Dashboard' },
  { key: 'storefront', label: 'Storefront' },
  { key: 'analytics', label: 'Analytics' },
  { key: 'profile', label: 'Account' },
];
