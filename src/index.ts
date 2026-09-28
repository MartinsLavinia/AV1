import { InterfaceCLI } from './cli/InterfaceCLI.js';
import { Menu } from './cli/Menu.js';
import { ServicoAutenticacao } from "./application/services/ServicoAutenticacao.js";
import { ServicoProvisionamento } from "./application/services/ServicoProvisionamento.js";
import { RepositorioCredenciais } from './infrastructure/persistence/RepositorioCredenciais.js';

const provisionamento = new ServicoProvisionamento();
const autenticacao = new ServicoAutenticacao();
const cli = new InterfaceCLI();
const menu = new Menu(cli);

async function iniciar(): Promise<void> {
  console.log("================================");
  console.log("           GREENCODE");
  console.log("================================");

  if (!provisionamento.sistemaConfigurado()) {
    console.log("\nSistema ainda não configurado.");
    console.log("Modo de provisionamento inicial.\n");

    const usuario = await cli.perguntar('Usuário administrador: ');

    let senha = '';
    while (senha.length < 4) {
      senha = await cli.perguntar("Senha do administrador (mínimo 4 caracteres): ");
      if (senha.length < 4) console.log("[ERRO] A senha deve ter pelo menos 4 caracteres.");
    }

    provisionamento.provisionar(usuario, senha);

    console.log("\n[SUCCESSO] Sistema configurado com sucesso.");
  } else {
    const usuario = await cli.perguntar("Usuário: ");

    const senha = await cli.perguntar("Senha: ");
    const credencial = new RepositorioCredenciais().buscarPorUsuario(usuario);
    const sessao = credencial ? autenticacao.autenticar(credencial, usuario, senha) : null;

    if (!sessao) {
      console.log("\n[ERRO] Usuário ou senha inválidos.");
    } else {
      console.log("\n[SUCESSO] Login realizado.");

      console.log(`Usuário: ${sessao.usuario}`);

      console.log(`Papel: ${sessao.papel}`);

      console.log(`Sessão válida até: ${sessao.expiracao.toLocaleString()}`);
      await menu.executar(sessao);
    }
  }

  cli.fechar();
}

iniciar();
