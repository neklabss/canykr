import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { StaffGuard } from './staff.guard';

@Module({ imports: [AuthModule], controllers: [AdminController], providers: [StaffGuard] })
export class AdminModule {}
