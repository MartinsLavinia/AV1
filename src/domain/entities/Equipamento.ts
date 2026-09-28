import {
    TipoEquipamento,
    EstadoFisico,
    StatusRastreamento
} from '../enums.js';

import { Movimentacao } from './Movimentacao.js';
import { randomUUID } from 'crypto';

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
        if (novoStatus === StatusRastreamento.EM_DESMONTE && this.statusRastreamento !== StatusRastreamento.AGUARDANDO_DESMONTE) throw new Error('Desmonte permitido somente após triagem completa.');
        this.statusRastreamento = novoStatus;
    }

    alterarEstadoFisico(novoEstado: EstadoFisico, justificativa: string): void {
        const estados = Object.values(EstadoFisico);
        const anterior = estados.indexOf(this.estadoFisico);
        const novo = estados.indexOf(novoEstado);
        if (novo < 0) throw new Error('Estado físico inválido.');
        if (novo - anterior >= 2 && !justificativa.trim()) throw new Error('Justificativa obrigatória para piora de duas categorias ou mais.');
        this.estadoFisico = novoEstado;
    }

    concluirTriagem(): void {
        if (this.statusRastreamento !== StatusRastreamento.EM_TRIAGEM) throw new Error('Equipamento precisa estar em triagem.');
        this.statusRastreamento = StatusRastreamento.AGUARDANDO_DESMONTE;
    }

    registrarMovimentacao(
        destino: string,
        responsavel: string
    ): void {
        const anterior = this.historicoMovimentacao.at(-1)?.destino ?? 'RECEBIMENTO';
        this.historicoMovimentacao.push(new Movimentacao(randomUUID(), this.id, new Date(), anterior, destino, responsavel, ''));
    }

    calcularDepreciacao(coeficienteAnual = 0.1): number {
        const idade = Math.max(0, new Date().getFullYear() - this.anoFabricacao);
        return this.pesoQuilogramas * Math.min(idade * coeficienteAnual, 0.9);
    }
}
