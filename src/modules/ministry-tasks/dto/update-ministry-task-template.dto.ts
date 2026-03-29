import { PartialType } from '@nestjs/swagger';
import { CreateMinistryTaskTemplateDto } from './create-ministry-task-template.dto';

export class UpdateMinistryTaskTemplateDto extends PartialType(CreateMinistryTaskTemplateDto) {}
