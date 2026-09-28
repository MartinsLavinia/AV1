import { Equipamento } from './Equipamento.js';
import { StatusLote } from '../enums.js';

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
        if (this.equipamentos.some(e => e.id === equip.id)) throw new Error('Equipamento já pertence a este lote.');
        if (equip.loteId !== this.id) throw new Error('O equipamento está associado a outro lote.');
        this.equipamentos.push(equip);
    }

    removerEquipamento(equipId: string): boolean {
        const index = this.equipamentos.findIndex(e => e.id === equipId);
        if (index < 0) return false;
        this.equipamentos.splice(index, 1);
        return true;
    }

    calcularPesoTotal(): number {
        return this.equipamentos.reduce((total, e) => total + e.pesoQuilogramas, 0);
    }

    gerarRelatorioTriagem(): string {
        return `Lote ${this.id} | ${this.equipamentos.length} equipamento(s) | ${this.calcularPesoTotal().toFixed(2)} kg\n` + this.equipamentos.map(e => `${e.codigoBarrasInterno} ${e.tipo} | ${e.estadoFisico} | ${e.statusRastreamento}`).join('\n');
    }
}
