import { EntityType } from '@dcl/schemas'
import { ADR_45_TIMESTAMP } from '../../../src'
import { metadata } from '../../../src/validations/metadata-schema'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { buildComponents } from '../../setup/mock'
import { VALID_PROFILE_METADATA } from '../../setup/profiles'
import {
  entityAndMerkleRoot,
  VALID_WEARABLE_METADATA
} from '../../setup/wearable'

describe('Metadata Schema', () => {
  const POST_ADR_45_TIMESTAMP = ADR_45_TIMESTAMP + 1
  const PRE_ADR_45_TIMESTAMP = ADR_45_TIMESTAMP - 1
  const testType = (
    type: EntityType,
    validMetadata: any,
    invalidMetadata: any,
    timestamp = POST_ADR_45_TIMESTAMP,
    errors: string[] = []
  ) => {
    it('when entity metadata is valid should not report errors', async () => {
      const entity = buildEntity({ type, metadata: validMetadata, timestamp })
      const deployment = buildDeployment({ entity })
      const result = await metadata.validate(buildComponents(), deployment)

      expect(result.ok).toBeTruthy()
    })
    it('when entity metadata is invalid should report an error', async () => {
      const entity = buildEntity({ type, metadata: invalidMetadata, timestamp })
      const deployment = buildDeployment({ entity })
      const result = await metadata.validate(buildComponents(), deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        `The metadata for this entity type (${type}) is not valid.`
      )
      errors.forEach(($) => expect(result.errors).toContain($))
    })
  }

  describe('PROFILE: ', () => {
    const invalidMetadata = {}
    testType(EntityType.PROFILE, VALID_PROFILE_METADATA, invalidMetadata)
  })

  describe('SCENE: ', () => {
    const validMetadata = {
      main: 'bin/main.js',
      scene: {
        base: '0,0',
        parcels: ['0,0']
      }
    }
    const invalidMetadata = {}
    testType(EntityType.SCENE, validMetadata, invalidMetadata, undefined, [
      "should have required property 'main'"
    ])
  })

  describe('WEARABLE: ', () => {
    const validMetadata = VALID_WEARABLE_METADATA
    const invalidMetadata = {}
    testType(EntityType.WEARABLE, validMetadata, invalidMetadata)
  })

  describe('THIRD PARTY WEARABLE: ', () => {
    const validMetadata = entityAndMerkleRoot.entity
    const invalidMetadata = {}
    testType(EntityType.WEARABLE, validMetadata, invalidMetadata)
  })

  it('When entity timestamp is previous to ADR_45, then validation does not run', async () => {
    const entity = buildEntity({
      type: EntityType.PROFILE,
      metadata: {},
      timestamp: PRE_ADR_45_TIMESTAMP
    })
    const deployment = buildDeployment({ entity })
    const result = await metadata.validate(buildComponents(), deployment)

    expect(result.ok).toBeTruthy()
  })
})
