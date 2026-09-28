import { existsSync, statSync, renameSync, readdirSync, unlinkSync } from "fs";

import { RepositorioArquivo } from "./RepositorioArquivo.js";
import { Transacao, TipoEventoTransacao } from "./Transacao.js";

export class Journal {
  private repositorio: RepositorioArquivo;
  private limiteJournal = 10 * 1024 * 1024;

  constructor() {
    this.repositorio = new RepositorioArquivo();
  }

  registrar(transacao: Transacao): void {
    const journalAtual =
      this.repositorio.carregar<Transacao[]>("journal.json") ?? [];

    journalAtual.push(transacao);

    this.repositorio.salvar("journal.json", journalAtual);

    this.verificarRotacao();
  }

  listarTransacoes(): Transacao[] {
    const arquivos = readdirSync('./data').filter(n => /^journal-.*\.json$/.test(n)).sort();
    const anteriores = arquivos.flatMap(n => this.repositorio.carregar<Transacao[]>(n) ?? []);
    return [...anteriores, ...(this.repositorio.carregar<Transacao[]>("journal.json") ?? [])];
  }

  marcarComoAplicada(transacao: Transacao): void {
    const eventoAplicacao = new Transacao(
      transacao.operacao,
      null,
      transacao.transacaoId,
      TipoEventoTransacao.APLICACAO,
    );

    this.registrar(eventoAplicacao);
  }

  listarPendentes(): Transacao[] {
    const transacoes = this.listarTransacoes();

    const registros = transacoes.filter(
      (transacao) => transacao.tipoEvento === TipoEventoTransacao.REGISTRO,
    );

    const aplicadas = new Set(
      transacoes
        .filter(
          (transacao) => transacao.tipoEvento === TipoEventoTransacao.APLICACAO,
        )
        .map((transacao) => transacao.transacaoId),
    );

    return registros.filter(
      (transacao) => !aplicadas.has(transacao.transacaoId),
    );
  }

  limparAntigas(): void {
    const limite = new Date();
    limite.setDate(limite.getDate() - 180);
    for (const nome of readdirSync('./data').filter(n => /^journal-.*\.json$/.test(n))) {
      const registros = this.repositorio.carregar<Transacao[]>(nome) ?? [];
      const mantidos = registros.filter(t => new Date(t.dataHora) >= limite);
      if (mantidos.length) this.repositorio.salvar(nome, mantidos);
      else unlinkSync(`./data/${nome}`);
    }
    const atual = this.repositorio.carregar<Transacao[]>('journal.json') ?? [];
    this.repositorio.salvar('journal.json', atual.filter(t => new Date(t.dataHora) >= limite));
  }

  private verificarRotacao(): void {
    const caminho = "./data/journal.json";

    if (!existsSync(caminho)) {
      return;
    }

    const tamanho = statSync(caminho).size;

    if (tamanho <= this.limiteJournal) {
      return;
    }

    const data = new Date().toISOString().replace(/[:.]/g, "-");

    const caminhoArquivoAntigo = `./data/journal-${data}.json`;

    renameSync(caminho, caminhoArquivoAntigo);
  }

  recuperar(aplicarTransacao: (transacao: Transacao) => void): void {
    const pendentes = this.listarPendentes();

    for (const transacao of pendentes) {
      aplicarTransacao(transacao);

      this.marcarComoAplicada(transacao);
    }
  }
}
