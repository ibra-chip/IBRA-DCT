import * as fs from 'node:fs';
import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { imageDiskUploadOptions, imageMemoryUploadOptions } from '../common/upload.util';
import { WorkReportsService } from './work-reports.service';
import { CreateWorkReportDto, EstimateQuantityDto, UpdateWorkReportStatusDto } from './dto';

@ApiTags('work-reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('projects/:projectId/work-reports')
export class WorkReportsController {
  constructor(private readonly workReportsService: WorkReportsService) {}

  @Get()
  @ApiOperation({ summary: 'List work reports for a project (own reports for non-managers)' })
  findAll(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workReportsService.findAll(projectId, user);
  }

  @Post('estimate-quantity')
  @UseInterceptors(FileInterceptor('photo', imageMemoryUploadOptions))
  @ApiOperation({ summary: 'Estimate the m²/ml quantity shown in a work photo' })
  estimateQuantity(
    @Param('projectId') projectId: string,
    @Body() dto: EstimateQuantityDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workReportsService.estimateQuantity(projectId, user, dto.quantityUnit, file);
  }

  @Post()
  @UseInterceptors(FileInterceptor('photo', imageDiskUploadOptions))
  @ApiOperation({ summary: 'Submit a daily work report with a quantity and photo evidence' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateWorkReportDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workReportsService.create(projectId, user, dto, file);
  }

  @Patch(':reportId/status')
  @ApiOperation({ summary: 'Approve or reject a work report' })
  updateStatus(
    @Param('projectId') projectId: string,
    @Param('reportId') reportId: string,
    @Body() dto: UpdateWorkReportStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workReportsService.updateStatus(projectId, reportId, user, dto);
  }

  @Get(':reportId/photo')
  @ApiOperation({ summary: 'Download a work report photo' })
  async downloadPhoto(
    @Param('projectId') projectId: string,
    @Param('reportId') reportId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const { filePath } = await this.workReportsService.getPhotoPath(projectId, reportId, user);
    if (!fs.existsSync(filePath)) throw new NotFoundException('The photo is no longer available');
    response.sendFile(filePath);
  }
}

@ApiTags('work-reports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('projects/:projectId/situation-summary')
export class SituationSummaryController {
  constructor(private readonly workReportsService: WorkReportsService) {}

  @Get()
  @ApiOperation({ summary: 'Aggregate approved work report quantities/amounts for a project' })
  get(
    @Param('projectId') projectId: string,
    @Query('month') month: string | undefined,
    @Query('date') date: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.workReportsService.situationSummary(projectId, user, month, date);
  }
}
