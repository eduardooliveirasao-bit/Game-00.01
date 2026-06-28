# Legend Of Indle RPG V2 — Ultimate MMORPG Reforjado

Esta versão marca a transição do projeto para o **V2**. A base V150 foi preservada, mas o jogo recebeu uma camada nova de arquitetura, visual e progressão.

## O que entrou no V2

- **V2GameDirector** no servidor, responsável por mundo, campanha, dungeons, fúria, combo, visuais e resource vault.
- **Combate manual real**, com `v2ManualStrike` causando dano no servidor.
- **Ultimate V2**, consumindo fúria e causando dano pesado no monstro atual.
- **Mundo V2 com zonas**, bônus, nodes, reputação e energia de portal.
- **Dungeons locais**, com custo de chaves e recompensas de ouro, XP, gemas, minério, essência, pó de relíquia e almas de boss.
- **Campanha V2**, com capítulos, objetivos e recompensas permanentes.
- **Visual V2**, com overlay Canvas, aura por zona, companions, minions, minimapa, barras de fúria/combo e painel novo.
- **Vault de referência**, indexando os pacotes enviados: Flex/ActionScript, SWF, SQL, protocolo, Python e o res.zip dividido em 13 partes.

## Referências reaproveitadas

O V2 foi baseado no material enviado ao longo do desenvolvimento:

- Handlers Python de mundo, inventário, role, shop e movimento.
- Managers Python de atributos, inventário, player data e config loader.
- Tabelas SQL de conta, sessão, role, inventário, buffs, monstros, spawns e teleportes.
- Logs e comandos de protocolo para login, RoleList, SelectRole, EnterWorld, ViewMap, BagCapacity e Robot/Auto action.
- Pacote Flex extraído com milhares de arquivos ActionScript/SWF.
- Resource vault `res.zip(1).001..013`, indexado como manifesto local.

## Observação técnica

O V2 recria a experiência em **HTML5/Canvas + Node.js + Socket.IO**, sem depender de Flash Player. O vault enviado é usado como base de análise e inspiração estrutural; os sistemas foram adaptados para o jogo local.
