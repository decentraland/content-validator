import { EntityType } from '@dcl/schemas'
import { ValidationResponse } from '../../../src'
import { noWorldsConfigurationValidateFn } from '../../../src/validations/scene'
import { ADR_173_TIMESTAMP } from '../../../src/validations/timestamps'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { VALID_SCENE_METADATA } from '../../setup/scenes'

describe('Scenes', () => {
  const timestamp = ADR_173_TIMESTAMP + 1
  describe('noWorldsConfiguration validation:', () => {
    it('When there is no worldConfiguration section, validation passes', async () => {
      const files = new Map()
      const entity = buildEntity({
        type: EntityType.SCENE,
        metadata: VALID_SCENE_METADATA,
        timestamp,
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
            name: 'some-name.dcl.eth',
          },
        },
        timestamp,
      })
      const deployment = buildDeployment({ entity, files })

      const result: ValidationResponse = await noWorldsConfigurationValidateFn(deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain('Scenes cannot have worldConfiguration section after ADR 173.')
    })
  })
})
