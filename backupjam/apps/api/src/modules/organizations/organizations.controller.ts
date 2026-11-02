import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth, Public, Req } from '../../common/decorators';
import { AppRequest, AuthContext } from '../../common/request-context';
import { clientMeta } from '../auth/auth.controller';
import { CreateOrganizationDto, InviteMemberDto, UpdateMemberDto, UpdateOrganizationDto } from './organizations.dto';
import { OrganizationsService } from './organizations.service';

@ApiTags('organizations')
@ApiBearerAuth()
@Controller('v1/organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Post() @ApiOperation({ summary: 'Create a band / venue / agency / organizer / company profile (creator becomes owner)' })
  create(@Auth() a: AuthContext, @Body() dto: CreateOrganizationDto, @Req() req: AppRequest) { return this.orgs.create(a.userId, dto, clientMeta(req)); }

  @Get('mine') mine(@Auth() a: AuthContext) { return this.orgs.mine(a.userId); }

  @Get('invitations') invitations(@Auth() a: AuthContext) { return this.orgs.invitations(a.userId); }

  @Public() @Get('by-slug/:slug') bySlug(@Param('slug') slug: string) { return this.orgs.publicBySlug(slug); }

  @Patch(':id') update(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrganizationDto, @Req() req: AppRequest) {
    return this.orgs.update(id, a.userId, dto, clientMeta(req));
  }

  @Get(':id/members') members(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string) { return this.orgs.members(id, a.userId); }

  @Post(':id/members') invite(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Body() dto: InviteMemberDto, @Req() req: AppRequest) {
    return this.orgs.invite(id, a.userId, dto, clientMeta(req));
  }

  @Post(':id/invitation/accept') @HttpCode(204)
  async accept(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Req() req: AppRequest) { await this.orgs.respondToInvitation(id, a.userId, true, clientMeta(req)); }

  @Post(':id/invitation/decline') @HttpCode(204)
  async decline(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Req() req: AppRequest) { await this.orgs.respondToInvitation(id, a.userId, false, clientMeta(req)); }

  @Patch(':id/members/:userId')
  role(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string, @Body() dto: UpdateMemberDto, @Req() req: AppRequest) {
    return this.orgs.changeRole(id, a.userId, userId, dto.role, clientMeta(req));
  }

  @Delete(':id/members/:userId') @HttpCode(204)
  async remove(@Auth() a: AuthContext, @Param('id', ParseUUIDPipe) id: string, @Param('userId', ParseUUIDPipe) userId: string, @Req() req: AppRequest) {
    await this.orgs.removeMember(id, a.userId, userId, clientMeta(req));
  }
}
