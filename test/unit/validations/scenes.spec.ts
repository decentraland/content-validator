import { EntityType } from '@dcl/schemas'
import { ValidationResponse } from '../../../src'
import { embeddedThumbnail, noWorldsConfigurationValidateFn } from '../../../src/validations/scene'
import { ADR_173_TIMESTAMP } from '../../../src/validations/timestamps'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { VALID_SCENE_METADATA } from '../../setup/scenes'
import { createImage } from '../../setup/mock'

describe('Scenes', () => {
  const timestamp = ADR_173_TIMESTAMP + 1
  describe('noWorldsConfiguration validation:', () => {
    it('When there is no worldConfiguration section, validation passes', async () => {
      const files = new Map()
      const entity = buildEntity({
        type: EntityType.SCENE,
        metadata: VALID_SCENE_METADATA,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result: ValidationResponse = await noWorldsConfigurationValidateFn(deployment)

      expect(result.ok).toBeTruthy()
    })

    it('When there is worldConfiguration section, validation fails with errors', async () => {
      const files = new Map()
      const entity = buildEntity({
        type: EntityType.SCENE,
        metadata: {
          ...VALID_SCENE_METADATA,
          worldConfiguration: {
            name: 'some-name.dcl.eth'
          }
        },
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result: ValidationResponse = await noWorldsConfigurationValidateFn(deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain('Scenes cannot have worldConfiguration section after ADR 173.')
    })
  })

  describe('embeddedThumbnail validation:', () => {
    let thumbnailBuffer: Buffer
    const content = [{ file: 'thumbnail.png', hash: 'thumbnailHash' }]
    const files = new Map()

    beforeAll(async () => {
      thumbnailBuffer = await createImage(1024)
      files.set('thumbnailHash', thumbnailBuffer)
    })

    it('When there is a thumbnail that references an embedded file, validation succeeds', async () => {
      const entity = buildEntity({
        type: EntityType.SCENE,
        metadata: {
          ...VALID_SCENE_METADATA,
          display: {
            ...VALID_SCENE_METADATA.display,
            navmapThumbnail: 'thumbnail.png'
          }
        },
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result: ValidationResponse = await embeddedThumbnail(deployment)

      expect(result.ok).toBeTruthy()
    })

    it('When there is a thumbnail that does not reference an embedded file, validation fails with error', async () => {
      const entity = buildEntity({
        type: EntityType.SCENE,
        metadata: {
          ...VALID_SCENE_METADATA,
          display: {
            ...VALID_SCENE_METADATA.display,
            navmapThumbnail: 'https://example.com/image.png' // Invalid, it must reference a file in the deployment
          }
        },
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result: ValidationResponse = await embeddedThumbnail(deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        "Scene thumbnail 'https://example.com/image.png' must be a file included in the deployment."
      )
    })
  })
})
