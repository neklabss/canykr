import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';
import { STAFF_ROLES, StaffRole } from '@backupjam/api-contract';

export class ListQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) q?: string;
  @ApiPropertyOptional({ enum: ['active', 'suspended', 'pending_deletion', 'deleted'] }) @IsOptional() @IsIn(['active', 'suspended', 'pending_deletion', 'deleted']) status?: string;
  @ApiPropertyOptional({ description: 'Opaque cursor from a previous page' }) @IsOptional() @IsString() @MaxLength(200) cursor?: string;
  @ApiPropertyOptional({ default: 25 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class AuditQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) action?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) targetType?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) targetId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) beforeId?: number;
  @ApiPropertyOptional({ default: 50 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limit?: number;
}

export class SuspendDto {
  @ApiProperty() @IsString() @Length(3, 500) reason: string;
}

export class FlagUpdateDto {
  @ApiProperty() @IsBoolean() enabled: boolean;
  @ApiPropertyOptional({ example: { countries: ['TR'] } }) @IsOptional() @IsObject() rules?: Record<string, unknown>;
}

export class CountryUpdateDto {
  @ApiPropertyOptional({ enum: ['hidden', 'beta', 'live'] }) @IsOptional() @IsIn(['hidden', 'beta', 'live']) launchStatus?: 'hidden' | 'beta' | 'live';
  @ApiPropertyOptional() @IsOptional() @IsBoolean() paymentsEnabled?: boolean;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString() @MaxLength(60) paymentProvider?: string | null;
}

export class GrantStaffDto {
  @ApiProperty() @IsString() @Length(36, 36) userId: string;
  @ApiProperty({ enum: STAFF_ROLES }) @IsIn(STAFF_ROLES as unknown as string[]) role: StaffRole;
}
