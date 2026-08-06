export const capabilities = [
  'shopper:read',
  'shopper:save',
  'creator:manage_profile',
  'creator:manage_content',
  'creator:view_analytics',
  'moderator:review_content',
  'admin:manage_platform',
] as const;

export type Capability = (typeof capabilities)[number];

export function hasCapability(
  grantedCapabilities: ReadonlySet<Capability>,
  requiredCapability: Capability,
): boolean {
  return (
    grantedCapabilities.has('admin:manage_platform') ||
    grantedCapabilities.has(requiredCapability)
  );
}
