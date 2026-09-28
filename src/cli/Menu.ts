import { PapelUsuario, TipoEquipamento, StatusRastreamento, EstadoFisico } from '../domain/enums.js';
import { InterfaceCLI } from './InterfaceCLI.js';
import { ServicoDados } from '../application/services/ServicoDados.js';
import { RepositorioCredenciais } from '../infrastructure/persistence/RepositorioCredenciais.js';
import { Sessao } from '../domain/entities/Sessao.js';

type Comando = { nome: string; uso: string };
type ComandoLido = { nome: string; posicoes: string[]; opcoes: Record<string, string> };

const comandosPorPapel: Record<PapelUsuario, Comando[]> = {
  [PapelUsuario.ADMINISTRADOR]: [
    { nome: 'usuario criar', uso: 'usuario criar --usuario <nome> --papel <papel>' },
    { nome: 'usuario listar', uso: 'usuario listar' },
    { nome: 'configuracao', uso: 'configuracao [--imposto <0-100> --depreciacao <0-100>]' },
  ],
  [PapelUsuario.OPERADOR_CADASTRO]: [
    { nome: 'org criar', uso: 'org criar --nome <nome> --cnpj <cnpj> --email <email>' },
    { nome: 'org listar', uso: 'org listar' },
    { nome: 'contrato criar', uso: 'contrato criar --org <id> --vencimento <AAAA-MM-DD> --valor <valor> [--renovacao s|n]' },
    { nome: 'contrato listar', uso: 'contrato listar' },
  ],
  [PapelUsuario.GESTOR_ALMOXARIFADO]: [
    { nome: 'lote criar', uso: 'lote criar --org <id> --nf <nota> --transp <transportadora> [--data <AAAA-MM-DD>]' },
    { nome: 'lote listar', uso: 'lote listar' },
    { nome: 'equip adicionar', uso: 'equip adicionar --lote <id> --tipo <tipo> --marca <marca> --modelo <modelo> --ano <ano> --peso <kg>' },
    { nome: 'equip triagem', uso: 'equip triagem --id <id> --acao iniciar|concluir' },
    { nome: 'equip mover', uso: 'equip mover --id <id> --destino <local-ou-status> [--observacao <texto>]' },
    { nome: 'equip estado', uso: 'equip estado --id <id> --estado <estado> [--justificativa <texto>]' },
  ],
  [PapelUsuario.AUDITOR]: [
    { nome: 'equip rastrear', uso: 'equip rastrear <id-ou-codigo> (ou --id <id>)' },
    { nome: 'historico', uso: 'historico' },
    { nome: 'relatorio', uso: 'relatorio' },
  ],
};

const opcoesPorComando: Record<string, string[]> = {
  'usuario criar': ['usuario', 'papel'],
  'configuracao': ['imposto', 'depreciacao'],
  'org criar': ['nome', 'cnpj', 'email'],
  'contrato criar': ['org', 'vencimento', 'valor', 'renovacao'],
  'lote criar': ['org', 'nf', 'transp', 'data'],
  'equip adicionar': ['lote', 'tipo', 'marca', 'modelo', 'ano', 'peso'],
  'equip triagem': ['id', 'acao'],
  'equip mover': ['id', 'destino', 'observacao'],
  'equip estado': ['id', 'estado', 'justificativa'],
  'equip rastrear': ['id'],
  historico: [],
  relatorio: [],
  'org listar': [],
  'contrato listar': [],
  'lote listar': [],
  'usuario listar': [],
};

export function normalizarValorEnum<T extends string>(valores: readonly T[], valor: string): T | undefined {
  const chave = valor.trim().toLocaleUpperCase('pt-BR').replace(/[ -]+/g, '_');
  return valores.find(item => item === chave);
}

export function normalizarPapel(valor: string): PapelUsuario | undefined {
  return normalizarValorEnum(Object.values(PapelUsuario), valor);
}

export class Menu {
  private dados = new ServicoDados();

  constructor(private cli: InterfaceCLI) {}

  async executar(sessao: Sessao): Promise<void> {
    const comandos = this.comandosPara(sessao.papel);
    this.cli.definirComandosDisponiveis(comandos.map(c => c.nome));
    console.log(`[INFO] Sessão iniciada como ${sessao.papel}. Digite "ajuda" para ver seus comandos.`);

    while (sessao.isValida()) {
      let linha: string;
      try {
        linha = (await this.perguntarSessao(sessao, 'greencode> ', true)).trim();
      } catch {
        break;
      }
      if (!linha) continue;
      if (linha.toLowerCase() === 'sair' || linha.toLowerCase() === 'exit') break;
      if (linha.toLowerCase() === 'ajuda' || linha === '--help') {
        this.mostrarAjuda(comandos);
        continue;
      }

      try {
        const comando = this.interpretar(linha);
        const permitido = comandos.some(c => c.nome === comando.nome);
        if (!permitido) throw new Error('Comando inexistente ou não autorizado para este papel. Digite "ajuda".');
        this.validarOpcoes(comando);
        await this.executarComando(comando, sessao);
      } catch (erro) {
        console.log(`[ERRO] ${erro instanceof Error ? erro.message : String(erro)}`);
      }
    }

    if (!sessao.isValida()) console.log('[AVISO] Sessão expirada por inatividade.');
    console.log('[INFO] Sessão encerrada.');
  }

  private comandosPara(papel: PapelUsuario): Comando[] {
    return comandosPorPapel[papel];
  }

  private mostrarAjuda(comandos: Comando[]): void {
    console.log('\nComandos disponíveis:');
    for (const comando of comandos) console.log(`  ${comando.uso}`);
    console.log('  ajuda');
    console.log('  sair');
    console.log('Use Tab para completar comandos/opções e ↑ para navegar pelo histórico.');
  }

  private interpretar(linha: string): ComandoLido {
    const tokens = this.tokenizar(linha);
    if (!tokens.length) throw new Error('Digite um comando.');
    const nome = tokens.length > 1 && !tokens[0].startsWith('--') && !tokens[1].startsWith('--')
      ? `${tokens[0].toLowerCase()} ${tokens[1].toLowerCase()}`
      : tokens[0].toLowerCase();
    const inicio = nome.includes(' ') ? 2 : 1;
    const posicoes: string[] = [];
    const opcoes: Record<string, string> = {};

    for (let i = inicio; i < tokens.length; i++) {
      const token = tokens[i];
      if (!token.startsWith('--')) {
        posicoes.push(token);
        continue;
      }
      const igual = token.indexOf('=');
      const chave = (igual < 0 ? token.slice(2) : token.slice(2, igual)).toLowerCase();
      const valorInline = igual < 0 ? undefined : token.slice(igual + 1);
      const proximo = tokens[i + 1];
      if (!chave) throw new Error('Opção sem nome.');
      if (valorInline !== undefined) opcoes[chave] = valorInline;
      else if (proximo && !proximo.startsWith('--')) opcoes[chave] = tokens[++i];
      else throw new Error(`A opção --${chave} precisa de um valor.`);
    }
    return { nome, posicoes, opcoes };
  }

  private tokenizar(linha: string): string[] {
    const tokens = linha.match(/"[^"\n]*"|'[^'\n]*'|\S+/g) ?? [];
    return tokens.map(token => {
      if ((token.startsWith('"') && !token.endsWith('"')) || (token.startsWith("'") && !token.endsWith("'"))) {
        throw new Error('Texto entre aspas não foi fechado.');
      }
      return (token.startsWith('"') || token.startsWith("'")) ? token.slice(1, -1) : token;
    });
  }

  private validarOpcoes(comando: ComandoLido): void {
    const permitidas = opcoesPorComando[comando.nome];
    if (!permitidas) throw new Error('Comando desconhecido. Digite "ajuda".');
    const desconhecidas = Object.keys(comando.opcoes).filter(opcao => !permitidas.includes(opcao));
    if (desconhecidas.length) throw new Error(`Opção(ões) desconhecida(s): ${desconhecidas.map(o => `--${o}`).join(', ')}.`);
  }

  private async valor(comando: ComandoLido, nomes: string[], indice: number, sessao: Sessao, pergunta: string, obrigatorio = true, padrao = ''): Promise<string> {
    for (const nome of nomes) {
      if (comando.opcoes[nome] !== undefined) return comando.opcoes[nome];
    }
    if (comando.posicoes[indice] !== undefined) return comando.posicoes[indice];
    if (!obrigatorio) return padrao;
    return this.perguntarSessao(sessao, pergunta);
  }

  private async executarComando(comando: ComandoLido, sessao: Sessao): Promise<void> {
    const { nome } = comando;
    if (nome === 'usuario criar') {
      const usuario = await this.valor(comando, ['usuario'], 0, sessao, 'Usuário: ');
      const papeis = Object.values(PapelUsuario).map(p => p.toLocaleLowerCase('pt-BR')).join(', ');
      const papelInformado = await this.valor(comando, ['papel'], 1, sessao, `Papel (${papeis}): `);
      const senha = await this.perguntarSessao(sessao, 'Senha (mínimo 4 caracteres): ');
      if (senha.length < 4) throw new Error('A senha deve ter pelo menos 4 caracteres.');
      const papel = normalizarPapel(papelInformado);
      if (!papel) throw new Error(`Papel inválido. Use um destes: ${papeis}.`);
      this.dados.criarUsuario(usuario, senha, papel);
      console.log('[SUCESSO] Usuário criado.');
    } else if (nome === 'usuario listar') {
      console.table(new RepositorioCredenciais().listar().map(c => ({ usuario: c.usuario, papel: c.papel, ultimoAcesso: c.ultimoAcesso })));
    } else if (nome === 'configuracao') {
      const atual = this.dados.configuracoes();
      const imposto = Number(await this.valor(comando, ['imposto'], 0, sessao, `Alíquota de imposto (0-100, atual ${(atual.aliquotaImposto * 100).toFixed(2)}): `)) / 100;
      const depreciacao = Number(await this.valor(comando, ['depreciacao'], 1, sessao, `Depreciação anual (0-100, atual ${(atual.coeficienteDepreciacaoAnual * 100).toFixed(2)}): `)) / 100;
      this.dados.atualizarConfiguracoes(imposto, depreciacao);
      console.log('[SUCESSO] Configurações atualizadas.');
    } else if (nome === 'org listar') {
      console.table(this.dados.organizacoes().map(({ id, razaoSocial, cnpj, email, ativo }) => ({ id, razaoSocial, cnpj, email, ativo })));
    } else if (nome === 'org criar') {
      const razao = await this.valor(comando, ['nome'], 0, sessao, 'Razão social: ');
      const cnpj = await this.valor(comando, ['cnpj'], 1, sessao, 'CNPJ: ');
      const email = await this.valor(comando, ['email'], 2, sessao, 'E-mail: ');
      const org = this.dados.criarOrganizacao(razao, cnpj, email);
      console.log(`[SUCESSO] Organização ${org.id} cadastrada.`);
    } else if (nome === 'contrato listar') {
      console.table(this.dados.contratos());
    } else if (nome === 'contrato criar') {
      const org = await this.valor(comando, ['org'], 0, sessao, 'ID da organização: ');
      const vencimento = await this.valor(comando, ['vencimento'], 1, sessao, 'Vencimento (AAAA-MM-DD): ');
      const valor = Number(await this.valor(comando, ['valor'], 2, sessao, 'Valor mensal (R$): '));
      const renovacao = await this.valor(comando, ['renovacao'], 3, sessao, 'Renovação automática? (s/n): ', false, 'n');
      const contrato = this.dados.criarContrato(org, new Date(`${vencimento}T12:00:00`), valor, renovacao.toLowerCase() === 's');
      console.log(`[SUCESSO] Contrato ${contrato.id} cadastrado.`);
    } else if (nome === 'lote listar') {
      console.table(this.dados.lotes().map(l => ({ id: l.id, org: l.organizacaoId, nf: l.notaFiscal, data: new Date(l.dataEntrada).toLocaleDateString(), equipamentos: l.equipamentos.length })));
    } else if (nome === 'lote criar') {
      const org = await this.valor(comando, ['org'], 0, sessao, 'ID da organização: ');
      const nf = await this.valor(comando, ['nf'], 1, sessao, 'Nota fiscal: ');
      const transp = await this.valor(comando, ['transp'], 2, sessao, 'Transportadora: ');
      const textoData = await this.valor(comando, ['data'], 3, sessao, 'Data de entrada (AAAA-MM-DD, vazio=hoje): ', false);
      const data = textoData ? new Date(`${textoData}T12:00:00`) : new Date();
      const lote = this.dados.criarLote(org, nf, transp, data);
      console.log(`[SUCESSO] Lote ${lote.id} criado.`);
    } else if (nome === 'equip adicionar') {
      const lote = await this.valor(comando, ['lote'], 0, sessao, 'ID do lote: ');
      const tipoInformado = await this.valor(comando, ['tipo'], 1, sessao, `Tipo (${Object.values(TipoEquipamento).join(', ')}): `);
      const marca = await this.valor(comando, ['marca'], 2, sessao, 'Marca: ');
      const modelo = await this.valor(comando, ['modelo'], 3, sessao, 'Modelo: ');
      const ano = Number(await this.valor(comando, ['ano'], 4, sessao, 'Ano de fabricação: '));
      const peso = Number(await this.valor(comando, ['peso'], 5, sessao, 'Peso (kg): '));
      const tipo = normalizarValorEnum(Object.values(TipoEquipamento), tipoInformado);
      if (!tipo) throw new Error('Tipo de equipamento inválido.');
      const equipamento = this.dados.adicionarEquipamento(lote, tipo, marca, modelo, ano, peso);
      console.log(`[SUCESSO] Equipamento criado. Código de barras: ${equipamento.codigoBarrasInterno}`);
    } else if (nome === 'equip triagem') {
      const id = await this.valor(comando, ['id'], 0, sessao, 'Código/ID: ');
      const acao = await this.valor(comando, ['acao'], 1, sessao, 'Ação (iniciar/concluir): ');
      const acaoNormalizada = acao.toLocaleLowerCase('pt-BR');
      const equipamento = acaoNormalizada === 'iniciar' ? this.dados.iniciarTriagem(id) : acaoNormalizada === 'concluir' ? this.dados.concluirTriagem(id) : undefined;
      if (!equipamento) throw new Error('Ação inválida. Use iniciar ou concluir.');
      console.log(`[SUCESSO] Triagem atualizada: ${equipamento.statusRastreamento}`);
    } else if (nome === 'equip mover') {
      const id = await this.valor(comando, ['id'], 0, sessao, 'Código/ID: ');
      const destino = await this.valor(comando, ['destino'], 1, sessao, `Destino/status (${Object.values(StatusRastreamento).join(', ')}): `);
      const observacao = await this.valor(comando, ['observacao'], 2, sessao, 'Observação: ', false);
      const destinoNormalizado = normalizarValorEnum(Object.values(StatusRastreamento), destino);
      if (!destinoNormalizado) throw new Error('Status de destino inválido.');
      const equipamento = this.dados.atualizarEquipamento(id, e => {
        e.atualizarStatus(destinoNormalizado, observacao);
        e.registrarMovimentacao(destinoNormalizado, sessao.usuario);
      }, 'EQUIPAMENTO_MOVIDO');
      console.log(`[SUCESSO] Status atualizado para ${equipamento.statusRastreamento}.`);
    } else if (nome === 'equip estado') {
      const id = await this.valor(comando, ['id'], 0, sessao, 'Código/ID: ');
      const estado = await this.valor(comando, ['estado'], 1, sessao, `Estado (${Object.values(EstadoFisico).join(', ')}): `);
      const justificativa = await this.valor(comando, ['justificativa'], 2, sessao, 'Justificativa (se aplicável): ', false);
      const estadoNormalizado = normalizarValorEnum(Object.values(EstadoFisico), estado);
      if (!estadoNormalizado) throw new Error('Estado inválido.');
      this.dados.atualizarEquipamento(id, e => e.alterarEstadoFisico(estadoNormalizado, justificativa), 'ESTADO_FISICO_ALTERADO');
      console.log('[SUCESSO] Estado físico alterado.');
    } else if (nome === 'equip rastrear') {
      const id = await this.valor(comando, ['id'], 0, sessao, 'Código de barras ou ID do equipamento: ');
      const equipamento = this.dados.rastrear(id);
      if (!equipamento) throw new Error('Equipamento não encontrado.');
      console.log(`${equipamento.codigoBarrasInterno} | ${equipamento.tipo} | ${equipamento.statusRastreamento}`);
      console.table(equipamento.historicoMovimentacao.map(m => ({ ...m, dataHora: new Date(m.dataHora).toLocaleString() })));
    } else if (nome === 'historico') {
      console.table(this.dados.transacoes().map((t: any) => ({ dataHora: new Date(t.dataHora).toLocaleString(), evento: t.tipoEvento, operacao: t.operacao, transacaoId: t.transacaoId })));
    } else if (nome === 'relatorio') {
      console.log(this.dados.relatorio());
    }
  }

  private async perguntarSessao(sessao: Sessao, mensagem: string, guardarHistorico = false): Promise<string> {
    if (!sessao.isValida()) throw new Error('Sessão expirada por inatividade.');
    const resposta = await this.cli.perguntar(mensagem, guardarHistorico);
    if (!sessao.isValida()) throw new Error('Sessão expirada por inatividade.');
    sessao.renovar();
    return resposta;
  }
}
