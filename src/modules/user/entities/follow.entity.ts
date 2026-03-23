import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('follows')
@Unique(['followerId', 'followingId'])
export class Follow extends BaseEntity {
  @Index()
  @Column()
  followerId: string;

  @Index()
  @Column()
  followingId: string;
}