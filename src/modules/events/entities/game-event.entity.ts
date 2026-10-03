import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { GameEventType } from '../../../common/enums';

/** Bản ghi bất biến mọi sự kiện trong match — dùng cho audit/replay/analytics/moderation. */
@Entity('game_events')
@Index(['matchId', 'createdAt'])
export class GameEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: GameEventType })
  type!: GameEventType;

  @Index()
  @Column({ name: 'match_id', type: 'uuid' })
  matchId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'jsonb', default: {} })
  payload!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
