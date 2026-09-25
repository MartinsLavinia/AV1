export class Movimentacao {
    id: string;
    equipamentoId: string;
    dataHora: Date;
    origem: string;
    destino: string;
    responsavel: string;
    observacao: string;

    constructor(
        id: string,
        equipamentoId: string,
        dataHora: Date,
        origem: string,
        destino: string,
        responsavel: string,
        observacao: string
    ) {
        this.id = id;
        this.equipamentoId = equipamentoId;
        this.dataHora = dataHora;
        this.origem = origem;
        this.destino = destino;
        this.responsavel = responsavel;
        this.observacao = observacao;
    }
}