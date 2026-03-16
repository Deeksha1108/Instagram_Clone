import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { AUTH_PROVIDERS } from 'src/common/constants/constants';

@Entity('users')
export class User extends BaseEntity {
  @Index()
  @Column({ nullable: true, unique: true })
  email: string;

  @Index()
  @Column({ nullable: true, unique: true })
  phone: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ nullable: true })
  fullName: string;

  @Index()
  @Column({ unique: true, nullable: true })
  username: string;

  @Column({ nullable: true })
  age: number;

  @Column({ nullable: true })
  gender: string;

  @Column({ nullable: true, select: false })
  password: string;

  @Column({ nullable: true, unique: true })
  facebookId: string;

  @Column({
    type: 'enum',
    enum: AUTH_PROVIDERS,
    default: AUTH_PROVIDERS.LOCAL,
  })
  provider: AUTH_PROVIDERS;
}
