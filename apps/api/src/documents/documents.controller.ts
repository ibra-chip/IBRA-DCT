import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateDocumentDto } from './dto';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('projects/:projectId/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List project documents in the current company' })
  findAll(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.findByProject(projectId, user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a document record in the current company' })
  create(@Param('projectId') projectId: string, @Body() dto: CreateDocumentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.create(projectId, dto, user);
  }
}
