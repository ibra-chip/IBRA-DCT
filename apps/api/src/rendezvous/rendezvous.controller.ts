import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { RendezvousService } from './rendezvous.service';
import { CreateRendezvousDto, UpdateRendezvousDto } from './dto';

@ApiTags('rendezvous')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('projects/:projectId/rendezvous')
export class RendezvousController {
  constructor(private readonly rendezvousService: RendezvousService) {}

  @Get()
  @ApiOperation({ summary: 'List absences/rendez-vous for a project (own entries for non-managers)' })
  findAll(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.rendezvousService.findAll(projectId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Declare an absence/rendez-vous at least 3 days ahead' })
  create(@Param('projectId') projectId: string, @Body() dto: CreateRendezvousDto, @CurrentUser() user: AuthenticatedUser) {
    return this.rendezvousService.create(projectId, user, dto);
  }

  @Patch(':rendezvousId')
  @ApiOperation({ summary: 'Correct the date/time of an existing rendez-vous' })
  update(
    @Param('projectId') projectId: string,
    @Param('rendezvousId') rendezvousId: string,
    @Body() dto: UpdateRendezvousDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rendezvousService.update(projectId, rendezvousId, user, dto);
  }
}
