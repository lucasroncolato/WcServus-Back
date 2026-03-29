import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from 'src/common/decorators/public.decorator';
import { PublicOnboardingChurchDto, PublicOnboardingSetupDto } from './dto/public-onboarding.dto';
import { PublicOnboardingService } from './public-onboarding.service';

@ApiTags('Public Onboarding')
@Public()
@Controller('public/onboarding')
export class PublicOnboardingController {
  constructor(private readonly service: PublicOnboardingService) {}

  @Post('church')
  createChurch(@Body() dto: PublicOnboardingChurchDto) {
    return this.service.createChurch(dto);
  }

  @Post('setup')
  setup(@Body() dto: PublicOnboardingSetupDto) {
    return this.service.setup(dto);
  }
}
