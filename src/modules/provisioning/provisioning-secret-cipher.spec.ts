import { ProvisioningSecretCipher } from './provisioning-secret-cipher';

describe('ProvisioningSecretCipher', () => {
  const key = Buffer.alloc(32, 9).toString('base64');
  const cipher = new ProvisioningSecretCipher({ get: () => key } as any);

  it('round-trips credentials without retaining plaintext in the envelope', () => {
    const plaintext = 'syt_sensitive-service-account-secret';
    const envelope = cipher.encrypt(plaintext);

    expect(envelope).not.toContain(plaintext);
    expect(cipher.decrypt(envelope)).toBe(plaintext);
  });

  it('rejects corrupted or malformed envelopes', () => {
    const envelope = cipher.encrypt('secret');
    const [, iv, tag, ciphertext] = envelope.split(':');
    const corrupted = `${envelope.slice(0, -2)}aa`;

    expect(() => cipher.decrypt('v2:bad:bad:bad')).toThrow();
    expect(() => cipher.decrypt(`v1:${iv}:${tag}:${corrupted}`)).toThrow();
    expect(() => cipher.decrypt('v1:bad:bad:')).toThrow();
    expect(() => cipher.decrypt(`v1:${iv}:${tag}:${ciphertext}:extra`)).toThrow();
  });

  it('fails closed when the configured key is not exactly 32 bytes', () => {
    const invalid = new ProvisioningSecretCipher({
      get: () => Buffer.alloc(16).toString('base64'),
    } as any);

    expect(() => invalid.encrypt('secret')).toThrow(
      'Provisioning secret encryption key must be 32-byte base64',
    );
  });
});
