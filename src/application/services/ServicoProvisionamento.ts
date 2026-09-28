import { existsSync, writeFileSync, renameSync, readFileSync } from "fs";

import { Credencial } from "../../domain/entities/Credencial.js";
import { PapelUsuario } from "../../domain/enums.js";
import { HashSenha } from "../../infrastructure/security/HashSenha.js";
import { GerenciadorChave } from "../../infrastructure/security/GerenciadorChave.js";
import { RepositorioCredenciais } from "../../infrastructure/persistence/RepositorioCredenciais.js";

export class ServicoProvisionamento {
  private caminhoConfiguracao = "./greencode-config.json";

  private hashSenha: HashSenha;
  private gerenciadorChave: GerenciadorChave;
  private repositorioCredenciais: RepositorioCredenciais;

  constructor() {
    this.hashSenha = new HashSenha();
    this.gerenciadorChave = new GerenciadorChave();
    this.repositorioCredenciais = new RepositorioCredenciais();
  }

  sistemaConfigurado(): boolean {
    return existsSync(this.caminhoConfiguracao);
  }

  provisionar(usuario: string, senha: string): void {
    if (this.sistemaConfigurado()) {
      throw new Error("O sistema já foi configurado.");
    }
    if (senha.length < 4) {
      throw new Error("A senha deve ter pelo menos 4 caracteres.");
    }

    const chave = this.gerenciadorChave.gerarChave();

    const resultadoHash = this.hashSenha.gerarHash(senha);

    const administrador = new Credencial(
      usuario,
      resultadoHash.hash,
      resultadoHash.salt,
      new Date(),
      PapelUsuario.ADMINISTRADOR,
    );

    const configuracao = {
      chaveMestra: chave.toString("hex"),

      administrador: {
        usuario: administrador.usuario,

        papel: administrador.papel,
      },
    };

    const caminhoTemporario = `${this.caminhoConfiguracao}.tmp`;

    writeFileSync(
      caminhoTemporario,
      JSON.stringify(configuracao, null, 2),
      "utf-8",
    );

    renameSync(caminhoTemporario, this.caminhoConfiguracao);
    this.repositorioCredenciais.salvar(administrador);
  }

  carregarConfiguracao(): {
    chaveMestra: Buffer;
    administrador: Credencial;
  } {
    if (!this.sistemaConfigurado()) {
      throw new Error("O sistema ainda não foi configurado.");
    }

    const conteudo = readFileSync(this.caminhoConfiguracao, "utf-8");

    const configuracao = JSON.parse(conteudo);

    const administrador = this.repositorioCredenciais.buscarPorUsuario(
      configuracao.administrador.usuario,
    );

    if (!administrador) {
      throw new Error("Credenciais do administrador não encontradas.");
    }

    return {
      chaveMestra: Buffer.from(configuracao.chaveMestra, "hex"),

      administrador,
    };
  }
}
