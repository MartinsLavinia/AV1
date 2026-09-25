import { Equipamento } from './Equipamento';
import { StatusLote } from '../enums';

export class Lote {
    id: string;
    dataEntrada: Date;
    organizacaoId: string;
    notaFiscal: string;
    transportadora: string;
    equipamentos: Equipamento[];
    statusProcessamento: StatusLote;
    observacoes: string;

    constructor(
        id: string,
        dataEntrada: Date,
        organizacaoId: string,
        notaFiscal: string,
        transportadora: string,
        equipamentos: Equipamento[],
        statusProcessamento: StatusLote,
        observacoes: string
    ) {
        this.id = id;
        this.dataEntrada = dataEntrada;
        this.organizacaoId = organizacaoId;
        this.notaFiscal = notaFiscal;
        this.transportadora = transportadora;
        this.equipamentos = equipamentos;
        this.statusProcessamento = statusProcessamento;
        this.observacoes = observacoes;
    }

    adicionarEquipamento(equip: Equipamento): void {
        // Implementação
    }

    removerEquipamento(equipId: string): boolean {
        return false;
    }

    calcularPesoTotal(): number {
        return 0;
    }

    gerarRelatorioTriagem(): string {
        return '';
    }
}