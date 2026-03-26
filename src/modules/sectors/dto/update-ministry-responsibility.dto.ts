import { PartialType } from '@nestjs/swagger';
import { CreateMinistryResponsibilityDto } from './create-ministry-responsibility.dto';

export class UpdateMinistryResponsibilityDto extends PartialType(CreateMinistryResponsibilityDto) {}
