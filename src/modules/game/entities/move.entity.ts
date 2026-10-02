import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('moves')
@Index(['matchId', 'moveNumber'], { unique: true })
export class Move {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'match_id', type: 'uuid' })
  matchId!: string;

  @Column({ name: 'move_number', type: 'int' })
  moveNumber!: number;

  @Index()
  @Column({ name: 'player_id', type: 'uuid' })
  playerId!: string;

  @Column({ type: 'varchar', length: 10 })
  from!: string;

  @Column({ type: 'varchar', length: 10 })
  to!: string;

  @Column({ name: 'captured_piece', type: 'varchar', length: 10, nullable: true })
  capturedPiece!: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  notation!: string | null;

  @Column({ name: 'board_hash', type: 'varchar', length: 128, nullable: true })
  boardHash!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
