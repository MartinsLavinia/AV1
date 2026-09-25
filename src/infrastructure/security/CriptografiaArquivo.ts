import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from 'crypto';

export class CriptografiaArquivo {

  criptografar(texto: string, chave: Buffer): string {
    const iv = randomBytes(12);

    const cipher = createCipheriv('aes-256-gcm', chave, iv);

    const textoCriptografado = Buffer.concat([
      cipher.update(texto, 'utf8'),
      cipher.final()
    ]);

    const tag = cipher.getAuthTag();

    return [
      iv.toString('hex'),
      tag.toString('hex'),
      textoCriptografado.toString('hex')
    ].join(':');
  }

  descriptografar(
    textoCriptografado: string,
    chave: Buffer
  ): string {

    const partes = textoCriptografado.split(':');

    const iv = Buffer.from(partes[0], 'hex');
    const tag = Buffer.from(partes[1], 'hex');
    const dados = Buffer.from(partes[2], 'hex');

    const decipher = createDecipheriv(
      'aes-256-gcm',
      chave,
      iv
    );

    decipher.setAuthTag(tag);

    const textoOriginal = Buffer.concat([
      decipher.update(dados),
      decipher.final()
    ]);

    return textoOriginal.toString('utf8');
  }
}