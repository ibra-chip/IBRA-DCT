import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ChecklistsController } from './checklists.controller';
import { ChecklistsService } from './checklists.service';

@Module({
  imports: [PrismaModule],
  controllers: [ChecklistsController],
  providers: [ChecklistsService],
})
export class ChecklistsModule {}
