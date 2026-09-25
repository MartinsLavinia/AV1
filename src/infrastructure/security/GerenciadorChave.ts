import { randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';

export class GerenciadorChave {

  private caminhoArquivo = './greencode-config.key';

  gerarChave(): Buffer {
    return randomBytes(32);
  }

  obterChave(): Buffer {

    if (existsSync(this.caminhoArquivo)) {
      const chaveHex = readFileSync(
        this.caminhoArquivo,
        'utf-8'
      );

      return Buffer.from(chaveHex, 'hex');
    }

    const chave = this.gerarChave();

    writeFileSync(
      this.caminhoArquivo,
      chave.toString('hex')
    );

    return chave;
  }
}