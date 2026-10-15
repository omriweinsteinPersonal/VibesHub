export function assertNativeOAuthRedirect(
  authorizationUrl: string,
  expectedRedirectUrl: string,
): void {
  let redirectUrl: string | null;

  try {
    redirectUrl = new URL(authorizationUrl).searchParams.get('redirect_to');
  } catch {
    throw new Error('Google sign-in returned an invalid authorization URL.');
  }

  if (redirectUrl !== expectedRedirectUrl) {
    throw new Error(
      'Google sign-in is not configured to return to the Swavii app. Please try again later.',
    );
  }
}
