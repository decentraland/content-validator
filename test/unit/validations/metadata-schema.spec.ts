import { EntityType } from 'dcl-catalyst-commons'
import { ADR_X_TIMESTAMP } from '../../../src'
import { metadata } from '../../../src/validations/metadata-schema'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { buildExternalCalls } from '../../setup/mock'
import { VALID_PROFILE_METADATA } from '../../setup/profiles'
import { VALID_WEARABLE_METADATA } from '../../setup/wearable'

describe('Metadata Schema', () => {
  const POST_ADR_X_TIMESTAMP = ADR_X_TIMESTAMP + 1
  const PRE_ADR_X_TIMESTAMP = ADR_X_TIMESTAMP - 1
  const testType = (type: EntityType, validMetadata: any, invalidMetadata: any, timestamp = POST_ADR_X_TIMESTAMP) => {
    it('when entity metadata is valid should not report errors', async () => {
      const entity = buildEntity({ type, metadata: validMetadata, timestamp })
      const deployment = buildDeployment({ entity })
      const result = await metadata.validate({ deployment, externalCalls: buildExternalCalls() })

      expect(result.ok).toBeTruthy()
    })
    it('when entity metadata is invalid should report an error', async () => {
      const entity = buildEntity({ type, metadata: invalidMetadata, timestamp })
      const deployment = buildDeployment({ entity })
      const result = await metadata.validate({ deployment, externalCalls: buildExternalCalls() })

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`The metadata for this entity type (${type}) is not valid.`)
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
        parcels: ['0,0'],
      },
    }
    const invalidMetadata = {}
    testType(EntityType.SCENE, validMetadata, invalidMetadata)
  })

  describe('WEARABLE: ', () => {
    const validMetadata = VALID_WEARABLE_METADATA
    const invalidMetadata = {}
    testType(EntityType.WEARABLE, validMetadata, invalidMetadata)
  })

  it('When entity timestamp is previous to ADR_X, then validation does not run', async () => {
    const entity = buildEntity({ type: EntityType.PROFILE, metadata: {}, timestamp: PRE_ADR_X_TIMESTAMP })
    const deployment = buildDeployment({ entity })
    const result = await metadata.validate({ deployment, externalCalls: buildExternalCalls() })

    expect(result.ok).toBeTruthy()
  })
})