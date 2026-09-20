import * as fs from 'node:fs';
import { Body, Controller, Get, NotFoundException, Param, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { CurrentUser } from '../common/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { BudgetService } from './budget.service';
import { CreatePurchaseDto } from './dto';
import { budgetDiskUploadOptions, budgetMemoryUploadOptions } from './upload.config';

@ApiTags('purchases')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('projects/:projectId/purchases')
export class PurchasesController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get()
  @ApiOperation({ summary: 'List factures (purchases) logged against a project' })
  findAll(@Param('projectId') projectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.budgetService.listPurchases(projectId, user);
  }

  @Post('inspect')
  @UseInterceptors(FileInterceptor('file', budgetMemoryUploadOptions))
  @ApiOperation({ summary: 'Auto-extract invoice fields from an uploaded facture PDF' })
  inspectInvoice(
    @Param('projectId') projectId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.budgetService.inspectInvoice(projectId, user, file);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file', budgetDiskUploadOptions))
  @ApiOperation({ summary: 'Log a facture (material, tools, machines, workers, subcontracting, other)' })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePurchaseDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.budgetService.createPurchase(projectId, user, dto, file);
  }

  @Get(':purchaseId/invoice')
  @ApiOperation({ summary: 'Download a facture invoice PDF' })
  async downloadInvoice(
    @Param('projectId') projectId: string,
    @Param('purchaseId') purchaseId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const { filePath } = await this.budgetService.getPurchaseInvoicePath(projectId, purchaseId, user);
    if (!fs.existsSync(filePath)) throw new NotFoundException('The invoice document is no longer available');
    response.sendFile(filePath);
  }
}
