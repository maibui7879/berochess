import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_POOL_URL || process.env.DATABASE_URL!;
const ssl = process.env.DATABASE_SSL === 'true';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url,
  ssl: ssl ? { rejectUnauthorized: false } : false,
  entities: ['src/modules/**/entities/*.entity.ts'],
  synchronize: true,
  logging: false,
});

export default AppDataSource;
