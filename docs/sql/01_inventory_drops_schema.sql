-- Legend Of Indle RPG V1 - V15
-- SQL Server schema para Drop de Combate Progressivo sem lâmpada/gacha.
-- Ideia central:
-- 1 item base define identidade visual/slot/classe.
-- 1 item de jogador é uma instância única com seed, raridade, qualidade e stats rolados.
-- Stats variáveis ficam normalizados em PlayerItemStatRoll para filtrar, somar e comparar com índices.

CREATE TABLE dbo.ItemDefinition (
    ItemDefId           INT IDENTITY(1,1) PRIMARY KEY,
    Code                NVARCHAR(80) NOT NULL UNIQUE,
    Name                NVARCHAR(120) NOT NULL,
    ClassId             NVARCHAR(30) NULL,
    Slot                NVARCHAR(30) NOT NULL, -- arma, anel, colar, ornamento
    IconAsset           NVARCHAR(255) NULL,
    BaseRarity          TINYINT NOT NULL DEFAULT 0, -- 0 comum ... 4 lendário
    RequiredLevel       INT NOT NULL DEFAULT 1,
    IsActive            BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.ItemDefinitionStat (
    ItemDefId           INT NOT NULL FOREIGN KEY REFERENCES dbo.ItemDefinition(ItemDefId),
    StatCode            NVARCHAR(30) NOT NULL, -- HP, ATK, DEF, SPEED, CRIT, EVASION
    BaseValue           INT NOT NULL,
    PRIMARY KEY(ItemDefId, StatCode)
);

CREATE TABLE dbo.ItemAffixDefinition (
    AffixId             INT IDENTITY(1,1) PRIMARY KEY,
    Code                NVARCHAR(80) NOT NULL UNIQUE,
    Name                NVARCHAR(80) NOT NULL,
    RarityMin           TINYINT NOT NULL DEFAULT 0,
    StatCode            NVARCHAR(30) NOT NULL,
    MinRoll             INT NOT NULL,
    MaxRoll             INT NOT NULL,
    Weight              INT NOT NULL DEFAULT 100,
    IsPrefix            BIT NOT NULL DEFAULT 1
);

CREATE TABLE dbo.PlayerItem (
    PlayerItemId        BIGINT IDENTITY(1,1) PRIMARY KEY,
    PlayerId            BIGINT NOT NULL,
    ItemDefId           INT NOT NULL FOREIGN KEY REFERENCES dbo.ItemDefinition(ItemDefId),
    InstanceGuid        UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
    Rarity              TINYINT NOT NULL,
    RollQuality         TINYINT NOT NULL, -- 1 a 100
    UpgradeLevel        TINYINT NOT NULL DEFAULT 0,
    IsLocked            BIT NOT NULL DEFAULT 0,
    IsEquipped          BIT NOT NULL DEFAULT 0,
    EquippedSlot        NVARCHAR(30) NULL,
    SourceType          NVARCHAR(30) NOT NULL DEFAULT 'combat',
    SourceStage         INT NULL,
    PowerScore          INT NOT NULL DEFAULT 0,
    CreatedAt           DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt           DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_PlayerItem_Player_Slot_Equipped ON dbo.PlayerItem(PlayerId, EquippedSlot, IsEquipped) INCLUDE(PowerScore, Rarity, UpgradeLevel);
CREATE INDEX IX_PlayerItem_Player_Power ON dbo.PlayerItem(PlayerId, PowerScore DESC) INCLUDE(ItemDefId, Rarity, IsLocked, IsEquipped);

CREATE TABLE dbo.PlayerItemStatRoll (
    PlayerItemId        BIGINT NOT NULL FOREIGN KEY REFERENCES dbo.PlayerItem(PlayerItemId) ON DELETE CASCADE,
    StatCode            NVARCHAR(30) NOT NULL,
    FixedValue          INT NOT NULL DEFAULT 0,
    RolledValue         INT NOT NULL DEFAULT 0,
    GemValue            INT NOT NULL DEFAULT 0,
    UpgradeValue        INT NOT NULL DEFAULT 0,
    TotalValue          AS (FixedValue + RolledValue + GemValue + UpgradeValue) PERSISTED,
    PRIMARY KEY(PlayerItemId, StatCode)
);
CREATE INDEX IX_PlayerItemStatRoll_Stat ON dbo.PlayerItemStatRoll(StatCode, TotalValue DESC);

CREATE TABLE dbo.PlayerItemAffix (
    PlayerItemId        BIGINT NOT NULL FOREIGN KEY REFERENCES dbo.PlayerItem(PlayerItemId) ON DELETE CASCADE,
    AffixId             INT NOT NULL FOREIGN KEY REFERENCES dbo.ItemAffixDefinition(AffixId),
    RolledValue         INT NOT NULL,
    PRIMARY KEY(PlayerItemId, AffixId)
);

CREATE TABLE dbo.PlayerEquipment (
    PlayerId            BIGINT NOT NULL,
    Slot                NVARCHAR(30) NOT NULL,
    PlayerItemId        BIGINT NULL FOREIGN KEY REFERENCES dbo.PlayerItem(PlayerItemId),
    UpdatedAt           DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    PRIMARY KEY(PlayerId, Slot)
);

CREATE TABLE dbo.StageDropProfile (
    StageId             INT PRIMARY KEY,
    MonsterLevelMin     INT NOT NULL,
    MonsterLevelMax     INT NOT NULL,
    GoldBase            INT NOT NULL,
    XpBase              INT NOT NULL,
    RarityCommonWeight  INT NOT NULL DEFAULT 600,
    RarityRareWeight    INT NOT NULL DEFAULT 280,
    RarityEpicWeight    INT NOT NULL DEFAULT 95,
    RarityLegendWeight  INT NOT NULL DEFAULT 25
);

CREATE TABLE dbo.DropTableEntry (
    StageId             INT NOT NULL FOREIGN KEY REFERENCES dbo.StageDropProfile(StageId),
    ItemDefId           INT NOT NULL FOREIGN KEY REFERENCES dbo.ItemDefinition(ItemDefId),
    Weight              INT NOT NULL DEFAULT 100,
    MinStage            INT NOT NULL DEFAULT 1,
    MaxStage            INT NULL,
    PRIMARY KEY(StageId, ItemDefId)
);

-- Consulta rápida para comparar item novo com equipamento atual:
-- 1) PowerScore é materializado em PlayerItem.
-- 2) PlayerEquipment aponta o item equipado.
-- 3) Só recalcule PowerScore quando item/gema/upgrade mudar, não em toda query de ranking.
GO
CREATE OR ALTER VIEW dbo.v_PlayerEquippedPower AS
SELECT
    e.PlayerId,
    e.Slot,
    e.PlayerItemId,
    pi.PowerScore,
    pi.Rarity,
    pi.UpgradeLevel
FROM dbo.PlayerEquipment e
LEFT JOIN dbo.PlayerItem pi ON pi.PlayerItemId = e.PlayerItemId;
GO