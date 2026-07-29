import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordService } from '../auth/password.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly passwordService: PasswordService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const user = this.usersRepository.create({
      email: dto.email.toLowerCase(),
      passwordHash: await this.passwordService.hash(dto.password),
      firstName: dto.firstName ?? null,
      lastName: dto.lastName ?? null,
      isActive: true,
    });

    return this.usersRepository.save(user);
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });
  }

  async findByEmailWithMemberships(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
      relations: {
        memberships: {
          tenant: true,
        },
      },
    });
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    user.firstName = dto.firstName ?? user.firstName;
    user.lastName = dto.lastName ?? user.lastName;
    user.isActive = dto.isActive ?? user.isActive;

    return this.usersRepository.save(user);
  }

  async findOrCreateDemoUser(params: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<User> {
    const existing = await this.usersRepository.findOne({
      where: { email: params.email.toLowerCase() },
    });

    if (existing) {
      return existing;
    }

    return this.usersRepository.save(
      this.usersRepository.create({
        email: params.email.toLowerCase(),
        passwordHash: await this.passwordService.hash(params.password),
        firstName: params.firstName,
        lastName: params.lastName,
        isActive: true,
      }),
    );
  }
}
