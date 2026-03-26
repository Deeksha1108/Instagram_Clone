import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Follow } from './entities/follow.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Follow])],
  exports: [TypeOrmModule],
})
export class FollowModule {}