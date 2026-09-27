import { randomUUID } from 'crypto';

export enum TipoEventoTransacao {
    REGISTRO = 'REGISTRO',
    APLICACAO = 'APLICACAO'
}

export class Transacao {

    id: string;
    dataHora: Date;
    tipoEvento: TipoEventoTransacao;
    operacao: string;
    dados: unknown;
    transacaoId: string;

    constructor(
        operacao: string,
        dados: unknown,
        transacaoId: string = randomUUID(),
        tipoEvento: TipoEventoTransacao = TipoEventoTransacao.REGISTRO
    ) {
        this.id = randomUUID();
        this.dataHora = new Date();
        this.tipoEvento = tipoEvento;
        this.operacao = operacao;
        this.dados = dados;
        this.transacaoId = transacaoId;
    }
}