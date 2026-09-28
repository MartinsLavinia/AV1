# GreenCode — logística reversa de eletrônicos

CLI em Node.js/TypeScript para provisionamento, autenticação por papéis, cadastro de organizações/contratos/lotes, registro/triagem de equipamentos, movimentações, configurações e consulta da trilha de auditoria.

## Requisitos e execução

- Node.js 20 ou superior (Windows 10+, Ubuntu 24.04+ e derivados).
- Na primeira instalação: `npm install` e `npm run dev`.
- Para gerar JavaScript e iniciar: `npm run build` e `npm start`.
- Jornada automatizada: `npm run test:jornada`.

O workflow `.github/workflows/testes-linux.yml` roda em Ubuntu 24.04 a cada `push` e `pull_request`, e também pode ser iniciado manualmente pela aba **Actions** do GitHub. Ele instala dependências com `npm ci`, compila e executa a jornada automatizada.

No primeiro início, defina o usuário e a senha do administrador. Nos próximos inícios, autentique-se e digite um comando. Use `Tab` para completar comandos e opções, `↑` para navegar pelo histórico entre sessões, `ajuda` para ver os comandos do seu papel e `sair` para encerrar a sessão. O arquivo `data/.greencode-history` guarda os comandos digitados; a senha de uma conta é sempre solicitada separadamente e não entra nele.

## Comandos disponíveis

| Papel | Comandos |
| --- | --- |
| Administrador | `usuario criar`, `usuario listar`, `configuracao` |
| Operador de cadastro | `org criar`, `org listar`, `contrato criar`, `contrato listar` |
| Gestor de almoxarifado | `lote criar`, `lote listar`, `equip adicionar`, `equip triagem`, `equip mover`, `equip estado` |
| Auditor | `equip rastrear`, `historico`, `relatorio` |

Exemplo aceito: `lote criar --org BR001 --nf 123456 --transp TransRapida`. Também é possível informar os valores por posição, como `equip rastrear GC-123`, ou omitir parâmetros para recebê-los por perguntas no terminal. Papéis em `usuario criar --papel` aceitam maiúsculas ou minúsculas (`administrador`, `ADMINISTRADOR` ou `Administrador`); autocomplete e ajuda exibem os nomes em minúsculas. Valores com espaços devem ficar entre aspas, por exemplo `org criar --nome "Empresa Exemplo" --cnpj 11222333000181 --email contato@exemplo.com`. A data de entrada do lote aceita `--data AAAA-MM-DD` e rejeita datas futuras ou com mais de 90 dias.

## Segurança e persistência

- Os arquivos JSON em `data/` são serializados e cifrados com AES-256-GCM. AES é uma cifra simétrica, adequada a cifrar e decifrar os arquivos locais com uma chave; GCM também autentica o conteúdo, permitindo detectar adulteração. Cada arquivo usa um IV aleatório de 12 bytes e a tag de autenticação do GCM. A chave de 256 bits é gerada aleatoriamente no provisionamento e fica em `greencode-config.json`, conforme o requisito da atividade. Esse arquivo é a raiz de confiança: restrinja o acesso ao diretório da instalação e faça backup protegido.
- Senhas são armazenadas fora da configuração, com salt aleatório de 128 bits e SHA-256, conforme solicitado no enunciado. A comparação é feita em tempo constante. O salt diferencia hashes mesmo quando duas contas escolhem a mesma senha. SHA-256 simples é rápido demais para defesa ideal contra adivinhação offline; foi mantido para corresponder ao requisito da atividade.
- O sistema exige no mínimo 4 caracteres no provisionamento e na criação de usuários. O enunciado não exige maiúsculas, números ou símbolos, então não há outras regras de composição.
- Cada gravação de estado registra antes um evento no journal e depois um evento de aplicação. Escritas usam arquivo temporário, `fsync` e renomeação. O journal gira acima de 10 MiB e mantém arquivos rotacionados acessíveis para consulta; registros com mais de 180 dias são eliminados quando a rotina de retenção é executada.
- Sessões expiram após 30 minutos sem atividade. A sessão é renovada quando o usuário envia uma interação dentro do prazo.
- As credenciais e os dados operacionais são cifrados em repouso. `greencode-config.json` precisa permanecer legível para recuperar a chave, portanto não é cifrado por ela mesma.

### Justificativa da expiração de sessão

A sessão expira após 30 minutos sem interação. Cada resposta do usuário renova o prazo; ao detectar expiração, o menu interrompe a operação em andamento e encerra a sessão. O prazo limita o período em que uma sessão esquecida no terminal continua autorizada, sem exigir login novamente durante o uso ativo.

## Cenários cobertos pelo script da jornada

`src/testeJornada.ts` cria um diretório isolado e percorre provisionamento, rejeição de senha curta, credenciais, autorização de todos os comandos para cada papel, interpretação do exemplo de comando com opções, valores entre aspas e autocomplete dos papéis e opções enumeradas de equipamentos, triagem e contrato. Verifica CNPJ inválido/duplicado, associação organização-contrato, datas de lote inválidas, triagem, justificativa de estado físico e duas movimentações até a consulta de rastreabilidade. Simula recuperação de transação pendente, retenção de registros com 179/181 dias, rotação acima de 10 MiB e consulta do journal rotacionado. A expiração é simulada durante uma pergunta, sem esperar 30 minutos reais.

### Cenários de falha e resposta verificada

| Cenário | Resposta esperada/verificada |
| --- | --- |
| Senha abaixo de 4 caracteres no provisionamento/cadastro | Rejeita a operação antes de gravar a conta/configuração. |
| Senha incorreta no login | Recusa autenticação com mensagem genérica de usuário ou senha inválidos. |
| CNPJ inválido ou duplicado | Rejeita o cadastro sem adicionar a organização. |
| Data do lote futura ou com mais de 90 dias | Rejeita a criação do lote. |
| Desmonte antes da triagem concluída | Rejeita a mudança de status. |
| Piora de duas ou mais categorias sem justificativa | Rejeita a alteração do estado físico. |
| Transação registrada, mas ainda não aplicada | Na inicialização, reaplica o conteúdo pendente e registra a aplicação. |
| Journal acima de 10 MiB | Rotaciona o arquivo e mantém as transações consultáveis no histórico. |
| Registro com 181 dias / registro com 179 dias | A rotina remove o antigo e mantém o que ainda está dentro dos 180 dias. |
| Sessão expira durante uma pergunta de operação | Recusa continuar a operação e encerra a sessão. |
| Comando de outro papel digitado manualmente | Recusa o comando antes de solicitar dados ou executar a ação; verificado para todos os papéis e comandos cadastrados. |
| Caminho de persistência inválido ou diretório substituído por arquivo | O sistema propaga o erro de arquivo e não relata sucesso. |
| Arquivo operacional adulterado ou chave mestra ausente/incorreta | A leitura propaga o erro de autenticação AES-GCM ou de acesso à configuração; os dados não são aceitos como válidos. |
| Caminho/arquivo inválido no nome lógico | Rejeita o nome antes de ler ou gravar. |
| Falha injetada durante escrita parcial, `fsync` ou `rename` | Mantém a versão anterior do arquivo e remove o temporário incompleto. |
| Interrupção modelada após `fsync` e antes da renomeação | A inicialização continua lendo o arquivo anterior íntegro; o temporário não é tratado como estado aplicado. |

Os casos de armazenamento verificam erros reais do sistema de arquivos e injetam falhas controladas nas operações de escrita. A interrupção abrupta é modelada criando um temporário já sincronizado sem executar a renomeação; o processo de teste não é encerrado à força. Não são simulados defeito físico de disco, falta real de espaço ou indisponibilidade de energia.

## Limites desta etapa

O fluxo de contratos permite cadastro e listagem, mas não edição/renovação pelo CLI; relatórios são resumos operacionais, sem consultoria analítica. A atomicidade é implementada com arquivo temporário, `fsync` do conteúdo e renomeação. As falhas nessas etapas são injetadas nos testes e o caso de interrupção entre sincronização e renomeação é modelado, sem simular queda real de energia. A compilação e jornada foram executadas em Windows com Node.js 24.19.0. A compatibilidade Linux permanece sem confirmação prática, conforme escopo atual. SHA-256 foi mantido por aderência ao enunciado.
