import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SessionType, PostStatus, SkillCategoryName, ModerationDecision, PostScheduleType } from '../enums';

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
  @Prop({ required: true, index: true })
  mentorId: string;

  @Prop()
  mentorName: string;

  @Prop()
  mentorAvatar: string;

  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ type: String, enum: SessionType, default: SessionType.BOTH })
  sessionType: SessionType;

  @Prop({ type: String, enum: PostScheduleType, default: PostScheduleType.ALWAYS_OPEN })
  scheduleType: PostScheduleType;

  @Prop({ type: String, required: false })
  startDate?: string;

  @Prop({ type: String, required: false })
  endDate?: string;

  @Prop({ type: [PostTag], default: [] })
  tags: PostTag[];

  @Prop({ type: [TimeSlot], default: [] })
  availableSlots: TimeSlot[];

  @Prop({ default: 100 })
  trustScoreSnapshot: number;

  @Prop({ type: String, enum: PostStatus, default: PostStatus.PUBLISHED, index: true })
  status: PostStatus;

  @Prop({ type: SearchIndex })
  searchIndex: SearchIndex;

  @Prop({ type: ModerationEmbed })
  moderation: ModerationEmbed;

  @Prop()
  removedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const MentorPostSchema = SchemaFactory.createForClass(MentorPost);

// Indexes
MentorPostSchema.index(
  { title: 'text', description: 'text', 'tags.skillName': 'text' },
  { weights: { title: 10, 'tags.skillName': 5, description: 1 }, name: 'MentorPostTextIndex' }
);
MentorPostSchema.index({ status: 1, 'tags.category': 1, trustScoreSnapshot: -1, createdAt: -1 });
MentorPostSchema.index({ mentorId: 1, createdAt: -1 });
