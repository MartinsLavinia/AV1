import { randomBytes } from 'crypto';

import { Credencial } from '../../domain/entities/Credencial.js';
import { Sessao } from '../../domain/entities/Sessao.js';

export class ServicoAutenticacao {

  autenticar(
    credencial: Credencial,
    senha: string
  ): Sessao | null {

    const autenticado = credencial.autenticar(
      credencial.usuario,
      senha
    );

    if (!autenticado) {
      return null;
    }

    credencial.atualizarUltimoAcesso();

    const token = randomBytes(32).toString('hex');

    const criacao = new Date();

    const expiracao = new Date(
      criacao.getTime() + 30 * 60 * 1000
    );

    return new Sessao(
      token,
      credencial.usuario,
      credencial.papel,
      criacao,
      expiracao
    );
  }

  renovarSessao(sessao: Sessao): boolean {

    if (!sessao.isValida()) {
      return false;
    }

    sessao.renovar();

    return true;
  }
}