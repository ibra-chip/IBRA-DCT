import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BudgetModule } from './budget/budget.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { DocumentsModule } from './documents/documents.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { WorkReportsModule } from './work-reports/work-reports.module';

@Module({
  imports: [PrismaModule, AuthModule, ProjectsModule, DocumentsModule, ChecklistsModule, BudgetModule, WorkReportsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
