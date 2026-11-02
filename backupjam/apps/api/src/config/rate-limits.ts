/** Runtime-resolved limits (set from validated env in createApp) so decorators need no env access. */
export const rateLimits = { default: 120, auth: 10 };
export const AUTH_THROTTLE = { default: { limit: () => rateLimits.auth, ttl: 60_000 } };
