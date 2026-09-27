import { existsSync, writeFileSync, renameSync, readFileSync} from "fs";
import { Credencial } from "../../domain/entities/Credencial.js";
import { PapelUsuario } from "../../domain/enums.js";
import { HashSenha } from "../../infrastructure/security/HashSenha.js";
import { GerenciadorChave } from "../../infrastructure/security/GerenciadorChave.js";
export class ServicoProvisionamento {
  private caminhoConfiguracao = "./greencode-config.json";
  private hashSenha: HashSenha;
  private gerenciadorChave: GerenciadorChave;
  constructor() {
    this.hashSenha = new HashSenha();
    this.gerenciadorChave = new GerenciadorChave();
  }
  sistemaConfigurado(): boolean {
    return existsSync(this.caminhoConfiguracao);
  }
  provisionar(usuario: string, senha: string): void {
    if (this.sistemaConfigurado()) {
      throw new Error("O sistema já foi configurado.");
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
        hashSenha: administrador.hashSenha,
        salt: administrador.salt,
        ultimoAcesso: administrador.ultimoAcesso,
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
  }

  carregarConfiguracao(): {
    chaveMestra: Buffer;
    administrador: Credencial;
} {

    if (!this.sistemaConfigurado()) {
        throw new Error(
            'O sistema ainda não foi configurado.'
        );
    }

    const conteudo = readFileSync(
        this.caminhoConfiguracao,
        'utf-8'
    );

    const configuracao = JSON.parse(conteudo);

    const administrador = new Credencial(
        configuracao.administrador.usuario,
        configuracao.administrador.hashSenha,
        configuracao.administrador.salt,
        new Date(configuracao.administrador.ultimoAcesso),
        configuracao.administrador.papel
    );

    return {
        chaveMestra: Buffer.from(
            configuracao.chaveMestra,
            'hex'
        ),
        administrador
    };
}
}
