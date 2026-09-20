import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RendezvousController } from './rendezvous.controller';
import { RendezvousService } from './rendezvous.service';

@Module({
  imports: [PrismaModule],
  controllers: [RendezvousController],
  providers: [RendezvousService],
})
export class RendezvousModule {}
