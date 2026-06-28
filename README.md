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
