import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RatingType } from '../../../common/enums';

@Entity('ratings')
@Index(['userId', 'type'], { unique: true })
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'enum', enum: RatingType })
  type!: RatingType;

  @Column({ type: 'float', default: 1500 })
  rating!: number;

  @Column({ name: 'rating_deviation', type: 'float', default: 350 })
  ratingDeviation!: number;

  @Column({ type: 'float', default: 0.06 })
  volatility!: number;

  @Column({ type: 'int', default: 0 })
  games!: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
