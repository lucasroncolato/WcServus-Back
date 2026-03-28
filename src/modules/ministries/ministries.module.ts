import { Module } from '@nestjs/common';
import { MinistriesController } from './ministries.controller';
import { MinistriesService } from './ministries.service';

@Module({
  providers: [MinistriesService],
  controllers: [MinistriesController],
})
export class MinistriesModule {}
