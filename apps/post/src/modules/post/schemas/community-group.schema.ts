import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CommunityGroupDocument = HydratedDocument<CommunityGroup>;

@Schema({ collection: 'community_groups', timestamps: true })
export class CommunityGroup {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true })
  description: string;

  @Prop({ default: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1000&auto=format&fit=crop' })
  coverImage: string;

  @Prop({ default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=400&auto=format&fit=crop' })
  avatarUrl: string;

  @Prop({ required: true, default: 'Công nghệ thông tin' })
  category: string; // 'Công nghệ thông tin' | 'Toán học' | 'Ngoại ngữ' | 'Kinh tế & Marketing' | 'Kỹ năng mềm' | 'Khác'

  @Prop({ required: true })
  creatorId: string;

  @Prop({ default: 'Admin' })
  creatorName: string;

  @Prop({ default: '' })
  creatorAvatar: string;

  @Prop({ type: [String], default: [] })
  memberIds: string[];

  @Prop({ default: 1 })
  membersCount: number;

  @Prop({ default: 0 })
  postsCount: number;

  @Prop({ type: [String], default: ['Tôn trọng các thành viên khác', 'Không spam hay quảng cáo rác', 'Chia sẻ kiến thức bổ ích và xây dựng'] })
  rules: string[];

  @Prop({ default: true })
  isPublic: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const CommunityGroupSchema = SchemaFactory.createForClass(CommunityGroup);
CommunityGroupSchema.index({ category: 1, createdAt: -1 });
CommunityGroupSchema.index({ name: 'text', description: 'text' });
