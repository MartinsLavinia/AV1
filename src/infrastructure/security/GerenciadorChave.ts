import { randomBytes } from 'crypto';
import { readFileSync } from 'fs';

export class GerenciadorChave {

    private caminhoConfiguracao = './greencode-config.json';

    gerarChave(): Buffer {
        return randomBytes(32);
    }

    obterChave(): Buffer {

        const conteudo = readFileSync(
            this.caminhoConfiguracao,
            'utf-8'
        );

        const configuracao = JSON.parse(conteudo);

        return Buffer.from(
            configuracao.chaveMestra,
            'hex'
        );
    }
}