import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MatchEndReason, MatchMode, MatchStatus, MatchWinner } from '../../../common/enums';

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: MatchMode, default: MatchMode.CASUAL })
  mode!: MatchMode;

  @Index()
  @Column({ type: 'enum', enum: MatchStatus, default: MatchStatus.WAITING })
  status!: MatchStatus;

  @Index()
  @Column({ name: 'red_player_id', type: 'uuid', nullable: true })
  redPlayerId!: string | null;

  @Index()
  @Column({ name: 'black_player_id', type: 'uuid', nullable: true })
  blackPlayerId!: string | null;

  @Column({ name: 'rule_set', type: 'jsonb', default: {} })
  ruleSet!: Record<string, unknown>;

  @Column({ type: 'enum', enum: MatchWinner, nullable: true })
  winner!: MatchWinner | null;

  @Column({ name: 'end_reason', type: 'enum', enum: MatchEndReason, nullable: true })
  endReason!: MatchEndReason | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
