import { Autenticavel } from '../interfaces/Autenticavel.js';
import { PapelUsuario } from '../enums.js';
import { HashSenha } from '../../infrastructure/security/HashSenha.js';

export class Credencial implements Autenticavel {

    usuario: string;
    hashSenha: string;
    salt: string;
    ultimoAcesso: Date;
    papel: PapelUsuario;

    constructor(
        usuario: string,
        hashSenha: string,
        salt: string,
        ultimoAcesso: Date,
        papel: PapelUsuario
    ) {
        this.usuario = usuario;
        this.hashSenha = hashSenha;
        this.salt = salt;
        this.ultimoAcesso = ultimoAcesso;
        this.papel = papel;
    }

    autenticar(usuario: string, senha: string): boolean {
        if (usuario !== this.usuario) {
            return false;
        }

        return this.verificarSenha(senha);
    }

    renovarToken(): string {
        return '';
    }

    verificarSenha(senhaPlana: string): boolean {
        const hashSenha = new HashSenha();

        return hashSenha.verificar(
            senhaPlana,
            this.hashSenha,
            this.salt
        );
    }

    atualizarUltimoAcesso(): void {
        this.ultimoAcesso = new Date();
    }
}