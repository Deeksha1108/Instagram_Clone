import { BaseEntity } from 'src/common/entities/base.entity';
import { User } from 'src/modules/user/entities/user.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { SavedPost } from './saved-post.entity';
import { PostTag } from './post-tag.entity';

@Entity('posts')
@Index(['userId', 'createdAt', 'id'])
export class Post extends BaseEntity {
  @Column({ name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, (user) => user.posts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  imageUrl: string;

  @OneToMany(() => SavedPost, (sp) => sp.post)
  savedBy: SavedPost[];

  @OneToMany(() => PostTag, (pt) => pt.post)
  taggedUsers: PostTag[];
}
