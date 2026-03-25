import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
  ) {}

  async create(dto: CreateTenantDto): Promise<Tenant> {
    const existing = await this.tenantsRepository.findOne({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Tenant slug already exists');
    }

    const tenant = this.tenantsRepository.create({
      name: dto.name,
      slug: dto.slug,
      planCode: dto.planCode ?? 'FREE',
      ztPoliciesEnabled: dto.ztPoliciesEnabled ?? false,
      vaultsEnabled: dto.vaultsEnabled ?? false,
      maxVaults: dto.maxVaults ?? 0,
      isActive: true,
    });

    return this.tenantsRepository.save(tenant);
  }

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantsRepository.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }
    return tenant;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return this.tenantsRepository.findOne({ where: { slug } });
  }

  async update(id: string, dto: UpdateTenantDto): Promise<Tenant> {
    const tenant = await this.findById(id);

    if (dto.slug && dto.slug !== tenant.slug) {
      const existing = await this.tenantsRepository.findOne({
        where: { slug: dto.slug },
      });

      if (existing) {
        throw new ConflictException('Tenant slug already exists');
      }
    }

    Object.assign(tenant, dto);

    return this.tenantsRepository.save(tenant);
  }

  async findOrCreateBySlug(dto: {
    name: string;
    slug: string;
    planCode: string;
    ztPoliciesEnabled: boolean;
    vaultsEnabled: boolean;
    maxVaults: number;
  }): Promise<Tenant> {
    const existing = await this.findBySlug(dto.slug);
    if (existing) {
      return existing;
    }

    return this.tenantsRepository.save(
      this.tenantsRepository.create({
        ...dto,
        isActive: true,
      }),
    );
  }
}
