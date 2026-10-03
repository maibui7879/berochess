import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Side } from '../../../common/enums';

/** Server-side chess clock. Mọi tính giờ lấy giờ server, client chỉ hiển thị. */
@Entity('match_clocks')
export class MatchClock {
  @PrimaryColumn({ name: 'match_id', type: 'uuid' })
  matchId!: string;

  @Column({ name: 'red_ms', type: 'int' })
  redMs!: number;

  @Column({ name: 'black_ms', type: 'int' })
  blackMs!: number;

  @Column({ name: 'increment_ms', type: 'int', default: 0 })
  incrementMs!: number;

  @Column({ name: 'active_color', type: 'enum', enum: Side, nullable: true })
  activeColor!: Side | null;

  @Column({ name: 'last_tick_at', type: 'timestamptz', nullable: true })
  lastTickAt!: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

export interface ClockView {
  redMs: number;
  blackMs: number;
  incrementMs: number;
  activeColor: Side | null;
  serverTime: string;
}

export interface TimeControl {
  initialMs: number;
  incrementMs: number;
}

export const DEFAULT_TIME_CONTROL: TimeControl = { initialMs: 10 * 60 * 1000, incrementMs: 0 };
