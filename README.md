# Legend Of Indle RPG V1 — V6

Versão com correção estrutural do layout, inventário mais completo, sons, animações e mecânica de morte/ressurreição.

## Principais melhorias

- Correção real do bug visual superior:
  - o painel do inimigo saiu da sobreposição absoluta e virou uma linha própria no layout;
  - o palco não fica mais por baixo da barra do monstro;
  - sprites do herói e do monstro escalam conforme a altura do canvas.
- Inventário clicável com tela de bolsa.
- Equipar e desequipar manualmente.
- Vender item individualmente.
- Vender todos os itens da bolsa.
- Comparação visual entre item selecionado e item equipado no mesmo slot.
- Cores de raridade:
  - comum
  - raro
  - épico
  - lendário
  - mítico
  - boss
- Sons gerados via Web Audio API:
  - skill
  - hit
  - loot
  - boss
  - morte
  - equipamento
- Barra de mana.
- Risco de morte do personagem.
- Ressurreição automática.
- Dragão Elemental com Escudo Elemental.
- Loot exclusivo de boss.
- Animações de idle, ataque e hit para jogador e monstros.
- Efeitos de skill e partículas de impacto.

## Rodar

```bash
npm install
npm start
```

Acesse:

```txt
http://localhost:3000
```
