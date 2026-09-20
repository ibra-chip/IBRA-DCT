import * as fs from 'node:fs';
import { Body, Controller, Get, NotFoundException, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { BudgetService } from './budget.service';
import { CreateBudgetDto } from './dto';
import { budgetDiskUploadOptions, budgetMemoryUploadOptions } from './upload.config';

@ApiTags('budget')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('projects/:projectId/budget')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get()
  @ApiOperation({ summary: 'Get the current devis budget for a project' })
  getBudget(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetService.getBudget(projectId, user);
  }

  @Get('financial-summary')
  @ApiOperation({ summary: 'Get spent/remaining breakdown for a project' })
  financialSummary(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetService.financialSummary(projectId, user);
  }

  @Post('inspect')
  @UseInterceptors(FileInterceptor('file', budgetMemoryUploadOptions))
  @ApiOperation({ summary: 'Auto-extract devis fields from an uploaded PDF' })
  inspectDevis(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.budgetService.inspectDevis(projectId, user, file);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', budgetDiskUploadOptions))
  @ApiOperation({ summary: 'Create or replace the project budget from a confirmed devis' })
  createBudget(
    @Param('projectId') projectId: string,
    @Body() dto: CreateBudgetDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.budgetService.createBudget(projectId, user, dto, file);
  }

  @Get('document')
  @ApiOperation({ summary: 'Download the stored devis PDF' })
  async downloadDevis(
    @Param('projectId') projectId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const { filePath } = await this.budgetService.getBudgetDocumentPath(projectId, user);
    if (!fs.existsSync(filePath)) throw new NotFoundException('The devis document is no longer available');
    response.sendFile(filePath);
  }
}
