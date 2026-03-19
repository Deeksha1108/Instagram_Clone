import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { AUTH_PROVIDERS } from 'src/common/constants/constants';
import { Gender } from 'src/common/enum/enum.common';

@Entity('users')
@Index(['email', 'isVerified'])
@Index(['phone', 'isVerified'])
@Index(['username', 'isVerified'])
export class User extends BaseEntity {
  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ nullable: true })
  fullName: string;

  @Column()
  username: string;

  @Column({ nullable: true })
  age: number;

  @Column({ type: 'smallint', nullable: true })
  gender: Gender;

  @Column({ nullable: true, select: false })
  password: string;

  @Index()
  @Column({ nullable: true })
  facebookId: string;

  @Column({
    type: 'enum',
    enum: AUTH_PROVIDERS,
    default: AUTH_PROVIDERS.LOCAL,
  })
  provider: AUTH_PROVIDERS;
}
