import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RatingType } from '../../../common/enums';

@Entity('rating_history')
export class RatingHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'match_id', type: 'uuid', nullable: true })
  matchId!: string | null;

  @Column({ type: 'enum', enum: RatingType })
  type!: RatingType;

  @Column({ name: 'rating_before', type: 'float' })
  ratingBefore!: number;

  @Column({ name: 'rating_after', type: 'float' })
  ratingAfter!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
