export function selectPostgresTests(mode: string, files?: string[]): string[];
export function parseLocalDatabaseUrl(value: unknown): URL;
export function runPostgresTests(mode: string, files?: string[], env?: NodeJS.ProcessEnv): number;
