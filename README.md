# Legend Of Indle RPG V1 — V7 Studio Final

Versão polida baseada na V6, com correção de layout, persistência de progresso, recompensas offline, conquistas, inventário completo, venda/equipamento manual, efeitos de combate e boss especial.

## Principais sistemas

- Layout reestruturado em linhas fixas para evitar sobreposição do painel superior.
- Personagens e monstros com escala dinâmica no canvas.
- Animações de idle, ataque, hit, partículas e dano flutuante.
- Farm automático ON/OFF.
- HP, Mana, XP, Ouro, Gemas e Poder.
- Sistema de morte e ressurreição automática.
- Save local persistente por `saveId` com armazenamento em `data/saves.json`.
- Recompensa offline ao retornar ao jogo.
- Conquistas com recompensas em ouro e gemas.
- Inventário clicável com comparação visual.
- Equipar manual, desequipar, vender item, vender tudo e equipar melhores itens.
- Raridades: comum, raro, épico, lendário, mítico e boss.
- Loot exclusivo do Dragão Elemental.
- Boss com Escudo Elemental em fases do combate.
- Sons sintéticos locais para hit, skill, boss, loot e equipamento.

## Rodar

```bash
npm install
npm start
```

Abra:

```txt
http://localhost:3000
```

## Observações

A pasta `node_modules` não está no ZIP. Rode `npm install`.
O progresso é salvo em `data/saves.json` e o navegador guarda o `saveId` no `localStorage`.


## Hotfix V8.1

Corrigido o erro `RangeError: Maximum call stack size exceeded` no `LootManager`.

Causa: `enrichItem()` chamava `sellValue()`, e `sellValue()` chamava `enrichItem()` novamente, criando recursão infinita.

Correção: `sellValue()` agora calcula o valor de venda diretamente com `scoreItem()` sem chamar `enrichItem()`.


## V10 — Sistema de Contas, Nick Único, GM e Loja

Novidades:
- Tela de login e criação de conta.
- Nick único por jogador.
- Dados persistidos em `data/accounts.json` e `data/saves.json`.
- Senhas salvas com hash PBKDF2 + salt, não em texto puro.
- Conta GM padrão para testes:
  - Login: `GM`
  - Senha: `GM123`
- Painel GM com comandos de teste:
  - adicionar ouro
  - adicionar gemas
  - adicionar nível
  - invocar boss
  - gerar item especial
  - curar/ressuscitar
- Loja de gemas cash:
  - poção de vida
  - poção de mana
  - pacote de ouro
  - baús de itens
  - invocação de boss
  - contratos de montaria
- Poções utilizáveis pela loja.
- Gemas/cash salvas na conta.
- Mochila, itens, classe, montaria, nível e progresso salvos por login.

---

## Deploy no Render

Esta versão inclui `render.yaml` e está pronta para subir no Render como Web Service Node.js.

Para produção com contas e saves persistentes, use o Blueprint principal `render.yaml`, que configura `DATA_DIR=/var/data` e um disco persistente em `/var/data`.

Veja o guia completo em:

```txt
docs/RENDER_DEPLOY.md
```


## V20 - Talent Tree e Expedições

- Árvore de talentos permanente.
- Expedições Idle paralelas.
- Bônus de XP/Ouro/Drop por talentos.
- Persistência de talentos e expedições.


## V40 Meta Expansion

Inclui Raid Mundial, Ordem Indle, Runas Eternas, Arena Espelho, Contratos, Alquimia, Vínculo de Pets, Cosméticos e Central V40.
