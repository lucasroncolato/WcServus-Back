import { ApiProperty } from '@nestjs/swagger';
import { MinistryTaskAssigneeRole } from '@prisma/client';
import { IsEnum, IsString } from 'class-validator';

export class AddMinistryTaskOccurrenceAssigneeDto {
  @ApiProperty()
  @IsString()
  servantId: string;

  @ApiProperty({ enum: MinistryTaskAssigneeRole, default: MinistryTaskAssigneeRole.SUPPORT })
  @IsEnum(MinistryTaskAssigneeRole)
  role: MinistryTaskAssigneeRole;
}
