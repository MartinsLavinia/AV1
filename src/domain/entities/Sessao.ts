import { PapelUsuario } from "../enums";

export class Sessao {
  token: string;
  usuario: string;
  papel: PapelUsuario;
  criacao: Date;
  expiracao: Date;

  constructor(
    token: string,
    usuario: string,
    papel: PapelUsuario,
    criacao: Date,
    expiracao: Date,
  ) {
    this.token = token;
    this.usuario = usuario;
    this.papel = papel;
    this.criacao = criacao;
    this.expiracao = expiracao;
  }

  isValida(): boolean {
    return new Date() < this.expiracao;
  }

  renovar(): void {
    const agora = new Date();

    this.criacao = agora;

    this.expiracao = new Date(agora.getTime() + 30 * 60 * 1000);
  }
}
