import { Controller, Get, Module } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Db } from '../../database/db';
import { Public } from '../../common/decorators';
import { AppError } from '../../common/app-error';

@ApiTags('health')
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly db: Db) {}

  @Public() @Get('live') live() { return { status: 'ok' }; }

  @Public() @Get('ready')
  async ready() {
    try {
      await this.db.query('SELECT 1');
    } catch {
      throw new AppError('internal', 503);
    }
    return { status: 'ok', checks: { database: 'ok' } };
  }
}

@Module({ controllers: [HealthController] })
export class HealthModule {}
