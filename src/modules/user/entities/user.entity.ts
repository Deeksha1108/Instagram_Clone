import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';

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

  @Column({ unique: true, nullable: true })
  username: string;

  @Column({ nullable: true })
  age: number;

  @Column({ nullable: true })
  gender: string;

  @Column({ nullable: true, select: false })
  password: string;
}
