import { EntityType } from '@dcl/schemas'
import { metadata } from '../../../src/validations/metadata-schema'
import { ADR_45_TIMESTAMP, ADR_74_TIMESTAMP } from '../../../src/validations/timestamps'
import { buildDeployment } from '../../setup/deployments'
import { VALID_STANDARD_EMOTE_METADATA, VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT } from '../../setup/emotes'
import { buildEntity } from '../../setup/entity'
import { buildComponents } from '../../setup/mock'
import { VALID_PROFILE_METADATA } from '../../setup/profiles'
import { VALID_THIRD_PARTY_WEARABLE, VALID_WEARABLE_METADATA } from '../../setup/wearable'

describe('Metadata Schema', () => {
  const POST_ADR_45_TIMESTAMP = ADR_45_TIMESTAMP + 1
  const PRE_ADR_45_TIMESTAMP = ADR_45_TIMESTAMP - 1
  const invalidMetadata = {}
  const testType = (
    type: EntityType,
    validMetadata: any,
    invalidMetadata: any,
    timestamp: number = POST_ADR_45_TIMESTAMP,
    errors: string[] = []
  ) => {
    it('when entity metadata is valid should not report errors', async () => {
      const entity = buildEntity({ type, metadata: validMetadata, timestamp })
      const deployment = buildDeployment({ entity })
      const result = await metadata(buildComponents(), deployment)
      expect(result.ok).toBeTruthy()
    })
    it('when entity metadata is invalid should report an error', async () => {
      const entity = buildEntity({ type, metadata: invalidMetadata, timestamp })
      const deployment = buildDeployment({ entity })
      const result = await metadata(buildComponents(), deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`The metadata for this entity type (${type}) is not valid.`)
      errors.forEach(($) => expect(result.errors).toContain($))
    })
  }

  describe('PROFILE: ', () => {
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
    testType(EntityType.SCENE, validMetadata, invalidMetadata, undefined, ["must have required property 'main'"])
  })

  describe('WEARABLE: ', () => {
    testType(EntityType.WEARABLE, VALID_WEARABLE_METADATA, invalidMetadata)
  })

  describe('THIRD PARTY WEARABLE: ', () => {
    testType(EntityType.WEARABLE, VALID_THIRD_PARTY_WEARABLE.entity, invalidMetadata)
  })

  describe('EMOTE: ', () => {
    testType(EntityType.EMOTE, VALID_STANDARD_EMOTE_METADATA, invalidMetadata, ADR_74_TIMESTAMP + 1)
  })

  describe('THIRD PARTY EMOTE: ', () => {
    testType(
      EntityType.EMOTE,
      VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT.entity,
      invalidMetadata,
      ADR_74_TIMESTAMP + 1
    )
  })

  it('When entity timestamp is previous to ADR_45, then validation does not run', async () => {
    const entity = buildEntity({
      type: EntityType.PROFILE,
      metadata: invalidMetadata,
      timestamp: PRE_ADR_45_TIMESTAMP
    })
    const deployment = buildDeployment({ entity })
    const result = await metadata(buildComponents(), deployment)

    expect(result.ok).toBeTruthy()
  })
})
