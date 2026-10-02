import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { MatchStatus, Side } from '../../../common/enums';

@Entity('game_states')
export class GameState {
  @PrimaryColumn({ name: 'match_id', type: 'uuid' })
  matchId!: string;

  @Column({ type: 'enum', enum: Side, default: Side.RED })
  turn!: Side;

  @Column({ name: 'move_number', type: 'int', default: 0 })
  moveNumber!: number;

  @Column({ type: 'jsonb' })
  board!: unknown;

  @Column({ type: 'enum', enum: MatchStatus, default: MatchStatus.WAITING })
  status!: MatchStatus;

  @Column({ name: 'last_move', type: 'jsonb', nullable: true })
  lastMove!: Record<string, unknown> | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
