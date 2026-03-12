import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { AttemptStatus, AttemptType } from 'src/common/enum/auth-attempt.enum';

@Entity('auth_attempts')
export class AuthAttempt extends BaseEntity {
  @Index()
  @Column({ nullable: true })
  email: string;

  @Index()
  @Column({ nullable: true })
  phone: string;

  @Column({
    type: 'enum',
    enum: AttemptType,
  })
  attemptType: AttemptType;

  @Column({
    type: 'enum',
    enum: AttemptStatus,
  })
  status: AttemptStatus;
}
