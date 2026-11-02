import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { USER_CAPABILITIES, UserCapability } from '@backupjam/api-contract';

export class RegisterDto {
  @ApiProperty({ example: 'ayla@example.com' }) @IsEmail() @MaxLength(254) email: string;
  @ApiProperty({ minLength: 10, maxLength: 128 }) @IsString() @Length(1, 256) password: string;
  @ApiProperty({ example: 'Ayla Drums' }) @IsString() @Length(1, 80) displayName: string;
  @ApiPropertyOptional({ description: 'Explicit UI locale. Omit to follow the device language.' }) @IsOptional() @IsString() @MaxLength(35) locale?: string;
  @ApiPropertyOptional({ example: 'TR' }) @IsOptional() @IsString() @Length(2, 2) countryCode?: string;
  @ApiPropertyOptional({ example: 'Europe/Istanbul' }) @IsOptional() @IsString() @MaxLength(64) timeZone?: string;
  @ApiProperty({ description: 'Must be true: user accepts the current Terms and Privacy Policy versions.' }) @IsBoolean() acceptTerms: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() marketingEmails?: boolean;
  @ApiPropertyOptional({ enum: USER_CAPABILITIES, isArray: true })
  @IsOptional() @IsArray() @IsIn(USER_CAPABILITIES as unknown as string[], { each: true }) capabilities?: UserCapability[];
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) deviceName?: string;
}

export class LoginDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email: string;
  @ApiProperty() @IsString() @Length(1, 256) password: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) deviceName?: string;
}

export class RefreshDto {
  @ApiProperty() @IsString() @Length(10, 200) refreshToken: string;
}

export class TokenDto {
  @ApiProperty() @IsString() @Length(10, 200) token: string;
}

export class EmailDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email: string;
}

export class ResetPasswordDto {
  @ApiProperty() @IsString() @Length(10, 200) token: string;
  @ApiProperty() @IsString() @Length(1, 256) newPassword: string;
}

export class SocialLoginDto {
  @ApiProperty({ description: 'OIDC ID token obtained by the client from Google / Apple' }) @IsString() @Length(20, 8192) idToken: string;
  @ApiPropertyOptional({ description: 'Raw nonce used for the request (Apple; recommended for Google)' }) @IsOptional() @IsString() @MaxLength(256) nonce?: string;
  @ApiPropertyOptional({ description: 'Apple only returns the name on first sign-in; the client forwards it.' }) @IsOptional() @IsString() @Length(1, 80) displayName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(35) locale?: string;
  @ApiPropertyOptional({ description: 'Required for first-time sign-up via social login.' }) @IsOptional() @IsBoolean() acceptTerms?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) deviceName?: string;
}
