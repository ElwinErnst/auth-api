import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly rounds: number;
  // A real bcrypt hash to compare against when there is no user, so an unknown
  // email costs the same time as a wrong password (no timing enumeration).
  private readonly dummyHash: string;

  constructor(private readonly configService: ConfigService) {
    this.rounds = this.configService.get<number>('auth.bcryptRounds') ?? 12;
    this.dummyHash = bcrypt.hashSync('timing-equalizer', this.rounds);
  }

  async hash(value: string): Promise<string> {
    return bcrypt.hash(value, this.rounds);
  }

  async verify(value: string, hash: string): Promise<boolean> {
    return bcrypt.compare(value, hash);
  }

  /**
   * Burn the same time as a real verify without revealing that no user matched.
   * Call on the user-not-found path before returning "invalid credentials".
   */
  async dummyVerify(value: string): Promise<void> {
    await bcrypt.compare(value, this.dummyHash);
  }
}
