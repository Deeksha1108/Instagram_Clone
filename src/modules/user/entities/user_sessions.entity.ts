import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { User } from './user.entity';

@Entity('user_sessions')
export class UserSession extends BaseEntity {
  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column()
  userId: string;

  @Index()
  @Column({ unique: true })
  sessionId: string;

  @Column({ nullable: true })
  device: string;

  @Column({ type: 'timestamp' })
  loginAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: true })
  isActive: boolean;
}
