import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SessionType, LearnerRequestStatus, SkillCategoryName } from '../enums';

export type LearnerRequestDocument = HydratedDocument<LearnerRequest>;

@Schema({ _id: false })
export class DesiredSlot {
  @Prop({ required: true })
  dayOfWeek: string;

  @Prop({ required: true })
  startTime: string;

  @Prop({ required: true })
  endTime: string;
}

@Schema({ collection: 'learner_requests', timestamps: true })
export class LearnerRequest {
  @Prop({ required: true, index: true })
  learnerId: string;

  @Prop()
  learnerName: string;

  @Prop()
  learnerAvatar: string;

  @Prop({ required: true })
  skillNeeded: string;

  @Prop({ type: String, enum: SkillCategoryName, index: true })
  category: SkillCategoryName;

  @Prop()
  description: string;

  @Prop({ type: String, enum: SessionType, default: SessionType.ONE_ON_ONE })
  sessionType: SessionType;

  @Prop({ default: 60 })
  expectedDurationMinutes: number;

  @Prop({ default: 60 })
  expectedCreditAmount: number;

  @Prop({ type: [DesiredSlot], default: [] })
  desiredSlots: DesiredSlot[];

  @Prop({ type: String, enum: LearnerRequestStatus, default: LearnerRequestStatus.OPEN, index: true })
  status: LearnerRequestStatus;

  @Prop()
  removedAt: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const LearnerRequestSchema = SchemaFactory.createForClass(LearnerRequest);

// Indexes
LearnerRequestSchema.index(
  { skillNeeded: 'text', description: 'text' },
  { weights: { skillNeeded: 10, description: 1 }, name: 'LearnerRequestTextIndex' }
);
LearnerRequestSchema.index({ status: 1, category: 1, createdAt: -1 });
LearnerRequestSchema.index({ learnerId: 1, createdAt: -1 });
