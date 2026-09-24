import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type GroupCommentDocument = HydratedDocument<GroupComment>;

@Schema({ collection: 'group_comments', timestamps: true })
export class GroupComment {
  @Prop({ type: Types.ObjectId, ref: 'GroupPost', required: true, index: true })
  postId: Types.ObjectId | string;

  @Prop({ type: Types.ObjectId, ref: 'CommunityGroup', required: true, index: true })
  groupId: Types.ObjectId | string;

  @Prop({ type: Types.ObjectId, ref: 'GroupComment', default: null, index: true })
  parentId?: Types.ObjectId | string;

  @Prop({ default: '' })
  replyToUserName?: string;

  @Prop({ required: true })
  authorId: string;

  @Prop({ required: true })
  authorName: string;

  @Prop({ default: '' })
  authorAvatar: string;

  @Prop({ required: true })
  content: string;

  createdAt: Date;
  updatedAt: Date;
}

export const GroupCommentSchema = SchemaFactory.createForClass(GroupComment);
GroupCommentSchema.index({ postId: 1, createdAt: 1 });
GroupCommentSchema.index({ parentId: 1 });
