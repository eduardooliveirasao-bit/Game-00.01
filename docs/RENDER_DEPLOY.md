# Deploy no Render — Legend Of Indle RPG V1

Esta versão já está preparada para subir como **Web Service Node.js** no Render.

## Arquivos adicionados

- `render.yaml`: Blueprint principal para produção com disco persistente.
- `render.free.yaml`: alternativa para testes grátis, sem persistência garantida.
- `.nvmrc`: fixa Node 20.
- `.env.example`: variáveis locais.
- `.gitignore`: evita subir `node_modules`, `.env` e dados gerados.
- endpoint `/healthz`: usado pelo Render para health check.

## Importante sobre persistência

O jogo salva contas, senha com hash, nick único, inventário, equipamentos, pets, montaria, ranking e progresso em arquivos JSON. Em produção, esses arquivos precisam ficar em um disco persistente.

Por isso, o `render.yaml` usa:

```yaml
DATA_DIR=/var/data
```

e monta um disco em:

```txt
/var/data
```

Se usar o `render.free.yaml`, o jogo pode funcionar para testes, mas os dados salvos podem desaparecer quando o serviço reiniciar ou for redeployado.

## Deploy recomendado com Blueprint

1. Suba esta pasta para um repositório GitHub.
2. No Render, vá em **New > Blueprint**.
3. Conecte o repositório.
4. Confirme o arquivo `render.yaml`.
5. Clique em **Deploy Blueprint**.

O Render vai usar:

```txt
Build Command: npm install
Start Command: npm start
Health Check: /healthz
```

## Deploy manual como Web Service

1. No Render, clique em **New > Web Service**.
2. Conecte seu repositório.
3. Configure:

```txt
Runtime: Node
Build Command: npm install
Start Command: npm start
```

4. Em Environment Variables:

```txt
NODE_ENV=production
DATA_DIR=/var/data
```

5. Em Disk, adicione:

```txt
Name: legend-indle-data
Mount Path: /var/data
Size: 1GB
```

## Teste local

```bash
npm install
npm start
```

Acesse:

```txt
http://localhost:3000
```

Health check:

```txt
http://localhost:3000/healthz
```

## Conta GM padrão

Ao iniciar pela primeira vez, o servidor cria a conta GM automaticamente:

```txt
Login: GM
Senha: GM123
```

## Observação de segurança

A senha é salva com hash PBKDF2, mas a conta GM padrão deve ser alterada antes de um lançamento público real.
