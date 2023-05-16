import { EntityType } from '@dcl/schemas'
import { metadataValidateFn } from '../../../src/validations/metadata-schema'
import { ADR_45_TIMESTAMP, ADR_74_TIMESTAMP } from '../../../src/validations/timestamps'
import { buildDeployment } from '../../setup/deployments'
import { VALID_STANDARD_EMOTE_METADATA, VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT } from '../../setup/emotes'
import { buildEntity } from '../../setup/entity'
import { VALID_OUTFITS_METADATA } from '../../setup/outfits'
import { VALID_PROFILE_METADATA } from '../../setup/profiles'
import { BASE_WEARABLE_METADATA, VALID_THIRD_PARTY_WEARABLE, VALID_WEARABLE_METADATA } from '../../setup/wearable'

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
      const result = await metadataValidateFn(deployment)
      expect(result.ok).toBeTruthy()
    })
    it('when entity metadata is invalid should report an error', async () => {
      const entity = buildEntity({ type, metadata: invalidMetadata, timestamp })
      const deployment = buildDeployment({ entity })
      const result = await metadataValidateFn(deployment)
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

  describe('OUTFITS: ', () => {
    testType(EntityType.OUTFITS, VALID_OUTFITS_METADATA, invalidMetadata)
  })

  it('When entity timestamp is previous to ADR_45, then validation does not run', async () => {
    const entity = buildEntity({
      type: EntityType.PROFILE,
      metadata: invalidMetadata,
      timestamp: PRE_ADR_45_TIMESTAMP
    })
    const deployment = buildDeployment({ entity })
    const result = await metadataValidateFn(deployment)

    expect(result.ok).toBeTruthy()
  })

  it('when deploying a base wearable the validation pass', async () => {
    const entity = buildEntity({
      type: EntityType.WEARABLE,
      metadata: BASE_WEARABLE_METADATA
    })
    const deployment = buildDeployment({ entity })
    const result = await metadataValidateFn(deployment)

    expect(result.ok).toBeTruthy()
  })

  it('when deploying an invalid base wearable the errors are reported correctly', async () => {
    const expectedErrors = ["must have required property 'i18n'", "must have required property 'id'"]

    const entity = buildEntity({
      type: EntityType.WEARABLE,
      metadata: { ...BASE_WEARABLE_METADATA, i18n: undefined, id: undefined }
    })
    const deployment = buildDeployment({ entity })
    const result = await metadataValidateFn(deployment)

    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain(`The metadata for this entity type (${EntityType.WEARABLE}) is not valid.`)
    expectedErrors.forEach(($) => expect(result.errors).toContain($))
  })
})
