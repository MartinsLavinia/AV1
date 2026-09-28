import { createHash, randomBytes, timingSafeEqual } from 'crypto';

export class HashSenha {

  gerarHash(senha: string): { hash: string; salt: string } {
    const salt = randomBytes(16).toString('hex');

    const hash = createHash('sha256').update(senha + salt).digest('hex');

    return {
      hash,
      salt
    };
  }

  verificar(senha: string, hashArmazenado: string, salt: string): boolean {
    const hash = createHash('sha256').update(senha + salt).digest();
    const armazenado = Buffer.from(hashArmazenado, 'hex');
    return armazenado.length === hash.length && timingSafeEqual(hash, armazenado);
  }
}
