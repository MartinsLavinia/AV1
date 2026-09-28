import { Contrato } from './Contrato.js';

export class Organizacao {
    id: string;
    razaoSocial: string;
    cnpj: string;
    inscricaoEstadual: string;
    enderecoCompleto: string;
    telefone: string;
    email: string;
    dataCadastro: Date;
    ativo: boolean;
    contratoVigente: Contrato;

    constructor(
        id: string,
        razaoSocial: string,
        cnpj: string,
        inscricaoEstadual: string,
        enderecoCompleto: string,
        telefone: string,
        email: string,
        dataCadastro: Date,
        ativo: boolean,
        contratoVigente: Contrato
    ) {
        this.id = id;
        this.razaoSocial = razaoSocial;
        this.cnpj = cnpj;
        this.inscricaoEstadual = inscricaoEstadual;
        this.enderecoCompleto = enderecoCompleto;
        this.telefone = telefone;
        this.email = email;
        this.dataCadastro = dataCadastro;
        this.ativo = ativo;
        this.contratoVigente = contratoVigente;
    }

    alterarEndereco(novoEndereco: string): void {
        if (!novoEndereco.trim()) throw new Error('Endereço não pode ficar vazio.');
        this.enderecoCompleto = novoEndereco.trim();
    }

    desativar(): void {
        this.ativo = false;
    }
}
