import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsLatitude, IsLongitude, IsOptional, IsString, Length, Matches, Max, MaxLength, Min, ValidateIf, ValidateNested,
} from 'class-validator';
import { USER_CAPABILITIES, UserCapability } from '@backupjam/api-contract';

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 80) displayName?: string;
  @ApiPropertyOptional({ pattern: '^[a-z0-9_.]{3,30}$' }) @IsOptional() @Matches(/^[a-z0-9_.]{3,30}$/) username?: string;
}

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ nullable: true, description: 'UI locale; null = follow device/browser' })
  @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(35) locale?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(/^[A-Z]{2}$/) countryCode?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(/^[A-Z]{3}$/) currencyCode?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @MaxLength(64) timeZone?: string | null;
  @ApiPropertyOptional({ enum: ['system', 'light', 'dark'] }) @IsOptional() @IsIn(['system', 'light', 'dark']) theme?: 'system' | 'light' | 'dark';
  @ApiPropertyOptional({ nullable: true, example: '22:00' }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) quietHoursStart?: string | null;
  @ApiPropertyOptional({ nullable: true, example: '08:00' }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) quietHoursEnd?: string | null;
}

export class CapabilitiesDto {
  @ApiProperty({ enum: USER_CAPABILITIES, isArray: true })
  @IsArray() @ArrayMaxSize(13) @IsIn(USER_CAPABILITIES as unknown as string[], { each: true }) capabilities: UserCapability[];
}

class LatLngDto {
  @ApiProperty() @IsLatitude() lat: number;
  @ApiProperty() @IsLongitude() lng: number;
}

/** Every onboarding field is optional — users may skip any question. */
export class OnboardingDto {
  @ApiPropertyOptional({ enum: USER_CAPABILITIES, isArray: true }) @IsOptional() @IsArray() @IsIn(USER_CAPABILITIES as unknown as string[], { each: true }) capabilities?: UserCapability[];
  @ApiPropertyOptional({ isArray: true, example: ['drums'] }) @IsOptional() @IsArray() @ArrayMaxSize(30) @Matches(/^[a-z0-9_]+$/, { each: true }) instruments?: string[];
  @ApiPropertyOptional({ isArray: true, example: ['jazz'] }) @IsOptional() @IsArray() @ArrayMaxSize(30) @Matches(/^[a-z0-9_]+$/, { each: true }) genres?: string[];
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @Matches(/^[A-Z]{2}$/) homeCountryCode?: string | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsString() @Length(1, 120) homeCity?: string | null;
  @ApiPropertyOptional({ type: LatLngDto, nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @ValidateNested() @Type(() => LatLngDto) location?: LatLngDto | null;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsBoolean() availableForBookings?: boolean | null;
  @ApiPropertyOptional({ isArray: true, enum: ['musicians', 'jobs', 'venues', 'events'] }) @IsOptional() @IsArray() @IsIn(['musicians', 'jobs', 'venues', 'events'], { each: true }) discoverGoals?: Array<'musicians' | 'jobs' | 'venues' | 'events'>;
  @ApiPropertyOptional({ isArray: true, example: ['tr', 'en'] }) @IsOptional() @IsArray() @ArrayMaxSize(20) @Matches(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/, { each: true }) languages?: string[];
  @ApiPropertyOptional({ isArray: true, example: ['DE', 'NL'] }) @IsOptional() @IsArray() @ArrayMaxSize(60) @Matches(/^[A-Z]{2}$/, { each: true }) travelCountryCodes?: string[];
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() @Min(0) @Max(20000) travelRadiusKm?: number | null;
  @ApiPropertyOptional({ isArray: true }) @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) skippedSteps?: string[];
  @ApiPropertyOptional() @IsOptional() @IsBoolean() complete?: boolean;
}

export class ConsentDto {
  @ApiProperty({ enum: ['marketing_email', 'marketing_push', 'analytics', 'ai_translation'] })
  @IsIn(['marketing_email', 'marketing_push', 'analytics', 'ai_translation']) consentType: string;
  @ApiProperty() @IsBoolean() granted: boolean;
}

export class DeleteAccountDto {
  @ApiPropertyOptional({ description: 'Required when the account has a password' }) @IsOptional() @IsString() @MaxLength(256) password?: string;
}
