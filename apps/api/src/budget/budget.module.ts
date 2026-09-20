import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { BudgetController } from './budget.controller';
import { PurchasesController } from './purchases.controller';
import { BudgetService } from './budget.service';

@Module({
  imports: [PrismaModule],
  controllers: [BudgetController, PurchasesController],
  providers: [BudgetService],
})
export class BudgetModule {}
