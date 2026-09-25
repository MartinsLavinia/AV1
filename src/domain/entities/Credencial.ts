import { Autenticavel } from '../interfaces/Autenticavel';
import { PapelUsuario } from '../enums';

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
        return false;
    }

    renovarToken(): string {
        return '';
    }

    verificarSenha(senhaPlana: string): boolean {
        return false;
    }

    atualizarUltimoAcesso(): void {
        // Implementação
    }
}