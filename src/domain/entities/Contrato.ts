export class Contrato {
    id: string;
    organizacaoId: string;
    dataAssinatura: Date;
    dataVencimento: Date;
    clausulas: string[];
    valorMensal: number;
    renovacaoAutomatica: boolean;

    constructor(
        id: string,
        organizacaoId: string,
        dataAssinatura: Date,
        dataVencimento: Date,
        clausulas: string[],
        valorMensal: number,
        renovacaoAutomatica: boolean
    ) {
        this.id = id;
        this.organizacaoId = organizacaoId;
        this.dataAssinatura = dataAssinatura;
        this.dataVencimento = dataVencimento;
        this.clausulas = clausulas;
        this.valorMensal = valorMensal;
        this.renovacaoAutomatica = renovacaoAutomatica;
    }

    estaVigente(): boolean {
        const agora = new Date();
        return this.dataAssinatura <= agora && this.dataVencimento >= agora;
    }

    renovar(novoVencimento: Date): void {
        if (novoVencimento <= this.dataVencimento) throw new Error('O novo vencimento deve ser posterior ao atual.');
        this.dataVencimento = novoVencimento;
    }
}
