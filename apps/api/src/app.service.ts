import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      status: 'ok',
      app: 'IBRA-BA API',
      environment: process.env.NODE_ENV ?? 'development',
      commit: process.env.RENDER_GIT_COMMIT ?? null,
    };
  }
}
