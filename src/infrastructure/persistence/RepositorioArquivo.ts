import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync
} from 'fs';

import { CriptografiaArquivo } from '../security/CriptografiaArquivo.js';
import { GerenciadorChave } from '../security/GerenciadorChave.js';

export class RepositorioArquivo {

  private diretorio: string;
  private criptografia: CriptografiaArquivo;
  private gerenciadorChave: GerenciadorChave;

  constructor(diretorio: string = './data') {
    this.diretorio = diretorio;

    this.criptografia = new CriptografiaArquivo();
    this.gerenciadorChave = new GerenciadorChave();

    if (!existsSync(this.diretorio)) {
      mkdirSync(this.diretorio, { recursive: true });
    }
  }

  salvar(nomeArquivo: string, dados: unknown): void {
    const caminho = `${this.diretorio}/${nomeArquivo}`;

    const conteudo = JSON.stringify(dados);

    const chave = this.gerenciadorChave.obterChave();

    const conteudoCriptografado =
      this.criptografia.criptografar(conteudo, chave);

    const caminhoTemporario = `${caminho}.tmp`;

    writeFileSync(
        caminhoTemporario,
        conteudoCriptografado,
        'utf-8'
    );

    renameSync(caminhoTemporario, caminho);
  }

  carregar<T>(nomeArquivo: string): T | null {
    const caminho = `${this.diretorio}/${nomeArquivo}`;

    if (!existsSync(caminho)) {
      return null;
    }

    const conteudoCriptografado =
      readFileSync(caminho, 'utf-8');

    const chave = this.gerenciadorChave.obterChave();

    const conteudo =
      this.criptografia.descriptografar(
        conteudoCriptografado,
        chave
      );

    return JSON.parse(conteudo) as T;
  }

  existe(nomeArquivo: string): boolean {
    const caminho = `${this.diretorio}/${nomeArquivo}`;

    return existsSync(caminho);
  }
}