import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateDocumentDto } from './dto';
import { DocumentsService } from './documents.service';

@ApiTags('documents')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('projects/:projectId/documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List project documents' })
  findAll(@Param('projectId') projectId: string) {
    return this.documentsService.findByProject(projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a document record' })
  create(@Param('projectId') projectId: string, @Body() dto: CreateDocumentDto) {
    return this.documentsService.create(projectId, dto);
  }
}
