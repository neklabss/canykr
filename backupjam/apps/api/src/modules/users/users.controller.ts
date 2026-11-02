import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, Req } from '../../common/decorators';
import { AppRequest, AuthContext } from '../../common/request-context';
import { clientMeta } from '../auth/auth.controller';
import { CapabilitiesDto, ConsentDto, DeleteAccountDto, OnboardingDto, UpdatePreferencesDto, UpdateProfileDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller('v1/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get() me(@Auth() a: AuthContext, @Req() req: AppRequest) { return this.users.getMe(a.userId, clientMeta(req)); }

  @Patch() update(@Auth() a: AuthContext, @Body() dto: UpdateProfileDto, @Req() req: AppRequest) {
    return this.users.updateProfile(a.userId, dto, clientMeta(req));
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Language, country, display currency, time zone, theme, quiet hours. locale=null → automatic.' })
  prefs(@Auth() a: AuthContext, @Body() dto: UpdatePreferencesDto, @Req() req: AppRequest) {
    return this.users.updatePreferences(a.userId, dto, clientMeta(req));
  }

  @Put('capabilities')
  caps(@Auth() a: AuthContext, @Body() dto: CapabilitiesDto, @Req() req: AppRequest) {
    return this.users.setCapabilities(a.userId, dto.capabilities, clientMeta(req));
  }

  @Get('onboarding') getOnboarding(@Auth() a: AuthContext) { return this.users.getOnboarding(a.userId); }

  @Put('onboarding')
  @ApiOperation({ summary: 'Save onboarding answers (all optional; partial updates allowed)' })
  saveOnboarding(@Auth() a: AuthContext, @Body() dto: OnboardingDto) { return this.users.saveOnboarding(a.userId, dto); }

  @Get('consents') consents(@Auth() a: AuthContext) { return this.users.listConsents(a.userId); }

  @Post('consents') consent(@Auth() a: AuthContext, @Body() dto: ConsentDto, @Req() req: AppRequest) {
    return this.users.recordConsent(a.userId, dto, clientMeta(req));
  }

  @Delete() @HttpCode(202)
  @ApiOperation({ summary: 'Request account deletion (30-day grace period; signing in cancels)' })
  delete(@Auth() a: AuthContext, @Body() dto: DeleteAccountDto, @Req() req: AppRequest) {
    return this.users.requestDeletion(a.userId, dto.password, clientMeta(req));
  }
}
