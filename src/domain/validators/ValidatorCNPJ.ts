import { Validador } from './Validador';

export class ValidadorCNPJ extends Validador {

  validar(cnpj: string): boolean {
    cnpj = cnpj.replace(/\D/g, '');

    if (cnpj.length !== 14) {
      return false;
    }

    if (/^(\d)\1{13}$/.test(cnpj)) {
      return false;
    }

    let soma = 0;
    let peso = 5;

    for (let i = 0; i < 12; i++) {
      soma += Number(cnpj[i]) * peso;
      peso--;

      if (peso === 1) {
        peso = 9;
      }
    }

    let resto = soma % 11;
    const digito1 = resto < 2 ? 0 : 11 - resto;

    if (digito1 !== Number(cnpj[12])) {
      return false;
    }

    soma = 0;
    peso = 6;

    for (let i = 0; i < 13; i++) {
      soma += Number(cnpj[i]) * peso;
      peso--;

      if (peso === 1) {
        peso = 9;
      }
    }

    resto = soma % 11;
    const digito2 = resto < 2 ? 0 : 11 - resto;

    return digito2 === Number(cnpj[13]);
  }

  obterMensagemErro(): string {
    return 'CNPJ inválido.';
  }
}