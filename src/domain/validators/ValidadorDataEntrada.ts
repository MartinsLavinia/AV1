import { Validador } from './Validador.js';

export class ValidadorDataEntrada extends Validador {

  validar(data: Date): boolean {
    if (!(data instanceof Date) || Number.isNaN(data.getTime())) return false;
    const hoje = new Date();

    if (data > hoje) {
      return false;
    }

    const limite = new Date();
    limite.setDate(hoje.getDate() - 90);

    if (data < limite) {
      return false;
    }

    return true;
  }

  obterMensagemErro(): string {
    return 'A data de entrada deve estar entre hoje e os últimos 90 dias.';
  }
}
