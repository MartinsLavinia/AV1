import { existsSync, statSync, renameSync } from "fs";

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

    this.repositorio.salvar("journal.json", journalAtual);

    this.verificarRotacao();
  }

  listarTransacoes(): Transacao[] {
    return this.repositorio.carregar<Transacao[]>("journal.json") ?? [];
  }

  marcarComoAplicada(transacao: Transacao): void {
    const eventoAplicacao = new Transacao(
      transacao.operacao,
      transacao.dados,
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
    const journalAtual = this.listarTransacoes();

    const limite = new Date();

    limite.setDate(limite.getDate() - 180);

    const journalFiltrado = journalAtual.filter(
      (transacao) => new Date(transacao.dataHora) >= limite,
    );

    this.repositorio.salvar("journal.json", journalFiltrado);
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
