import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/common/entities/base.entity';
import { AUTH_PROVIDERS } from 'src/common/constants/constants';
import { ACCOUNT_TYPE, Gender, INTERESTS } from 'src/common/enum/enum.common';
import { SavedPost } from 'src/modules/post/entities/saved-post.entity';
import { PostTag } from 'src/modules/post/entities/post-tag.entity';
import { Post } from 'src/modules/post/entities/post.entity';
import { Follow } from 'src/modules/follow/entities/follow.entity';

@Entity('users')
@Index(['email', 'isVerified'])
@Index(['phone', 'isVerified'])
@Index(['username', 'isVerified'])
@Index(['provider', 'providerId'], {unique: true, where: `"providerId" IS NOT NULL`})
export class User extends BaseEntity {
  @Column({ nullable: true, unique: true })
  email: string;

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

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ type: 'smallint', nullable: true })
  gender: Gender;

  @Column({ nullable: true, select: false })
  password: string;

  @Column({
    type: 'enum',
    enum: AUTH_PROVIDERS,
    default: AUTH_PROVIDERS.LOCAL,
  })
  provider: AUTH_PROVIDERS;

  @Column({ nullable: true })
  @Index()
  providerId: string;

  @Column({ nullable: true, length: 150 })
  bio: string;

  @Column({ nullable: true })
  profilePicture: string;

  @Column({ default: false })
  isPrivate: boolean;

  @Column({ default: 0 })
  postsCount: number;

  @Column({ default: 0 })
  followersCount: number;

  @Column({ default: 0 })
  followingCount: number;

  @Column({ default: true })
  showSuggestions: boolean;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  pronouns: string;

  @Column({
    type: 'enum',
    enum: ACCOUNT_TYPE,
    nullable: true,
  })
  accountType: ACCOUNT_TYPE;

  @Column('text', { array: true, default: [] })
  interests: string[];

  // RELATIONS
  @OneToMany(() => Post, (post) => post.user)
  posts: Post[];

  @OneToMany(() => SavedPost, (sp) => sp.user)
  savedPosts: SavedPost[];

  @OneToMany(() => PostTag, (pt) => pt.user)
  taggedPosts: PostTag[];

  // People who follow me
  @OneToMany(() => Follow, (f) => f.following)
  followers: Follow[];

  // People I follow
  @OneToMany(() => Follow, (f) => f.follower)
  following: Follow[];
}
