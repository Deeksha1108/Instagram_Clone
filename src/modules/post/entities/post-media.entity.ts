import { BaseEntity } from 'src/common/entities/base.entity';
import { Post } from './post.entity';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { FILE_TYPE } from 'src/common/enum/enum.common';

@Entity('post_media')
@Index(['postId'])
@Index(['postId', 'order'], { unique: true })
export class PostMedia extends BaseEntity {
  @Column({ name: 'post_id' })
  postId!: string;

  @ManyToOne(() => Post, (post) => post.media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'post_id' })
  post!: Post;

  @Column({ type: 'text' })
  key!: string;

  @Column({
    type: 'enum',
    enum: FILE_TYPE,
  })
  type!: FILE_TYPE;

  @Column()
  order!: number;
}
