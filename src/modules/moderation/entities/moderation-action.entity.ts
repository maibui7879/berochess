import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ModerationActionType } from '../../../common/enums';

@Entity('moderation_actions')
export class ModerationAction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'moderator_id', type: 'uuid' })
  moderatorId!: string;

  @Index()
  @Column({ name: 'target_user_id', type: 'uuid', nullable: true })
  targetUserId!: string | null;

  @Column({ name: 'match_id', type: 'uuid', nullable: true })
  matchId!: string | null;

  @Column({ type: 'enum', enum: ModerationActionType })
  action!: ModerationActionType;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  reason!: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
