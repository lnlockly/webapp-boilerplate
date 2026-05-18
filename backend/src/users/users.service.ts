import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepo.find({
      select: ['id', 'email', 'name', 'role', 'stripeSubscriptionStatus', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
  }

  async create(data: { email: string; password: string; name: string; role?: UserRole }): Promise<User> {
    const existing = await this.findByEmail(data.email);
    if (existing) throw new ConflictException('Email already taken');

    const hashed = await bcrypt.hash(data.password, 10);
    const user = this.usersRepo.create({ ...data, password: hashed });
    return this.usersRepo.save(user);
  }

  async seedAdmin(email: string, password: string, name: string): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) return existing;
    return this.create({ email, password, name, role: UserRole.ADMIN });
  }

  async delete(id: number): Promise<void> {
    await this.usersRepo.delete(id);
  }
}