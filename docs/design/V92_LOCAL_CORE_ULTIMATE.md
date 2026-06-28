# V92 — Local Core Ultimate

Esta versão muda o foco do projeto: o Legend Of Indle passa a priorizar desenvolvimento local/desktop, com possibilidade futura de empacotamento como executável.

## Sistemas implementados

### 1. AdvancedAttributeManager
Inspirado em estruturas de atributos de MMORPG: atributos primários, secundários e cálculo final em camadas.

A lógica principal segue o conceito:

```txt
final = base do personagem + crescimento por classe + equipamento + bônus percentual + bônus flat
```

A versão atual calcula:
- força
- sabedoria
- agilidade
- vitalidade
- ataque
- defesa
- HP
- mana
- acerto
- esquiva
- crítico
- perfuração
- tenacidade
- velocidade

### 2. SlotInventoryManager
Mochila com slots fixos, organização e fortalecimento de item até +20.

### 3. FashionLayerManager
Base para trocar visual por camada:

```js
visualLayers = {
  back: 'assets/skins/asas.png',
  outfit: 'assets/skins/armadura.png',
  hair: 'assets/skins/cabelo.png',
  weapon: 'assets/skins/arma.png',
  front: 'assets/skins/asas_front.png',
  aura: 'aura_abissal'
}
```

### 4. WorldFlowManager
Fluxo de mundo local com zonas e rotas:
- Floresta Cristalina
- Cripta dos Ossos
- Ruínas Celestes
- Vulcão Elemental
- Reino do Céu
- Abismo Rúnico

### 5. SocketEventLogger
Registra eventos Socket.IO em:

```txt
data/socket-events.log
```

## Como rodar localmente

```bash
npm install
npm start
```

Ou no Windows:

```txt
START_LOCAL_WINDOWS.bat
```
