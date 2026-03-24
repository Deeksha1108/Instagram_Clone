import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ConnectionType } from 'src/common/enum/enum.common';

export class GetConnectionsDto {
  @ApiProperty({ enum: ConnectionType })
  @IsEnum(ConnectionType)
  type: ConnectionType;

  @IsOptional()
  cursor?: string;
}