# V42 - Dark Fantasy Entry UI

## Arquivos principais

- `public/index.html` - HTML da tela inicial dentro de `#auth-modal`.
- `public/css/auth-dark-fantasy.css` - CSS modular da tela inicial.
- `public/assets/ui/login-bg-dark-fantasy.png` - fundo de batalha dark fantasy.
- `public/assets/ui/legend-of-indle-logo-rune.png` - logotipo metálico rúnico.
- `public/assets/ui/rune-emblem.png` - emblema decorativo do painel.
- `public/js/game.js` - integração com Socket.IO.

## Caminhos dos ativos no CSS/HTML

```html
<img class="df-logo" src="assets/ui/legend-of-indle-logo-rune.png" alt="Legend Of Indle" />
<img class="df-emblem" src="assets/ui/rune-emblem.png" alt="" />
```

```css
.df-bg-layer {
  background:
    linear-gradient(180deg, rgba(0, 0, 0, .15), rgba(0, 0, 0, .56) 70%, rgba(0, 0, 0, .86)),
    url('../assets/ui/login-bg-dark-fantasy.png') center center / cover no-repeat;
}
```

## Integração Socket.IO

A tela mantém os IDs usados pela lógica existente:

- `login-user`
- `login-pass`
- `login-btn`
- `reg-user`
- `reg-pass`
- `reg-nick`
- `reg-class`
- `register-btn`
- `auth-error`

Trecho usado no `public/js/game.js`:

```js
if (loginBtn) loginBtn.onclick = function () {
  ensureAudio();
  setAuthError('');
  socket.emit('loginAccount', {
    login: byId('login-user').value,
    password: byId('login-pass').value
  });
};

if (registerBtn) registerBtn.onclick = function () {
  ensureAudio();
  setAuthError('');
  socket.emit('registerAccount', {
    login: byId('reg-user').value,
    password: byId('reg-pass').value,
    nick: byId('reg-nick').value,
    classeId: byId('reg-class').value
  });
};
```

## Ranking e opções

`RANKING` abre o modal de ranking por Socket.IO:

```js
function openEntryRanking() {
  if (!rankingModal) return;
  rankingModal.classList.remove('hidden');
  rankingModal.classList.add('entry-above-auth');
  var auth = byId('auth-modal');
  if (auth) auth.classList.add('df-dimmed-for-ranking');
  socket.emit('requestRanking');
}
```

`OPÇÕES` usa Fullscreen API:

```js
function toggleFullscreen() {
  var root = document.documentElement;
  var request = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
  var exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
  if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
    if (request) request.call(root);
  } else {
    if (exit) exit.call(document);
  }
}
```

## Observação importante sobre navegador e barra do Windows

CSS consegue fazer a tela ocupar `100vw` e `100dvh`, remover scroll e esconder barras internas da página. Porém um site comum não pode remover a interface do navegador nem a barra de tarefas do Windows por CSS, por segurança do sistema operacional. Para isso, a V42 usa Fullscreen API no botão `OPÇÕES`. Em produção, também dá para transformar em PWA/kiosk futuramente.
