import readline from 'readline';
import * as fs from 'fs';
import { EstadoFisico, PapelUsuario, StatusRastreamento, TipoEquipamento } from '../domain/enums.js';

export class InterfaceCLI {
  private rl: readline.Interface;
  private historico: string[] = [];
  private comandosDisponiveis: string[] = [];

  constructor() {
    const caminhoHistorico = './data/.greencode-history';
    try {
      this.historico = fs.readFileSync(caminhoHistorico, 'utf8')
        .split(/\r?\n/).filter(Boolean).reverse().slice(0, 100);
    } catch { /* primeiro uso */ }

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      historySize: 100,
      removeHistoryDuplicates: true,
      completer: (linha: string) => this.completar(linha),
    });
    // readline stores newest entries first; preload those saved in earlier runs.
    const readlineHistory = (this.rl as unknown as { history: string[] }).history;
    if (Array.isArray(readlineHistory)) readlineHistory.splice(0, readlineHistory.length, ...this.historico);
  }

  definirComandosDisponiveis(comandos: string[]): void {
    this.comandosDisponiveis = [...comandos, 'ajuda', 'sair'];
  }

  sugerir(linha: string): string[] {
    return this.completar(linha)[0];
  }

  perguntar(pergunta: string, guardarHistorico = false): Promise<string> {
    return new Promise(resolve => {
      this.rl.question(pergunta, resposta => {
        if (guardarHistorico && resposta.trim()) {
          const linha = resposta.trim();
          this.historico = [linha, ...this.historico.filter(item => item !== linha)].slice(0, 100);
          const caminho = './data/.greencode-history';
          try {
            fs.mkdirSync('./data', { recursive: true });
            fs.appendFileSync(caminho, `${linha.replace(/[\r\n]/g, '')}\n`, { mode: 0o600 });
          } catch { /* histórico é auxiliar; a operação do usuário continua */ }
        }
        resolve(resposta);
      });
    });
  }

  fechar(): void { this.rl.close(); }

  private completar(linha: string): [string[], string] {
    const linhaNormalizada = linha.toLocaleLowerCase('pt-BR');
    const comandos = [...new Set([...this.comandosDisponiveis, ...this.historico])];
    const candidatos = [...comandos];
    const valoresPorCampo: Record<string, Record<string, string[]>> = {
      'usuario criar': { papel: Object.values(PapelUsuario).map(v => v.toLocaleLowerCase('pt-BR')) },
      'contrato criar': { renovacao: ['s', 'n'] },
      'equip adicionar': { tipo: Object.values(TipoEquipamento).map(v => v.toLocaleLowerCase('pt-BR')) },
      'equip triagem': { acao: ['iniciar', 'concluir'] },
      'equip mover': { destino: Object.values(StatusRastreamento).map(v => v.toLocaleLowerCase('pt-BR')) },
      'equip estado': { estado: Object.values(EstadoFisico).map(v => v.toLocaleLowerCase('pt-BR')) },
    };
    const definicoesFlags: Record<string, string[]> = {
      'org criar': ['--nome', '--cnpj', '--email'],
      'contrato criar': ['--org', '--vencimento', '--valor', '--renovacao'],
      'lote criar': ['--org', '--nf', '--transp', '--data'],
      'equip adicionar': ['--lote', '--tipo', '--marca', '--modelo', '--ano', '--peso'],
      'equip triagem': ['--id', '--acao'],
      'equip mover': ['--id', '--destino', '--observacao'],
      'equip estado': ['--id', '--estado', '--justificativa'],
      'equip rastrear': ['--id'],
      'usuario criar': ['--usuario', '--papel'],
      configuracao: ['--imposto', '--depreciacao'],
    };

    for (const [comando, flags] of Object.entries(definicoesFlags)) {
      if (!this.comandosDisponiveis.includes(comando)) continue;
      if (linhaNormalizada === comando || linhaNormalizada.startsWith(`${comando} `)) {
        const corte = linha.lastIndexOf(' ');
        const prefixo = linhaNormalizada === comando ? `${comando} ` : linha.slice(0, corte + 1);
        const campo = /(?:^|\s)--([\w-]+)\s+(\S*)$/i.exec(linhaNormalizada);
        const valores = campo ? valoresPorCampo[comando]?.[campo[1]] : undefined;
        if (campo && valores) {
          const antesDoValor = linha.slice(0, linha.length - campo[2].length);
          const parcial = campo[2].replace(/_/g, '');
          for (const valor of valores) {
            if (valor.replace(/_/g, '').startsWith(parcial)) candidatos.push(`${antesDoValor}${valor}`);
          }
        }
        for (const flag of flags) candidatos.push(`${prefixo}${flag}`);
      }
    }

    const encontrados = candidatos.filter(candidato => candidato.toLocaleLowerCase('pt-BR').startsWith(linhaNormalizada));
    return [encontrados.length ? encontrados : comandos, linha];
  }
}
