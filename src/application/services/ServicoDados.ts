import { randomUUID } from 'crypto';
import { RepositorioArquivo } from '../../infrastructure/persistence/RepositorioArquivo.js';
import { Journal } from '../../infrastructure/persistence/Journal.js';
import { Transacao } from '../../infrastructure/persistence/Transacao.js';
import { ValidadorCNPJ } from '../../domain/validators/ValidatorCNPJ.js';
import { ValidadorDataEntrada } from '../../domain/validators/ValidadorDataEntrada.js';
import { PapelUsuario, StatusLote, TipoEquipamento, EstadoFisico, StatusRastreamento } from '../../domain/enums.js';
import { Organizacao } from '../../domain/entities/Organizacao.js';
import { Contrato } from '../../domain/entities/Contrato.js';
import { Lote } from '../../domain/entities/Lote.js';
import { Equipamento } from '../../domain/entities/Equipamento.js';
import { Movimentacao } from '../../domain/entities/Movimentacao.js';
import { Credencial } from '../../domain/entities/Credencial.js';
import { HashSenha } from '../../infrastructure/security/HashSenha.js';

export class ServicoDados {
  private repo = new RepositorioArquivo();
  private journal = new Journal();
  constructor() {
    this.journal.recuperar(tx => {
      const payload = tx.dados as { arquivo?: string; dados?: unknown };
      if (payload?.arquivo && Object.prototype.hasOwnProperty.call(payload, 'dados')) this.repo.salvar(payload.arquivo, payload.dados);
    });
  }
  private ler<T>(arquivo: string): T[] { return this.repo.carregar<T[]>(arquivo) ?? []; }
  private salvar(arquivo: string, dados: unknown, operacao: string): void {
    const tx = new Transacao(operacao, { arquivo, dados });
    this.journal.registrar(tx); // journal durável antes da alteração do estado
    this.repo.salvar(arquivo, dados);
    this.journal.marcarComoAplicada(tx);
  }
  organizacoes(): Organizacao[] {
    return this.ler<any>('organizacoes.json').map(o => new Organizacao(
      o.id, o.razaoSocial, o.cnpj, o.inscricaoEstadual, o.enderecoCompleto,
      o.telefone, o.email, new Date(o.dataCadastro), o.ativo,
      this.hidratarContrato(o.contratoVigente),
    ));
  }
  configuracoes(): { aliquotaImposto: number; coeficienteDepreciacaoAnual: number } {
    return this.repo.carregar<{ aliquotaImposto: number; coeficienteDepreciacaoAnual: number }>('configuracoes.json') ?? { aliquotaImposto: 0, coeficienteDepreciacaoAnual: 0.1 };
  }
  atualizarConfiguracoes(aliquotaImposto: number, coeficienteDepreciacaoAnual: number): void {
    if (![aliquotaImposto, coeficienteDepreciacaoAnual].every(Number.isFinite) || aliquotaImposto < 0 || aliquotaImposto > 1 || coeficienteDepreciacaoAnual < 0 || coeficienteDepreciacaoAnual > 1) throw new Error('Alíquotas e coeficientes devem estar entre 0 e 1.');
    this.salvar('configuracoes.json', { aliquotaImposto, coeficienteDepreciacaoAnual }, 'CONFIGURACOES_ATUALIZADAS');
  }
  criarContrato(orgId: string, dataVencimento: Date, valorMensal: number, renovacaoAutomatica: boolean): Contrato {
    if (!this.organizacoes().some(o => o.id === orgId)) throw new Error('Organização não encontrada.');
    if (!(dataVencimento instanceof Date) || Number.isNaN(dataVencimento.getTime()) || dataVencimento <= new Date() || !Number.isFinite(valorMensal) || valorMensal < 0) throw new Error('Vencimento ou valor de contrato inválido.');
    const contrato = new Contrato(randomUUID(), orgId, new Date(), dataVencimento, [], valorMensal, renovacaoAutomatica);
    this.salvar('contratos.json', [...this.ler<Contrato>('contratos.json'), contrato], 'CONTRATO_CRIADO'); return contrato;
  }
  contratos(): Contrato[] { return this.ler<any>('contratos.json').map(c => this.hidratarContrato(c)); }
  lotes(): Lote[] {
    return this.ler<any>('lotes.json').map(l => new Lote(
      l.id, new Date(l.dataEntrada), l.organizacaoId, l.notaFiscal,
      l.transportadora, (l.equipamentos ?? []).map((e: any) => this.hidratarEquipamento(e)),
      l.statusProcessamento, l.observacoes,
    ));
  }
  equipamentos(): Equipamento[] { return this.ler<any>('equipamentos.json').map(e => this.hidratarEquipamento(e)); }
  criarOrganizacao(nome: string, cnpj: string, email: string): Organizacao {
    if (!new ValidadorCNPJ().validar(cnpj)) throw new Error('CNPJ inválido.');
    if (this.organizacoes().some(o => o.cnpj.replace(/\D/g, '') === cnpj.replace(/\D/g, ''))) throw new Error('CNPJ já cadastrado.');
    const id = `ORG-${randomUUID().slice(0,8).toUpperCase()}`;
    const contrato = new Contrato(randomUUID(), id, new Date(), new Date(Date.now()+365*86400000), [], 0, false);
    const org = new Organizacao(id, nome, cnpj, '', '', '', email, new Date(), true, contrato);
    this.salvar('organizacoes.json', [...this.organizacoes(), org], 'ORGANIZACAO_CRIADA'); return org;
  }
  criarLote(orgId: string, nf: string, transportadora: string, dataEntrada = new Date()): Lote {
    if (!this.organizacoes().some(o => o.id === orgId)) throw new Error('Organização não encontrada.');
    if (!new ValidadorDataEntrada().validar(dataEntrada)) throw new Error(new ValidadorDataEntrada().obterMensagemErro());
    const lote = new Lote(`LOT-${randomUUID().slice(0,8).toUpperCase()}`, dataEntrada, orgId, nf, transportadora, [], StatusLote.RECEBIDO, '');
    this.salvar('lotes.json', [...this.lotes(), lote], 'LOTE_CRIADO'); return lote;
  }
  adicionarEquipamento(loteId: string, tipo: TipoEquipamento, marca: string, modelo: string, ano: number, peso: number): Equipamento {
    const anoAtual = new Date().getFullYear();
    if (!Object.values(TipoEquipamento).includes(tipo) || !Number.isInteger(ano) || ano < 1970 || ano > anoAtual || !Number.isFinite(peso) || peso <= 0 || !marca.trim() || !modelo.trim()) throw new Error('Dados do equipamento inválidos.');
    const lotes = this.lotes(), lote = lotes.find(l => l.id === loteId); if (!lote) throw new Error('Lote não encontrado.');
    const equip = new Equipamento(randomUUID(), `GC-${Date.now()}-${randomUUID().slice(0,4).toUpperCase()}`, tipo, marca, modelo, ano, EstadoFisico.USADO_LEVE, peso, loteId, lote.equipamentos.length+1, StatusRastreamento.AGUARDANDO_TRIAGEM, []);
    const todos = [...this.equipamentos(), equip]; lote.equipamentos.push(equip);
    this.salvar('equipamentos.json', todos, 'EQUIPAMENTO_CRIADO'); this.salvar('lotes.json', lotes, 'EQUIPAMENTO_ADICIONADO_A_LOTE'); return equip;
  }
  atualizarEquipamento(id: string, mutacao: (e: Equipamento) => void, evento: string): Equipamento {
    const todos = this.equipamentos(), e = todos.find(x => x.id === id || x.codigoBarrasInterno === id); if (!e) throw new Error('Equipamento não encontrado.');
    mutacao(e); this.salvar('equipamentos.json', todos, evento);
    if (e.historicoMovimentacao.length) this.salvar('movimentacoes.json', todos.flatMap(x => x.historicoMovimentacao), 'MOVIMENTACAO_REGISTRADA'); return e;
  }
  iniciarTriagem(id: string): Equipamento { return this.atualizarEquipamento(id, e => { if(e.statusRastreamento!==StatusRastreamento.AGUARDANDO_TRIAGEM) throw new Error('Status inválido para iniciar triagem.'); e.statusRastreamento=StatusRastreamento.EM_TRIAGEM; }, 'TRIAGEM_INICIADA'); }
  concluirTriagem(id: string): Equipamento { return this.atualizarEquipamento(id, e => e.concluirTriagem(), 'TRIAGEM_CONCLUIDA'); }
  movimentar(id: string, destino: string, responsavel: string, observacao = ''): Equipamento {
    return this.atualizarEquipamento(id, e => { const origem=e.historicoMovimentacao.at(-1)?.destino ?? 'RECEBIMENTO'; e.historicoMovimentacao.push(new Movimentacao(randomUUID(),e.id,new Date(),origem,destino,responsavel,observacao)); }, 'EQUIPAMENTO_MOVIMENTADO');
  }
  rastrear(id: string): Equipamento | undefined { return this.equipamentos().find(e => e.id===id || e.codigoBarrasInterno===id); }
  criarUsuario(usuario: string, senha: string, papel: PapelUsuario): void {
    if (senha.length < 4) throw new Error('A senha deve ter pelo menos 4 caracteres.');
    const arquivo='credenciais.json', atual=this.ler<{usuario:string}> (arquivo); if(atual.some(x=>x.usuario===usuario)) throw new Error('Usuário já existe.');
    const {hash,salt}=new HashSenha().gerarHash(senha); atual.push(new Credencial(usuario,hash,salt,new Date(),papel)); this.salvar(arquivo,atual,'USUARIO_CRIADO');
  }
  transacoes(): unknown[] { this.journal.limparAntigas(); return this.journal.listarTransacoes(); }
  relatorio(): { organizacoes: number; lotes: number; equipamentos: number; pesoTotalKg: number; depreciacaoEstimadaKg: number; porStatus: Record<string, number> } {
    const equipamentos=this.equipamentos(), porStatus:Record<string,number>={};
    for (const e of equipamentos) porStatus[e.statusRastreamento]=(porStatus[e.statusRastreamento]??0)+1;
    const coeficiente=this.configuracoes().coeficienteDepreciacaoAnual;
    return { organizacoes:this.organizacoes().length, lotes:this.lotes().length, equipamentos:equipamentos.length, pesoTotalKg:equipamentos.reduce((s,e)=>s+e.pesoQuilogramas,0), depreciacaoEstimadaKg:equipamentos.reduce((s,e)=>s+e.calcularDepreciacao(coeficiente),0), porStatus };
  }

  private hidratarContrato(c: any): Contrato {
    return new Contrato(c.id, c.organizacaoId, new Date(c.dataAssinatura), new Date(c.dataVencimento), c.clausulas ?? [], c.valorMensal, c.renovacaoAutomatica);
  }

  private hidratarEquipamento(e: any): Equipamento {
    const historico = (e.historicoMovimentacao ?? []).map((m: any) => new Movimentacao(
      m.id, m.equipamentoId, new Date(m.dataHora), m.origem, m.destino,
      m.responsavel, m.observacao,
    ));
    return new Equipamento(
      e.id, e.codigoBarrasInterno, e.tipo, e.marca, e.modelo, e.anoFabricacao,
      e.estadoFisico, e.pesoQuilogramas, e.loteId, e.posicaoNoLote,
      e.statusRastreamento, historico,
    );
  }
}
