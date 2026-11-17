import type { OrgRole, OrganizationType, StaffRole, UserCapability } from './roles';

export type ThemePreference = 'system' | 'light' | 'dark';
export type UserStatus = 'active' | 'suspended' | 'pending_deletion' | 'deleted';

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
  requestId?: string;
}

export interface AuthTokens {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  sessionId: string;
}

export interface MeDto {
  id: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string;
  username: string | null;
  status: UserStatus;
  capabilities: UserCapability[];
  preferences: PreferencesDto;
  staffRole: StaffRole | null;
  createdAt: string;
}

export interface AuthResponse {
  user: MeDto;
  tokens: AuthTokens;
}

export interface PreferencesDto {
  /** null = follow device/browser language automatically. */
  locale: string | null;
  /** Effective locale after negotiation (always a supported tag). */
  effectiveLocale: string;
  countryCode: string | null;
  currencyCode: string | null;
  timeZone: string | null;
  theme: ThemePreference;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export interface OnboardingDto {
  capabilities: UserCapability[];
  instruments: string[];
  genres: string[];
  homeCountryCode: string | null;
  homeCity: string | null;
  location: { lat: number; lng: number } | null;
  availableForBookings: boolean | null;
  discoverGoals: Array<'musicians' | 'jobs' | 'venues' | 'events'>;
  languages: string[];
  travelCountryCodes: string[];
  travelRadiusKm: number | null;
  skippedSteps: string[];
  completedAt: string | null;
}

export interface SessionDto {
  id: string;
  deviceName: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export interface OrganizationDto {
  id: string;
  type: OrganizationType;
  name: string;
  slug: string;
  countryCode: string | null;
  city: string | null;
  status: 'active' | 'suspended';
  createdAt: string;
  myRole?: OrgRole | null;
}

export interface MembershipDto {
  userId: string;
  displayName: string;
  role: OrgRole;
  status: 'invited' | 'active';
  createdAt: string;
}

export interface LocaleDto {
  tag: string;
  name: string;
  nativeName: string;
  dir: 'ltr' | 'rtl';
  status: 'reviewed' | 'machine_draft';
}

export interface CountryDto {
  code: string;
  name: string;
  defaultCurrency: string;
  defaultLocale: string;
  launchStatus: 'hidden' | 'beta' | 'live';
  paymentsEnabled: boolean;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}
