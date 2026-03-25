import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly rounds: number;

  constructor(private readonly configService: ConfigService) {
    this.rounds = this.configService.get<number>('auth.bcryptRounds') ?? 12;
  }

  async hash(value: string): Promise<string> {
    return bcrypt.hash(value, this.rounds);
  }

  async verify(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }
}
