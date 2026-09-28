import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
  openSync,
  fsyncSync,
  closeSync,
  unlinkSync
} from 'fs';
import { randomUUID } from 'crypto';

import { CriptografiaArquivo } from '../security/CriptografiaArquivo.js';
import { GerenciadorChave } from '../security/GerenciadorChave.js';

export interface OperacoesEscritaArquivo {
  openSync: typeof openSync;
  writeFileSync: typeof writeFileSync;
  fsyncSync: typeof fsyncSync;
  closeSync: typeof closeSync;
  renameSync: typeof renameSync;
  unlinkSync: typeof unlinkSync;
}

const operacoesEscritaPadrao: OperacoesEscritaArquivo = {
  openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync,
};

export class RepositorioArquivo {

  private diretorio: string;
  private criptografia: CriptografiaArquivo;
  private gerenciadorChave: GerenciadorChave;

  constructor(diretorio: string = './data', private readonly operacoes: OperacoesEscritaArquivo = operacoesEscritaPadrao) {
    this.diretorio = diretorio;

    this.criptografia = new CriptografiaArquivo();
    this.gerenciadorChave = new GerenciadorChave();

    if (!existsSync(this.diretorio)) {
      mkdirSync(this.diretorio, { recursive: true });
    }
  }

  salvar(nomeArquivo: string, dados: unknown): void {
    this.validarNome(nomeArquivo);
    const caminho = `${this.diretorio}/${nomeArquivo}`;

    const conteudo = JSON.stringify(dados);

    const chave = this.gerenciadorChave.obterChave();

    const conteudoCriptografado =
      this.criptografia.criptografar(conteudo, chave);

    const caminhoTemporario = `${caminho}.${randomUUID()}.tmp`;
    let fd: number | undefined;
    try {
      fd = this.operacoes.openSync(caminhoTemporario, 'wx', 0o600);
      this.operacoes.writeFileSync(fd, conteudoCriptografado, 'utf-8');
      this.operacoes.fsyncSync(fd);
    } catch (erro) {
      try { if (fd !== undefined) this.operacoes.closeSync(fd); } catch { /* preserve original I/O error */ }
      try { this.operacoes.unlinkSync(caminhoTemporario); } catch { /* cleanup best effort */ }
      throw erro;
    }
    try { this.operacoes.closeSync(fd!); }
    catch (erro) {
      try { this.operacoes.unlinkSync(caminhoTemporario); } catch { /* cleanup best effort */ }
      throw erro;
    }
    try { this.operacoes.renameSync(caminhoTemporario, caminho); }
    catch (erro) { try { this.operacoes.unlinkSync(caminhoTemporario); } catch { /* cleanup best effort */ } throw erro; }
  }

  carregar<T>(nomeArquivo: string): T | null {
    this.validarNome(nomeArquivo);
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
    this.validarNome(nomeArquivo);
    const caminho = `${this.diretorio}/${nomeArquivo}`;

    return existsSync(caminho);
  }

  private validarNome(nome: string): void {
    if (!/^[\w.-]+\.json$/.test(nome)) throw new Error('Nome de arquivo de persistência inválido.');
  }
}
