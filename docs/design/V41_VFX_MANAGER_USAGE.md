# V41 - VFXManager Usage

Arquivo principal:

```txt
public/js/vfx-manager.js
```

Instância no game:

```js
var vfx = window.VFXManager ? new window.VFXManager(ctx, canvas) : null;
```

Uso no render loop:

```js
if (vfx) vfx.beginFrame();
drawBackground();
drawPlayer(now);
drawMonster(now);
drawEffects();
if (vfx) vfx.updateAndDraw();
drawParticles();
drawFloating();
if (vfx) vfx.endFrame();
```

Uso em abilityUsed:

```js
vfx.dashAndReturn('player', playerBase, enemyTarget, { duration: 560, color });
vfx.hitFlinch('monster', { x: 1, y: 0 }, { distance: 26, color: 'white' });
vfx.arcaneBurst(enemyX, enemyY, { color, size: 104 });
vfx.screenShake(10, 160);
```

Uso em combatTick:

```js
vfx.dashAndReturn('player', playerBase, enemyTarget, { duration: 340, color });
vfx.hitFlinch('monster', { x: 1, y: 0 }, { distance: isCrit ? 34 : 22 });
vfx.slash(enemyX, enemyY, { color, size: isCrit ? 104 : 78 });
if (isCrit) vfx.screenShake(16, 220);
```

Ataque do monstro:

```js
vfx.dashAndReturn('monster', monsterBase, playerTarget, { duration: 400, color: '#ff9b9b' });
vfx.hitFlinch('player', { x: -1, y: 0 }, { distance: 28, color: 'red' });
vfx.impact(playerX, playerY, { color: '#ff9b9b', size: 82 });
```
