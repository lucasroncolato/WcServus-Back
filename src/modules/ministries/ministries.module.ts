import { Module } from '@nestjs/common';
import { SectorsModule } from '../sectors/sectors.module';
import { MinistriesController } from './ministries.controller';

@Module({
  imports: [SectorsModule],
  controllers: [MinistriesController],
})
export class MinistriesModule {}
