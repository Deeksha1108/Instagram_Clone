import { BaseEntity } from 'src/common/entities/base.entity';
import { User } from 'src/modules/user/entities/user.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Post } from './post.entity';

@Entity('post_tags')
@Index(['userId', 'postId'], { unique: true })
export class PostTag extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'post_id' })
  postId!: string;

  @ManyToOne(() => User, (user) => user.taggedPosts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Post, (post) => post.taggedUsers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post!: Post;
}