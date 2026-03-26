import { Column, Entity, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { User } from './user.entity';
import { AUTH_PROVIDERS } from 'src/common/constants/constants';

@Entity('user_sessions')
@Index(['sessionId', 'isActive'])
export class UserSession extends BaseEntity {
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
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

  @Column({
    type: 'enum',
    enum: AUTH_PROVIDERS,
    default: AUTH_PROVIDERS.LOCAL,
  })
  loginProvider: AUTH_PROVIDERS;

  @Column({ type: 'timestamp' })
  loginAt: Date;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  @Column({ default: true })
  isActive: boolean;
}
