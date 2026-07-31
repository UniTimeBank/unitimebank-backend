import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('event_subscription')
export class EventSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_name' })
  eventName: string;

  @Column()
  handler: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ name: 'retry_policy', nullable: true })
  retryPolicy: string;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
