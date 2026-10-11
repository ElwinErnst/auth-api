import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const CIPHER = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

@Injectable()
export class ProvisioningSecretCipher {
  constructor(private readonly config: ConfigService) {}

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(CIPHER, this.readKey(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return [
      'v1',
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(envelope: string): string {
    const [version, ivValue, tagValue, ciphertextValue, extra] =
      envelope.split(':');
    if (version !== 'v1' || !ivValue || !tagValue || !ciphertextValue || extra) {
      throw new Error('Invalid provisioning credential envelope');
    }
    if (
      ![ivValue, tagValue, ciphertextValue].every((value) =>
        this.isCanonicalBase64(value),
      )
    ) {
      throw new Error('Invalid provisioning credential envelope');
    }

    const iv = Buffer.from(ivValue, 'base64');
    const tag = Buffer.from(tagValue, 'base64');
    if (iv.length !== IV_LENGTH || tag.length !== 16) {
      throw new Error('Invalid provisioning credential envelope');
    }

    const decipher = createDecipheriv(CIPHER, this.readKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextValue, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  private readKey(): Buffer {
    const configured = this.config.get<string>(
      'internal.provisioningSecretEncryptionKey',
    );
    if (!configured) {
      throw new Error('AUTH_PROVISIONING_SECRET_ENCRYPTION_KEY must be configured');
    }
    const key = Buffer.from(configured, 'base64');
    if (
      key.length !== KEY_LENGTH ||
      key.toString('base64') !== configured
    ) {
      throw new Error('Provisioning secret encryption key must be 32-byte base64');
    }
    return key;
  }

  private isCanonicalBase64(value: string): boolean {
    return Buffer.from(value, 'base64').toString('base64') === value;
  }
}
