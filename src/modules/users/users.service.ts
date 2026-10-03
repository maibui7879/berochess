import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { Repository } from 'typeorm';
import { UsersQueryDto } from './dto/users-query.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async create(dto: CreateUserDto): Promise<User> {
    const user = this.users.create({
      username: dto.username,
      email: dto.email,
      passwordHash: await argon2.hash(dto.password),
      displayName: dto.displayName ?? dto.username,
      avatarUrl: null,
    });
    return this.users.save(user);
  }

  findAll(query: UsersQueryDto): Promise<User[]> {
    const qb = this.users.createQueryBuilder('user');
    if (query.role) qb.andWhere('user.role = :role', { role: query.role });
    if (query.status) qb.andWhere('user.status = :status', { status: query.status });
    if (query.search) {
      qb.andWhere('(user.username ILIKE :q OR user.email ILIKE :q)', { q: `%${query.search}%` });
    }
    return qb
      .orderBy('user.createdAt', 'DESC')
      .take(Math.min(query.limit ?? 20, 100))
      .skip(query.offset ?? 0)
      .getMany();
  }

  findOne(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email });
  }

  findByUsername(username: string): Promise<User | null> {
    return this.users.findOneBy({ username });
  }

  /** Dùng cho login — lấy kèm passwordHash (entity mặc định select:false). */
  findByEmailWithPassword(email: string): Promise<(User & { passwordHash: string }) | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne() as Promise<(User & { passwordHash: string }) | null>;
  }

  async updateMe(id: string, dto: UpdateMeDto): Promise<User> {
    const user = await this.findOne(id);
    if (!user) throw new NotFoundException('User not found');
    Object.assign(user, dto);
    return this.users.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findOne(id);
    if (!user) throw new NotFoundException('User not found');
    Object.assign(user, dto);
    return this.users.save(user);
  }

  async remove(id: string): Promise<void> {
    await this.users.delete(id);
  }
}
