import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { WorkReportsController, SituationSummaryController } from './work-reports.controller';
import { WorkReportsService } from './work-reports.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorkReportsController, SituationSummaryController],
  providers: [WorkReportsService],
})
export class WorkReportsModule {}
