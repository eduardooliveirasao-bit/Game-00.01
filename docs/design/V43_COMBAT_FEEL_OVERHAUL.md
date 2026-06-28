# V43 Combat Feel Overhaul

## Objetivo
Dar aparência de batalha dinâmica, estilo RPG online, usando apenas uma imagem PNG inteira por personagem.

## Arquivo principal
`public/js/vfx-manager.js`

## Chamadas principais

### Ataque básico do jogador
```js
vfx.playPlayerAttack({
  classId: state.me.classeId,
  from: { x: canvas.width * 0.28, y: canvas.height * 0.90 },
  to: { x: canvas.width * 0.54, y: canvas.height * 0.82 },
  impact: { x: canvas.width * 0.72, y: canvas.height * 0.40 },
  color: '#ffe69b',
  crit: attack.isCrit
});
```

### Skill
```js
vfx.playAbility({
  classId: state.me.classeId,
  type: evt.visual.tipo,
  color: evt.visual.cor,
  from: { x: canvas.width * 0.35, y: canvas.height * 0.47 },
  to: { x: canvas.width * 0.72, y: canvas.height * 0.40 }
});
```

### Ataque de monstro
```js
vfx.playMonsterAttack({
  boss: state.monster && state.monster.isBoss,
  from: { x: canvas.width * 0.72, y: canvas.height * 0.90 },
  to: { x: canvas.width * 0.47, y: canvas.height * 0.84 },
  impact: { x: canvas.width * 0.28, y: canvas.height * 0.43 }
});
```

## Pipeline preparado para skins
O render do herói aceita `state.me.visualLayers` ou `state.me.skins` com caminhos PNG:

```js
state.me.visualLayers = {
  back: 'assets/skins/guerreiro/asas_back.png',
  outfit: 'assets/skins/guerreiro/armadura_01.png',
  hair: 'assets/skins/guerreiro/cabelo_01.png',
  weapon: 'assets/skins/guerreiro/espada_01.png',
  front: 'assets/skins/guerreiro/asas_front.png'
};
```

Todas as camadas usam o mesmo pivot e transform do corpo.
