import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('crowd_votes')
@Index(['matchId', 'moveNumber', 'userId'], { unique: true })
export class CrowdVote {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'match_id', type: 'uuid' })
  matchId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'move_number', type: 'int' })
  moveNumber!: number;

  @Column({ type: 'varchar', length: 10 })
  from!: string;

  @Column({ type: 'varchar', length: 10 })
  to!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
