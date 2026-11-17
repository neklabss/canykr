import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { ORG_ROLES, ORGANIZATION_TYPES, OrgRole, OrganizationType } from '@backupjam/api-contract';

export class CreateOrganizationDto {
  @ApiProperty({ enum: ORGANIZATION_TYPES }) @IsIn(ORGANIZATION_TYPES as unknown as string[]) type: OrganizationType;
  @ApiProperty() @IsString() @Length(1, 120) name: string;
  @ApiProperty({ pattern: '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$' }) @Matches(/^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$/) slug: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^[A-Z]{2}$/) countryCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 120) city?: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 120) name?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^[A-Z]{2}$/) countryCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 120) city?: string;
}

export class InviteMemberDto {
  @ApiProperty() @IsEmail() @MaxLength(254) email: string;
  @ApiProperty({ enum: ORG_ROLES }) @IsIn(ORG_ROLES as unknown as string[]) role: OrgRole;
  @ApiPropertyOptional({ example: 'Drummer' }) @IsOptional() @IsString() @Length(1, 80) title?: string;
}

export class UpdateMemberDto {
  @ApiProperty({ enum: ORG_ROLES }) @IsIn(ORG_ROLES as unknown as string[]) role: OrgRole;
}
