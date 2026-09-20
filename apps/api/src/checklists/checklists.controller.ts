import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateChecklistDto } from './dto';
import { ChecklistsService } from './checklists.service';

@ApiTags('checklists')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('projects/:projectId/checklists')
export class ChecklistsController {
  constructor(private readonly checklistsService: ChecklistsService) {}

  @Get()
  @ApiOperation({ summary: 'List checklists for a project in the current company' })
  findAll(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.checklistsService.findByProject(projectId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a checklist with validation items' })
  create(@Param('projectId') projectId: string, @Body() dto: CreateChecklistDto, @CurrentUser() user: AuthenticatedUser) {
    return this.checklistsService.create(projectId, dto, user);
  }
}
