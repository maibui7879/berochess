import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SpectatorTeam } from '../../../common/enums';

@Entity('match_spectators')
@Index(['matchId', 'userId'], { unique: true })
export class MatchSpectator {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'match_id', type: 'uuid' })
  matchId!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: SpectatorTeam, default: SpectatorTeam.NONE })
  team!: SpectatorTeam;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
