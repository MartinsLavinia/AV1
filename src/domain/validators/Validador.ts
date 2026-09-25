export abstract class Validador {
  abstract validar(valor: any): boolean;
  abstract obterMensagemErro(): string;
}