import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { SessionType, LearnerRequestStatus, SkillCategoryName } from '../enums';

export type LearnerRequestDocument = HydratedDocument<LearnerRequest>;

@Schema()
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
  @Prop({ required: true })
  learnerId: string;

  @Prop({ required: true })
  skillNeeded: string;

  @Prop({ type: String, enum: SkillCategoryName })
  category: SkillCategoryName;

  @Prop()
  description: string;

  @Prop({ type: String, enum: SessionType, default: SessionType.ONE_ON_ONE })
  sessionType: SessionType;

  @Prop()
  expectedDurationMinutes: number;

  @Prop()
  expectedCreditAmount: number;

  @Prop({ type: [DesiredSlot], default: [] })
  desiredSlots: DesiredSlot[];

  @Prop({ type: String, enum: LearnerRequestStatus, default: LearnerRequestStatus.OPEN })
  status: LearnerRequestStatus;

  @Prop()
  removedAt: Date;
}

export const LearnerRequestSchema = SchemaFactory.createForClass(LearnerRequest);
