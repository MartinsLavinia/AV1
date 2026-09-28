import { Credencial } from '../../domain/entities/Credencial.js';
import { RepositorioArquivo } from './RepositorioArquivo.js';
import { PapelUsuario } from '../../domain/enums.js';

interface DadosCredencial {
    usuario: string;
    hashSenha: string;
    salt: string;
    ultimoAcesso: string;
    papel: PapelUsuario;
}

export class RepositorioCredenciais {

    private repositorio: RepositorioArquivo;
    private nomeArquivo = 'credenciais.json';

    constructor() {
        this.repositorio = new RepositorioArquivo();
    }

    salvar(credencial: Credencial): void {

        const credenciais = this.listar();

        credenciais.push(credencial);

        const dados: DadosCredencial[] = credenciais.map(
            credencial => ({
                usuario: credencial.usuario,
                hashSenha: credencial.hashSenha,
                salt: credencial.salt,
                ultimoAcesso: credencial.ultimoAcesso.toISOString(),
                papel: credencial.papel
            })
        );

        this.repositorio.salvar(
            this.nomeArquivo,
            dados
        );
    }

    listar(): Credencial[] {

        const dados =
            this.repositorio.carregar<DadosCredencial[]>(
                this.nomeArquivo
            ) ?? [];

        return dados.map(
            dado =>
                new Credencial(
                    dado.usuario,
                    dado.hashSenha,
                    dado.salt,
                    new Date(dado.ultimoAcesso),
                    dado.papel
                )
        );
    }

    buscarPorUsuario(usuario: string): Credencial | null {

        const credencial = this.listar().find(
            credencial =>
                credencial.usuario === usuario
        );

        return credencial ?? null;
    }
}