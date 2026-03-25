import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { CreateMembershipDto } from './dto/create-membership.dto';
import { UpdateMembershipDto } from './dto/update-membership.dto';
import { TenantMembership } from './entities/tenant-membership.entity';

@Injectable()
export class MembershipsService {
  constructor(
    @InjectRepository(TenantMembership)
    private readonly membershipsRepository: Repository<TenantMembership>,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
  ) {}

  async create(dto: CreateMembershipDto): Promise<TenantMembership> {
    await this.usersService.findById(dto.userId);
    await this.tenantsService.findById(dto.tenantId);

    const existing = await this.membershipsRepository.findOne({
      where: {
        userId: dto.userId,
        tenantId: dto.tenantId,
      },
    });

    if (existing) {
      throw new ConflictException('Membership already exists');
    }

    return this.membershipsRepository.save(
      this.membershipsRepository.create({
        userId: dto.userId,
        tenantId: dto.tenantId,
        role: dto.role,
        isActive: true,
      }),
    );
  }

  async findById(id: string): Promise<TenantMembership> {
    const membership = await this.membershipsRepository.findOne({
      where: { id },
      relations: {
        user: true,
        tenant: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    return membership;
  }

  async update(id: string, dto: UpdateMembershipDto): Promise<TenantMembership> {
    const membership = await this.findById(id);
    Object.assign(membership, dto);
    return this.membershipsRepository.save(membership);
  }

  async listByUser(userId: string): Promise<TenantMembership[]> {
    return this.membershipsRepository.find({
      where: { userId },
      relations: { tenant: true },
      order: { createdAt: 'ASC' },
    });
  }

  async listByTenant(tenantId: string): Promise<TenantMembership[]> {
    return this.membershipsRepository.find({
      where: { tenantId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
  }

  async findActiveMembership(
    userId: string,
    tenantId: string,
  ): Promise<TenantMembership | null> {
    return this.membershipsRepository.findOne({
      where: {
        userId,
        tenantId,
        isActive: true,
      },
      relations: { tenant: true, user: true },
    });
  }

  async findOrCreate(params: {
    userId: string;
    tenantId: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
  }): Promise<TenantMembership> {
    const existing = await this.membershipsRepository.findOne({
      where: {
        userId: params.userId,
        tenantId: params.tenantId,
      },
    });

    if (existing) {
      return existing;
    }

    return this.membershipsRepository.save(
      this.membershipsRepository.create({
        ...params,
        isActive: true,
      }),
    );
  }
}
