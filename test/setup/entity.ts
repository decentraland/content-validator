import { Entity, EntityType } from '@dcl/schemas'

export const buildProfileEntity = (entity?: Partial<Entity>): Entity =>
  buildEntity({
    version: 'v3',
    type: EntityType.PROFILE,
    ...entity
  })

export const buildSceneEntity = (entity?: Partial<Entity>): Entity =>
  buildEntity({
    version: 'v3',
    type: EntityType.SCENE,
    ...entity
  })

export const buildWearableEntity = (entity?: Partial<Entity>): Entity =>
  buildEntity({
    version: 'v3',
    type: EntityType.WEARABLE,
    ...entity
  })

export const buildEmoteEntity = (entity?: Partial<Entity>): Entity =>
  buildEntity({
    version: 'v3',
    type: EntityType.EMOTE,
    ...entity
  })

export const buildOutfitsEntity = (entity?: Partial<Entity>): Entity =>
  buildEntity({
    version: 'v3',
    type: EntityType.OUTFITS,
    ...entity
  })

export const buildEntity = (
  entity?: Partial<Entity>,
  id = 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq'
): Entity => ({
  version: 'v3',
  type: EntityType.PROFILE,
  pointers: ['P1'],
  timestamp: Date.now(),
  content: [],
  id,
  ...entity
})
