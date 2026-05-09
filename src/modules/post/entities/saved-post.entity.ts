import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { Post } from './post.entity';
import { User } from 'src/modules/user/entities/user.entity';
import { BaseEntity } from 'src/common/entities/base.entity';

@Entity('saved_posts')
@Index(['userId', 'postId'], { unique: true })
export class SavedPost extends BaseEntity {
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'post_id' })
  postId!: string;

  @ManyToOne(() => User, (user) => user.savedPosts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Post, (post) => post.savedBy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post!: Post;
}