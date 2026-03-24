import { BaseEntity } from 'src/common/entities/base.entity';
import { User } from 'src/modules/user/entities/user.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

@Entity('follows')
@Index(['followerId', 'followingId'], { unique: true })
@Index(['followingId', 'createdAt', 'id'])
@Index(['followerId', 'createdAt', 'id'])
export class Follow extends BaseEntity {
  @Column()
  followerId: string;

  @Column()
  followingId: string;

  // User being followed
  @ManyToOne(() => User, (user) => user.followers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followingId' })
  following: User;

  // User who follows
  @ManyToOne(() => User, (user) => user.following, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'followerId' })
  follower: User;
}