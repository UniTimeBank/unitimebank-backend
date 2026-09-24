import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type GroupPostDocument = HydratedDocument<GroupPost>;

@Schema({ collection: 'group_posts', timestamps: true })
export class GroupPost {
  @Prop({ type: Types.ObjectId, ref: 'CommunityGroup', required: true, index: true })
  groupId: Types.ObjectId | string;

  @Prop({ required: true, index: true })
  authorId: string;

  @Prop({ required: true })
  authorName: string;

  @Prop({ default: '' })
  authorAvatar: string;

  @Prop({ default: 'Thành viên' })
  authorHeadline: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ default: 'GENERAL' }) // 'QA' | 'DOCUMENT' | 'STUDY_BUDDY' | 'GENERAL'
  tag: string;

  @Prop({ type: [String], default: [] })
  likes: string[]; // userIds

  @Prop({ default: 0 })
  commentsCount: number;

  @Prop({ default: false })
  isPinned: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const GroupPostSchema = SchemaFactory.createForClass(GroupPost);
GroupPostSchema.index({ groupId: 1, isPinned: -1, createdAt: -1 });
