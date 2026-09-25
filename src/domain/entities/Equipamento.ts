import {
    TipoEquipamento,
    EstadoFisico,
    StatusRastreamento
} from '../enums';

import { Movimentacao } from './Movimentacao';

export class Equipamento {
    id: string;
    codigoBarrasInterno: string;
    tipo: TipoEquipamento;
    marca: string;
    modelo: string;
    anoFabricacao: number;
    estadoFisico: EstadoFisico;
    pesoQuilogramas: number;
    loteId: string;
    posicaoNoLote: number;
    statusRastreamento: StatusRastreamento;
    historicoMovimentacao: Movimentacao[];

    constructor(
        id: string,
        codigoBarrasInterno: string,
        tipo: TipoEquipamento,
        marca: string,
        modelo: string,
        anoFabricacao: number,
        estadoFisico: EstadoFisico,
        pesoQuilogramas: number,
        loteId: string,
        posicaoNoLote: number,
        statusRastreamento: StatusRastreamento,
        historicoMovimentacao: Movimentacao[]
    ) {
        this.id = id;
        this.codigoBarrasInterno = codigoBarrasInterno;
        this.tipo = tipo;
        this.marca = marca;
        this.modelo = modelo;
        this.anoFabricacao = anoFabricacao;
        this.estadoFisico = estadoFisico;
        this.pesoQuilogramas = pesoQuilogramas;
        this.loteId = loteId;
        this.posicaoNoLote = posicaoNoLote;
        this.statusRastreamento = statusRastreamento;
        this.historicoMovimentacao = historicoMovimentacao;
    }

    atualizarStatus(
        novoStatus: StatusRastreamento,
        justificativa: string
    ): void {
        // Implementação
    }

    registrarMovimentacao(
        destino: string,
        responsavel: string
    ): void {
        // Implementação
    }

    calcularDepreciacao(): number {
        return 0;
    }
}