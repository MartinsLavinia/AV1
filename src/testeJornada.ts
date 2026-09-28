import assert from 'node:assert/strict';
import * as nodeFs from 'node:fs';
import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ServicoProvisionamento } from './application/services/ServicoProvisionamento.js';
import { ServicoDados } from './application/services/ServicoDados.js';
import { ServicoAutenticacao } from './application/services/ServicoAutenticacao.js';
import { EstadoFisico, PapelUsuario, StatusRastreamento, TipoEquipamento } from './domain/enums.js';
import { RepositorioCredenciais } from './infrastructure/persistence/RepositorioCredenciais.js';
import { Menu, normalizarPapel, normalizarValorEnum } from './cli/Menu.js';
import { InterfaceCLI } from './cli/InterfaceCLI.js';
import { Sessao } from './domain/entities/Sessao.js';
import { Journal } from './infrastructure/persistence/Journal.js';
import { Transacao } from './infrastructure/persistence/Transacao.js';
import { OperacoesEscritaArquivo, RepositorioArquivo } from './infrastructure/persistence/RepositorioArquivo.js';

const original = process.cwd();
const sandbox = mkdtempSync(join(tmpdir(), 'greencode-jornada-'));
try {
  process.chdir(sandbox);
  const setup = new ServicoProvisionamento();
  assert.equal(setup.sistemaConfigurado(), false, 'instalação nova deve pedir provisionamento');
  assert.throws(() => setup.provisionar('admin', '123'), /4 caracteres/);
  assert.equal(setup.sistemaConfigurado(), false, 'senha curta não deve concluir provisionamento');
  setup.provisionar('admin', 'Senha-forte-123');
  assert.equal(setup.sistemaConfigurado(), true);
  const administrador = new RepositorioCredenciais().buscarPorUsuario('admin');
  assert.ok(administrador?.verificarSenha('Senha-forte-123'));
  assert.equal(administrador?.verificarSenha('senha errada'), false);
  const autenticacao = new ServicoAutenticacao();
  assert.ok(administrador && autenticacao.autenticar(administrador, 'admin', 'Senha-forte-123'));
  assert.equal(administrador && autenticacao.autenticar(administrador, 'admin', 'senha errada'), null);
  assert.equal(administrador && autenticacao.autenticar(administrador, 'usuario-inexistente', 'Senha-forte-123'), null);

  const app = new ServicoDados();
  assert.throws(() => app.criarUsuario('operador', 'abc', PapelUsuario.OPERADOR_CADASTRO), /4 caracteres/);
  app.criarUsuario('operador', 'abcd', PapelUsuario.OPERADOR_CADASTRO);
  assert.equal(new RepositorioCredenciais().buscarPorUsuario('operador')?.verificarSenha('abcd'), true);
  assert.throws(() => app.criarOrganizacao('Inválida', '11111111111111', 'x@y.com'), /CNPJ inválido/);
  const org = app.criarOrganizacao('Empresa Exemplo', '11222333000181', 'contato@exemplo.com');
  assert.throws(() => app.criarOrganizacao('Duplicada', '11.222.333/0001-81', 'x@y.com'), /já cadastrado/);
  assert.equal(org.contratoVigente.organizacaoId, org.id, 'contrato vigente deve apontar para a organização');
  assert.throws(() => app.criarLote(org.id, 'NF-FUTURA', 'Transportes Exemplo', new Date(Date.now() + 86400000)), /90 dias/);
  assert.throws(() => app.criarLote(org.id, 'NF-ANTIGA', 'Transportes Exemplo', new Date(Date.now() - 91 * 86400000)), /90 dias/);
  const lote = app.criarLote(org.id, 'NF-1234', 'Transportes Exemplo');
  const equipamento = app.adicionarEquipamento(lote.id, 'NOTEBOOK' as import('./domain/enums.js').TipoEquipamento, 'Marca', 'Modelo', 2022, 2.4);
  assert.throws(() => app.atualizarEquipamento(equipamento.id, e => e.atualizarStatus(StatusRastreamento.EM_DESMONTE, ''), 'TESTE'), /triagem completa/);
  assert.throws(() => app.atualizarEquipamento(equipamento.id, e => e.alterarEstadoFisico(EstadoFisico.DANIFICADO_GRAVE, ''), 'TESTE'), /Justificativa/);
  app.atualizarEquipamento(equipamento.id, e => e.alterarEstadoFisico(EstadoFisico.DANIFICADO_GRAVE, 'Dano identificado na inspeção'), 'TESTE_ESTADO');
  app.iniciarTriagem(equipamento.id);
  app.concluirTriagem(equipamento.id);
  app.atualizarEquipamento(equipamento.id, e => e.atualizarStatus(StatusRastreamento.EM_DESMONTE, ''), 'TESTE');
  app.movimentar(equipamento.id, 'ARMAZEM-A', 'gestor');
  app.movimentar(equipamento.id, 'BANCADA-01', 'gestor');
  const rastreado = app.rastrear(equipamento.codigoBarrasInterno);
  assert.deepEqual(
    rastreado?.historicoMovimentacao.map(m => m.destino),
    ['ARMAZEM-A', 'BANCADA-01'],
    'consulta final deve mostrar as duas movimentações em ordem',
  );
  assert.ok(app.transacoes().length >= 6, 'operações devem ficar registradas no journal');

  const cliSemEntrada = { perguntar: async () => '', definirComandosDisponiveis: () => {} };
  const menu = new Menu(cliSemEntrada as any);
  const comandos = (papel: PapelUsuario) => (menu as any).comandosPara(papel).map((comando: { nome: string }) => comando.nome);
  assert.deepEqual(comandos(PapelUsuario.ADMINISTRADOR), ['usuario criar', 'usuario listar', 'configuracao']);
  assert.ok(comandos(PapelUsuario.OPERADOR_CADASTRO).every((c: string) => c.startsWith('org ') || c.startsWith('contrato ')));
  assert.ok(comandos(PapelUsuario.GESTOR_ALMOXARIFADO).every((c: string) => c.startsWith('lote ') || c.startsWith('equip ')));
  assert.ok(comandos(PapelUsuario.AUDITOR).every((c: string) => ['equip rastrear', 'historico', 'relatorio'].includes(c)));
  const exemplo = (menu as any).interpretar('lote criar --org BR001 --nf 123456 --transp TransRapida');
  assert.equal(exemplo.nome, 'lote criar');
  assert.deepEqual(exemplo.opcoes, { org: 'BR001', nf: '123456', transp: 'TransRapida' });
  const comAspas = (menu as any).interpretar('org criar --nome "Empresa Exemplo" --cnpj 11222333000181 --email contato@exemplo.com');
  assert.equal(comAspas.opcoes.nome, 'Empresa Exemplo');
  for (const [entrada, esperado] of [
    ['administrador', PapelUsuario.ADMINISTRADOR],
    ['ADMINISTRADOR', PapelUsuario.ADMINISTRADOR],
    ['Operador_Cadastro', PapelUsuario.OPERADOR_CADASTRO],
    ['gestor-almoxarifado', PapelUsuario.GESTOR_ALMOXARIFADO],
    ['auditor', PapelUsuario.AUDITOR],
  ] as const) {
    assert.equal(normalizarPapel(entrada), esperado, `papel deve aceitar entrada sem diferenciar maiúsculas: ${entrada}`);
  }
  assert.equal(normalizarPapel('papel_inexistente'), undefined);
  assert.equal(normalizarValorEnum(Object.values(TipoEquipamento), 'notebook'), TipoEquipamento.NOTEBOOK);
  assert.equal(normalizarValorEnum(Object.values(StatusRastreamento), 'em_desmonte'), StatusRastreamento.EM_DESMONTE);
  assert.equal(normalizarValorEnum(Object.values(EstadoFisico), 'danificado_grave'), EstadoFisico.DANIFICADO_GRAVE);
  const cliAutocomplete = Object.create(InterfaceCLI.prototype) as InterfaceCLI;
  (cliAutocomplete as any).historico = [];
  cliAutocomplete.definirComandosDisponiveis(['usuario criar']);
  assert.ok(cliAutocomplete.sugerir('usuario criar --papel ges').includes('usuario criar --papel gestor_almoxarifado'));
  assert.ok(cliAutocomplete.sugerir('usuario criar --papel GES').includes('usuario criar --papel gestor_almoxarifado'));
  assert.ok(cliAutocomplete.sugerir('usuario criar --papel gestor_al').includes('usuario criar --papel gestor_almoxarifado'));
  assert.ok(cliAutocomplete.sugerir('usuario criar --papel ad').includes('usuario criar --papel administrador'));
  for (const valor of Object.values(PapelUsuario)) {
    assert.ok(cliAutocomplete.sugerir('usuario criar --papel ').includes(`usuario criar --papel ${valor.toLocaleLowerCase('pt-BR')}`));
  }
  cliAutocomplete.definirComandosDisponiveis(['contrato criar', 'equip adicionar', 'equip triagem', 'equip mover', 'equip estado']);
  assert.ok(cliAutocomplete.sugerir('equip adicionar --tipo note').includes('equip adicionar --tipo notebook'));
  assert.ok(cliAutocomplete.sugerir('equip triagem --acao ini').includes('equip triagem --acao iniciar'));
  assert.ok(cliAutocomplete.sugerir('equip triagem --acao con').includes('equip triagem --acao concluir'));
  assert.ok(cliAutocomplete.sugerir('equip mover --destino em_des').includes('equip mover --destino em_desmonte'));
  assert.ok(cliAutocomplete.sugerir('equip estado --estado danificado_g').includes('equip estado --estado danificado_grave'));
  assert.ok(cliAutocomplete.sugerir('contrato criar --renovacao ').includes('contrato criar --renovacao s'));
  assert.ok(cliAutocomplete.sugerir('contrato criar --renovacao ').includes('contrato criar --renovacao n'));
  for (const valor of Object.values(TipoEquipamento)) {
    assert.ok(cliAutocomplete.sugerir('equip adicionar --tipo ').includes(`equip adicionar --tipo ${valor.toLocaleLowerCase('pt-BR')}`));
  }
  for (const valor of Object.values(StatusRastreamento)) {
    assert.ok(cliAutocomplete.sugerir('equip mover --destino ').includes(`equip mover --destino ${valor.toLocaleLowerCase('pt-BR')}`));
  }
  for (const valor of Object.values(EstadoFisico)) {
    assert.ok(cliAutocomplete.sugerir('equip estado --estado ').includes(`equip estado --estado ${valor.toLocaleLowerCase('pt-BR')}`));
  }

  let entradas = 0;
  const menuSemPrompt = new Menu({
    definirComandosDisponiveis: () => {},
    perguntar: async () => { entradas++; return entradas === 1 ? 'lote criar' : 'sair'; },
  } as any);
  const sessaoOperador = new Sessao('token', 'operador', PapelUsuario.OPERADOR_CADASTRO, new Date(), new Date(Date.now() + 60000));
  const mensagens: string[] = [];
  const logOriginal = console.log;
  try {
    console.log = (...valores: unknown[]) => { mensagens.push(valores.join(' ')); };
    await menuSemPrompt.executar(sessaoOperador);
  } finally {
    console.log = logOriginal;
  }
  assert.equal(entradas, 2, 'comando não autorizado deve retornar ao prompt sem iniciar a operação');
  assert.ok(mensagens.some(m => m.includes('não autorizado')), 'operação deve ser recusada para papel sem permissão');

  const comandosPorPapel: Record<PapelUsuario, string[]> = {
    [PapelUsuario.ADMINISTRADOR]: ['usuario criar', 'usuario listar', 'configuracao'],
    [PapelUsuario.OPERADOR_CADASTRO]: ['org criar', 'org listar', 'contrato criar', 'contrato listar'],
    [PapelUsuario.GESTOR_ALMOXARIFADO]: ['lote criar', 'lote listar', 'equip adicionar', 'equip triagem', 'equip mover', 'equip estado'],
    [PapelUsuario.AUDITOR]: ['equip rastrear', 'historico', 'relatorio'],
  };
  const todosComandos = Object.values(comandosPorPapel).flat();
  for (const papel of Object.values(PapelUsuario)) {
    const permitidos = new Set(comandos(papel));
    for (const comandoIndevido of todosComandos.filter(c => !permitidos.has(c))) {
      let chamadasPrompt = 0;
      const mensagensRecusa: string[] = [];
      const cliFake = {
        definirComandosDisponiveis: () => {},
        perguntar: async () => ++chamadasPrompt === 1 ? comandoIndevido : 'sair',
      };
      const sessao = new Sessao('token', 'teste', papel, new Date(), new Date(Date.now() + 60000));
      const menuTeste = new Menu(cliFake as any);
      const logOriginalLocal = console.log;
      try {
        console.log = (...valores: unknown[]) => mensagensRecusa.push(valores.join(' '));
        await menuTeste.executar(sessao);
      } finally {
        console.log = logOriginalLocal;
      }
      assert.equal(chamadasPrompt, 2, `${papel} não deve executar ${comandoIndevido} nem pedir seus dados`);
      assert.ok(mensagensRecusa.some(m => m.includes('não autorizado')), `${papel} deve receber recusa para ${comandoIndevido}`);
    }
  }

  const repo = new RepositorioArquivo();
  const repoAtomico = new RepositorioArquivo();
  repoAtomico.salvar('atomicidade.json', { versao: 1 });
  const ordemEscrita: string[] = [];
  const opsRastreio: OperacoesEscritaArquivo = {
    openSync: (...args) => { ordemEscrita.push('open'); return nodeFs.openSync(...args); },
    writeFileSync: (...args) => { ordemEscrita.push('write'); return nodeFs.writeFileSync(...args); },
    fsyncSync: fd => { ordemEscrita.push('fsync'); return nodeFs.fsyncSync(fd); },
    closeSync: fd => { ordemEscrita.push('close'); return nodeFs.closeSync(fd); },
    renameSync: (oldPath, newPath) => { ordemEscrita.push('rename'); return nodeFs.renameSync(oldPath, newPath); },
    unlinkSync: path => { ordemEscrita.push('unlink'); return nodeFs.unlinkSync(path); },
  };
  new RepositorioArquivo('./data', opsRastreio).salvar('atomicidade.json', { versao: 2 });
  assert.deepEqual(ordemEscrita, ['open', 'write', 'fsync', 'close', 'rename'], 'conteúdo deve ser sincronizado e fechado antes da renomeação atômica');
  assert.deepEqual(repoAtomico.carregar('atomicidade.json'), { versao: 2 });

  const opsFsyncFalha: OperacoesEscritaArquivo = {
    ...opsRastreio,
    fsyncSync: () => { throw new Error('falha fsync simulada'); },
  };
  assert.throws(() => new RepositorioArquivo('./data', opsFsyncFalha).salvar('atomicidade.json', { versao: 3 }), /fsync/);
  assert.deepEqual(repoAtomico.carregar('atomicidade.json'), { versao: 2 }, 'falha no fsync deve preservar o estado anterior');
  assert.equal(readdirSync('./data').some(nome => nome.startsWith('atomicidade.json.') && nome.endsWith('.tmp')), false, 'falha no fsync deve remover temporário');

  const opsRenameFalha: OperacoesEscritaArquivo = {
    ...opsRastreio,
    renameSync: () => { throw new Error('falha rename simulada'); },
  };
  assert.throws(() => new RepositorioArquivo('./data', opsRenameFalha).salvar('atomicidade.json', { versao: 4 }), /rename/);
  assert.deepEqual(repoAtomico.carregar('atomicidade.json'), { versao: 2 }, 'falha na renomeação deve preservar o estado anterior');
  assert.equal(readdirSync('./data').some(nome => nome.startsWith('atomicidade.json.') && nome.endsWith('.tmp')), false, 'falha na renomeação deve remover temporário');

  const fdTemporario = nodeFs.openSync('./data/atomicidade.json.crash-simulado.tmp', 'wx', 0o600);
  try {
    const cifradoVersaoNova = new (await import('./infrastructure/security/CriptografiaArquivo.js')).CriptografiaArquivo()
      .criptografar(JSON.stringify({ versao: 5 }), Buffer.from(JSON.parse(readFileSync('./greencode-config.json', 'utf8')).chaveMestra, 'hex'));
    nodeFs.writeFileSync(fdTemporario, cifradoVersaoNova, 'utf8');
    nodeFs.fsyncSync(fdTemporario);
  } finally { nodeFs.closeSync(fdTemporario); }
  assert.deepEqual(repoAtomico.carregar('atomicidade.json'), { versao: 2 }, 'reinicialização após fsync sem rename mantém o arquivo anterior');
  nodeFs.unlinkSync('./data/atomicidade.json.crash-simulado.tmp');

  const opsWriteFalha: OperacoesEscritaArquivo = {
    ...opsRastreio,
    writeFileSync: (fd, data, options) => {
      nodeFs.writeFileSync(fd, 'conteudo parcial', 'utf8');
      throw new Error('falha de escrita simulada');
    },
  };
  assert.throws(() => new RepositorioArquivo('./data', opsWriteFalha).salvar('atomicidade.json', { versao: 6 }), /escrita/);
  assert.deepEqual(repoAtomico.carregar('atomicidade.json'), { versao: 2 }, 'falha parcial de escrita deve preservar o arquivo anterior');
  assert.equal(readdirSync('./data').some(nome => nome.startsWith('atomicidade.json.') && nome.endsWith('.tmp')), false, 'falha parcial de escrita deve remover temporário');

  // Falhas de arquivo isoladas: caminho inválido, falta de chave e dado cifrado adulterado.
  assert.throws(() => repo.salvar('../fora.json', { protegido: true }), /Nome de arquivo/);
  const pastaSemChave = join(sandbox, 'sem-chave');
  mkdirSync(pastaSemChave);
  const repoSemChave = new RepositorioArquivo(pastaSemChave);
  const cwdAntesFalhaChave = process.cwd();
  try {
    process.chdir(pastaSemChave);
    assert.throws(() => repoSemChave.salvar('teste.json', { protegido: true }), /greencode-config/);
  } finally {
    process.chdir(cwdAntesFalhaChave);
  }
  const raizArquivo = join(sandbox, 'raiz-arquivo');
  writeFileSync(raizArquivo, 'sou um arquivo, não um diretório');
  const repoCaminhoInvalido = new RepositorioArquivo(raizArquivo);
  assert.throws(() => repoCaminhoInvalido.salvar('teste.json', { protegido: true }), /ENOENT|ENOTDIR|no such file|not a directory/i);
  const conteudoOriginal = readFileSync('./greencode-config.json', 'utf8');
  try {
    writeFileSync('./greencode-config.json', JSON.stringify({ chaveMestra: '00'.repeat(32) }));
    assert.throws(() => repo.carregar('organizacoes.json'), /Unsupported state|authenticate|Unsupported state or unable to authenticate data/);
  } finally {
    writeFileSync('./greencode-config.json', conteudoOriginal);
  }
  const temporarios = readdirSync('./data').filter(nome => nome.endsWith('.tmp'));
  assert.equal(temporarios.length, 0, 'gravações bem-sucedidas não devem deixar temporários');
  const arquivoCifrado = readFileSync('./data/organizacoes.json', 'utf8');
  assert.ok(!arquivoCifrado.includes('Empresa Exemplo'), 'arquivo persistido não deve expor texto legível');
  assert.equal(existsSync('./data/organizacoes.json'), true);

  const sessaoRenovavel = new Sessao('token', 'auditor', PapelUsuario.AUDITOR, new Date(), new Date(Date.now() - 1000));
  assert.equal(sessaoRenovavel.isValida(), false, 'sessão expirada deve ser inválida');
  sessaoRenovavel.renovar();
  assert.equal(sessaoRenovavel.isValida(), true, 'atividade renova a sessão');
  assert.equal(sessaoRenovavel.expiracao.getTime() - sessaoRenovavel.criacao.getTime(), 30 * 60 * 1000);

  let prompts = 0;
  const sessaoExpirando = new Sessao('token', 'admin', PapelUsuario.ADMINISTRADOR, new Date(), new Date(Date.now() + 30 * 60 * 1000));
  const menuExpirando = new Menu({ definirComandosDisponiveis: () => {}, perguntar: async () => {
    prompts++;
    if (prompts === 1) return 'usuario criar';
    sessaoExpirando.expiracao = new Date(Date.now() - 1000); // simula 30 minutos sem resposta
    return 'usuario-teste';
  } } as any);
  const logAntesExpiracao = console.log;
  try {
    console.log = () => {};
    await menuExpirando.executar(sessaoExpirando);
  } finally {
    console.log = logAntesExpiracao;
  }
  assert.equal(prompts, 2, 'sessão expirada durante uma operação não deve seguir pedindo campos nem gravar');
  assert.equal(new RepositorioCredenciais().buscarPorUsuario('usuario-teste'), null);

  const journal = new Journal();
  const recuperavel = new Transacao('TESTE_RECUPERACAO', {
    arquivo: 'recuperacao-teste.json',
    dados: { recuperado: true },
  });
  journal.registrar(recuperavel); // queda simulada após journal e antes do estado
  new ServicoDados(); // inicialização recupera o evento pendente
  assert.deepEqual(repo.carregar('recuperacao-teste.json'), { recuperado: true });
  assert.equal(new Journal().listarPendentes().some(t => t.transacaoId === recuperavel.transacaoId), false);

  const transacoes = repo.carregar<Transacao[]>('journal.json') ?? [];
  const antiga = new Transacao('TESTE_RETENCAO_181_DIAS', {});
  antiga.dataHora = new Date(Date.now() - 181 * 24 * 60 * 60 * 1000);
  const dentroDoPrazo = new Transacao('TESTE_RETENCAO_179_DIAS', {});
  dentroDoPrazo.dataHora = new Date(Date.now() - 179 * 24 * 60 * 60 * 1000);
  repo.salvar('journal.json', [...transacoes, antiga, dentroDoPrazo]);
  new Journal().limparAntigas();
  const aposRetencao = new Journal().listarTransacoes();
  assert.equal(aposRetencao.some(t => t.transacaoId === antiga.transacaoId), false, 'registro acima de 180 dias deve ser removido pela rotina');
  assert.equal(aposRetencao.some(t => t.transacaoId === dentroDoPrazo.transacaoId), true, 'registro dentro de 180 dias deve permanecer');

  const paraRotacao = new Transacao('TESTE_ROTACAO_10MB', { conteudo: 'x'.repeat(10 * 1024 * 1024 + 1) });
  journal.registrar(paraRotacao);
  const arquivosRotacionados = readdirSync('./data').filter(nome => /^journal-.*\.json$/.test(nome));
  assert.ok(arquivosRotacionados.length > 0, 'journal acima de 10 MiB deve ser rotacionado');
  assert.ok(journal.listarTransacoes().some(t => t.transacaoId === paraRotacao.transacaoId), 'transações rotacionadas devem continuar consultáveis');
  journal.marcarComoAplicada(paraRotacao);
  assert.equal(journal.listarPendentes().some(t => t.transacaoId === paraRotacao.transacaoId), false);

  console.log('[OK] Jornada: provisionamento, rastreabilidade, autorização de todos os papéis, autocomplete, falhas de persistência, sessão, recuperação, retenção e rotação.');
} finally {
  process.chdir(original);
  rmSync(sandbox, { recursive: true, force: true });
}
