export const databaseSchemas = ['app', 'analytics', 'audit', 'ops', 'search'] as const;
export type DatabaseSchema = (typeof databaseSchemas)[number];
