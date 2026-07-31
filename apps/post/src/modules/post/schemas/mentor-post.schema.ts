import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SessionType, PostStatus, SkillCategoryName, ModerationDecision } from '../enums';

export type MentorPostDocument = HydratedDocument<MentorPost>;

@Schema({ _id: false })
export class PostTag {
  @Prop({ required: true })
  skillName: string;

  @Prop({ type: String, enum: SkillCategoryName })
  category: SkillCategoryName;
}

@Schema({ _id: false })
export class TimeSlot {
  @Prop({ required: true })
  dayOfWeek: string;

  @Prop({ required: true })
  startTime: string;

  @Prop({ required: true })
  endTime: string;
}

@Schema({ _id: false })
export class SearchIndex {
  @Prop()
  fullText: string;

  @Prop({ type: [String], enum: SkillCategoryName })
  categoryNames: SkillCategoryName[];

  @Prop({ type: [String] })
  skillNames: string[];

  @Prop({ default: 0 })
  trustScoreMin: number;

  @Prop()
  indexedAt: Date;
}

@Schema({ _id: false })
export class ModerationEmbed {
  @Prop({ type: String, enum: ModerationDecision })
  decision: ModerationDecision;

  @Prop()
  reason: string;

  @Prop()
  moderatorId: string;

  @Prop()
  decidedAt: Date;
}

@Schema({ collection: 'mentor_posts', timestamps: true })
export class MentorPost {
  @Prop({ required: true })
  mentorId: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ type: String, enum: SessionType, default: SessionType.BOTH })
  sessionType: SessionType;

  @Prop({ type: [PostTag], default: [] })
  tags: PostTag[];

  @Prop({ type: [TimeSlot], default: [] })
  availableSlots: TimeSlot[];

  @Prop({ default: 100 })
  trustScoreSnapshot: number;

  @Prop({ type: String, enum: PostStatus, default: PostStatus.DRAFT })
  status: PostStatus;

  @Prop({ type: SearchIndex })
  searchIndex: SearchIndex;

  @Prop({ type: ModerationEmbed })
  moderation: ModerationEmbed;

  @Prop()
  removedAt: Date;
}

export const MentorPostSchema = SchemaFactory.createForClass(MentorPost);
