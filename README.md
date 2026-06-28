# Crystal Realms — MMORPG Idle (estrutura base corrigida)

## O que estava quebrado

1. **`ReferenceError: io is not defined`** — `game.js` rodava `io(...)`
   antes do script da CDN do Socket.io terminar de carregar.
2. A tentativa de corrigir isso com `DOMContentLoaded` + injeção dinâmica
   de `<script>` acabou apagando a lógica de renderização original →
   **tela branca**.

## A correção (raiz do problema, não um remendo)

Scripts **sem** `defer`/`async` são executados em ordem, e o navegador só
avança para o próximo depois de baixar **e rodar** o anterior por
completo. Por isso, em `public/index.html`, os três scripts ficam, nessa
ordem, sem nenhum atributo extra, no fim do `<body>`:

```html
<script src="https://cdn.socket.io/4.8.3/socket.io.min.js"></script>
<script src="shared/classes.js"></script>
<script src="js/game.js"></script>
```

Isso por si só já resolve o `ReferenceError`. Além disso, `game.js`
agora começa com uma guarda explícita:

```js
if (typeof io === 'undefined') {
  // mostra um erro visível em #fatal-error em vez de travar tudo
  return;
}
```

Então, **mesmo que algo saia errado** (CDN fora do ar, bloqueador de
anúncios agressivo, etc.), você vê uma mensagem de erro na tela —
nunca mais uma tela branca silenciosa.

> ⚠️ Importante: a versão do Socket.io no servidor (`package.json`) e a
> da CDN no `index.html` precisam ser compatíveis. Aqui as duas estão
> fixadas em `4.8.3`. Se você atualizar uma, atualize a outra.

## Estrutura de pastas

```
MeuJogoIdle/
├── server.js              # Express + Socket.io, game loop idle
├── package.json
├── shared/
│   └── classes.js          # fonte única dos dados das 3 classes (server + client)
└── public/
    ├── index.html
    ├── css/style.css       # identidade visual (cristais, dourado, cores por classe)
    └── js/game.js          # render em canvas, HUD, habilidades, socket
```

`shared/classes.js` é exigido (`require`) pelo servidor **e** servido
como arquivo estático pro navegador — uma única fonte de verdade para
nomes, cores e cooldowns das habilidades, para o client e o server nunca
dessincronizarem conforme o jogo crescer.

## Como rodar

```bash
npm install
npm start
```

Abra `http://localhost:3000`.

## O que já está implementado (esqueleto funcional)

- Conexão Socket.io robusta (`io()` sem host fixo — funciona em
  qualquer porta/domínio, inclusive depois do deploy).
- Tela de seleção das 3 classes (Guerreiro, Arqueiro, Mago), gerada
  dinamicamente a partir do GDD em `shared/classes.js`.
- Sistema de Asas de Cristal (5 níveis, progressão por XP, desenhado em
  camadas crescentes + fragmentos orbitantes a partir do nível 4).
- Barra de habilidades com cooldown validado **no servidor** (o cliente
  não pode burlar o cooldown editando o JS local).
- Broadcast de `abilityUsed` para todos os jogadores conectados, para
  que efeitos de habilidade apareçam sincronizados para quem está
  assistindo — comportamento esperado em MMORPG.
- Idle tick no servidor (XP passivo a cada 1s) com sincronização via
  `gameState`.
- Renderização em `<canvas>` com placeholders geométricos por classe
  (corpo + asas + partículas ambiente coloridas conforme o GDD).

## O que falta para chegar na visão completa do GDD

Isto é uma **base de arquitetura**, não a arte final. Os próximos
passos óbvios:

1. Trocar os placeholders geométricos por sprite sheets/animações reais
   (idle, cast, hit) para cada classe.
2. Implementar a lógica de dano/combate (atualmente `useAbility` só
   dispara o efeito visual e o cooldown — não há cálculo de dano).
3. Persistir os jogadores em um banco (hoje é tudo em memória — reinicia
   o servidor e todo progresso some).
4. Separar "zonas"/salas (`socket.join(sala)`) se você quiser várias
   áreas do mapa em vez de uma praça única.
