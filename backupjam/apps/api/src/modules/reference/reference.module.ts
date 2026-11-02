import { Module } from '@nestjs/common';
import { I18nController, ReferenceController } from './reference.controller';

@Module({ controllers: [I18nController, ReferenceController] })
export class ReferenceModule {}
