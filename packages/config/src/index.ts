export function requireEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  name: string,
): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
