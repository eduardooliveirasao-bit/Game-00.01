# Legend Of Indle — V44 até V90 Ultimate Polish

Este pacote consolida as versões V44–V90 em uma expansão grande, mantendo o jogo compatível com a arquitetura atual.

## Objetivo
- Melhorar a sensação de progressão.
- Preparar o jogo para skins por camadas: cabelo, roupa, arma, asa, aura e camada frontal/traseira.
- Centralizar sistemas de endgame em um gerenciador mais organizado.
- Melhorar a interface e reduzir a sensação de bagunça adicionando uma Central V90.

## Arquivos principais
- `server/managers/V90ProgressManager.js`
- `server.js`
- `server/managers/CombatManager.js`
- `server/managers/SaveManager.js`
- `public/index.html`
- `public/js/game.js`
- `public/css/style.css`

## Novos sistemas

### Recursos V90
- Éter
- Fragmentos de skin
- Sigilos
- Chaves de Eco
- Cronos

### Maestrias
- Lâmina
- Arcana
- Caça
- Bastião Rúnico
- Sorte Astral

### Posturas
- Equilibrada
- Berserker
- Guardião
- Assassina
- Arquimago

### Skins por camadas
O sistema já retorna `visualLayers` para o cliente. Os caminhos previstos são exemplos:

```txt
public/assets/skins/common/hair_shadow.png
public/assets/skins/common/armor_obsidian.png
public/assets/skins/common/wing_abyss_back.png
public/assets/skins/common/wing_abyss_front.png
public/assets/skins/common/weapon_eclipse.png
```

Quando esses PNGs forem criados, o render do personagem já tenta desenhá-los sobre o PNG base usando o mesmo pivot e transform do VFXManager.

### Cartas de Alma
Sistema permanente de cartas com upgrade por sigilos.

### Ecos de Pesadelo
Dungeons rápidas de endgame com custo em chaves e recompensas de recursos, item e score.

### Roadmap V44–V90
Marcos acumulativos que funcionam como objetivos de polimento/progressão.

### Tática automática
Base para comportamento de autofarm: modo, foco, skill bias e uso de poções.

## Eventos Socket.IO adicionados
- `v90ClaimFoundersChest`
- `v90UpgradeMastery`
- `v90SelectStance`
- `v90UnlockWardrobe`
- `v90EquipWardrobe`
- `v90UpgradeSoulCard`
- `v90ClaimRoadmap`
- `v90RunEcho`
- `v90SetTactic`

## Persistência
`SaveManager` agora salva e restaura também:
- `v30`
- `v40`
- `v90`

## Render
A versão mantém:
- `render.yaml`
- `render.free.yaml`
- `DATA_DIR`
- `/healthz`
- `npm start`
