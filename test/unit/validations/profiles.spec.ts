import { EntityType } from '@dcl/schemas'
import sharp from 'sharp'
import { ValidationResponse } from '../../../src'
import {
  emoteUrns,
  faceThumbnail,
  profile,
  profileMustHaveEmotes,
  wearableUrns
} from '../../../src/validations/profile'
import { ADR_45_TIMESTAMP, ADR_74_TIMESTAMP, ADR_75_TIMESTAMP } from '../../../src/validations/timestamps'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { buildComponents, buildExternalCalls } from '../../setup/mock'
import { validProfileMetadataWithEmotes, VALID_PROFILE_METADATA } from '../../setup/profiles'

describe('Profiles', () => {
  const timestamp = ADR_45_TIMESTAMP + 1
  const components = buildComponents()
  describe('Thumbnail face256:', () => {
    let validThumbnailBuffer: Buffer
    let invalidThumbnailBuffer: Buffer
    const fileName = 'face256.png'
    const hash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5s'

    const createImage = async (size: number, format: 'png' | 'jpg' = 'png'): Promise<Buffer> => {
      let image = sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 0.5 }
        }
      })
      if (format) {
        image = format === 'png' ? image.png() : image.jpeg()
      }
      return await image.toBuffer()
    }

    beforeAll(async () => {
      validThumbnailBuffer = await createImage(256)
      invalidThumbnailBuffer = await createImage(1)
    })

    it('When there is no hash for given thumbnail file name, it should return an error', async () => {
      const files = new Map([['invalidHash', validThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: VALID_PROFILE_METADATA,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result: ValidationResponse = await faceThumbnail.validate(components, deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't find thumbnail file with hash: ${hash}`)
    })

    it('When there is no file for given thumbnail file hash, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([['notSame' + hash, validThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: VALID_PROFILE_METADATA,
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result = await faceThumbnail.validate(components, deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't find thumbnail file with hash: ${hash}`)
    })

    it('When thumbnail image format is not valid, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, Buffer.alloc(1)]])
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: VALID_PROFILE_METADATA,
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result = await faceThumbnail.validate(components, deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't parse face256 thumbnail, please check image format.`)
    })

    it('When thumbnail image size is invalid, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, invalidThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: VALID_PROFILE_METADATA,
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result = await faceThumbnail.validate(components, deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Invalid face256 thumbnail image size (width = 1 / height = 1)`)
    })

    it('When thumbnail image format is not png, it should return an error', async () => {
      const jpgImage = await createImage(1024, 'jpg')
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, jpgImage]])
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: VALID_PROFILE_METADATA,
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result = await faceThumbnail.validate(components, deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Invalid or unknown image format. Only 'PNG' format is accepted.`)
    })

    it('When thumbnail image size is valid, should not return any error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, validThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: VALID_PROFILE_METADATA,
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result = await faceThumbnail.validate(components, deployment)

      expect(result.ok).toBeTruthy()
    })

    it(`When thumbnail file was already uploaded, it won't be validated again`, async () => {
      const content = [{ file: fileName, hash }]
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: VALID_PROFILE_METADATA,
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity })

      const externalCalls = buildExternalCalls({
        isContentStoredAlready: async () => new Map([[hash, true]])
      })

      const result = await faceThumbnail.validate(buildComponents({ externalCalls }), deployment)

      expect(result.ok).toBeTruthy()
    })
  })

  describe('Wearables urns', () => {
    it('When wearable urn is correct, should return no errors', async () => {
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: VALID_PROFILE_METADATA,
        timestamp
      })
      const deployment = buildDeployment({ entity })

      const result = await wearableUrns.validate(components, deployment)

      expect(result.ok).toBeTruthy()
    })

    it('When wearable using a base emote, should return no errors', async () => {
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: {
          avatars: [
            {
              avatar: {
                wearables: ['raiseHand']
              }
            }
          ]
        },
        timestamp: ADR_75_TIMESTAMP + 1
      })
      const deployment = buildDeployment({ entity })

      const result = await wearableUrns.validate(components, deployment)

      expect(result.ok).toBeTruthy()
    })

    it('When wearable urn is wrong, should return the correct error', async () => {
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: {
          avatars: [
            {
              avatar: {
                wearables: ['urn:decentraland:tucu-tucu:base-avatars:tall_front_01']
              }
            }
          ]
        },
        timestamp: ADR_75_TIMESTAMP + 1
      })
      const deployment = buildDeployment({ entity })

      const result = await wearableUrns.validate(components, deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'Each profile wearable pointer should be a urn, for example (urn:decentraland:{protocol}:collections-v2:{contract(0x[a-fA-F0-9]+)}:{name}). Invalid pointer: (urn:decentraland:tucu-tucu:base-avatars:tall_front_01)'
      )
    })
  })

  describe('Profile group', () => {
    it('When entity type is not profile, should not return errors', async () => {
      const entity = buildEntity({
        type: EntityType.SCENE,
        metadata: VALID_PROFILE_METADATA,
        timestamp
      })
      const deployment = buildDeployment({ entity })

      const result = await profile.validate(components, deployment)

      expect(result.ok).toBeTruthy()
    })
  })

  describe('Wearables urns', () => {
    it('When wearable urn is correct, should return no errors', async () => {
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: VALID_PROFILE_METADATA,
        timestamp
      })
      const deployment = buildDeployment({ entity })

      const result = await wearableUrns.validate(components, deployment)

      expect(result.ok).toBeTruthy()
    })

    it('When wearable using a base emote, should return no errors', async () => {
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: {
          avatars: [
            {
              avatar: {
                wearables: ['raiseHand']
              }
            }
          ]
        },
        timestamp: ADR_75_TIMESTAMP + 1
      })
      const deployment = buildDeployment({ entity })

      const result = await wearableUrns.validate(components, deployment)

      expect(result.ok).toBeTruthy()
    })

    it('When wearable urn is wrong, should return the correct error', async () => {
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: {
          avatars: [
            {
              avatar: {
                wearables: ['urn:decentraland:tucu-tucu:base-avatars:tall_front_01']
              }
            }
          ]
        },
        timestamp: ADR_75_TIMESTAMP + 1
      })
      const deployment = buildDeployment({ entity })

      const result = await wearableUrns.validate(components, deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'Each profile wearable pointer should be a urn, for example (urn:decentraland:{protocol}:collections-v2:{contract(0x[a-fA-F0-9]+)}:{name}). Invalid pointer: (urn:decentraland:tucu-tucu:base-avatars:tall_front_01)'
      )
    })
  })

  describe('Profile emotes', () => {
    it('After ADR 74, if profile does not have "emotes" property, should return the correct error', async () => {
      const entity = buildEntity({
        type: EntityType.PROFILE,
        // VALID_PROFILE_METADATA does not have "emotes" property
        metadata: VALID_PROFILE_METADATA,
        timestamp: ADR_74_TIMESTAMP + 1
      })
      const deployment = buildDeployment({ entity })
      const result = await profileMustHaveEmotes.validate(components, deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain('Profile must have emotes after ADR 74.')
    })

    it('After ADR 74, when emote urn and slot are correct, should return no errors', async () => {
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: validProfileMetadataWithEmotes([
          { slot: 0, urn: 'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:0' }
        ]),
        timestamp: ADR_74_TIMESTAMP + 1
      })
      const deployment = buildDeployment({ entity })

      const result = await emoteUrns.validate(components, deployment)

      expect(result.ok).toBeTruthy()
    })

    it('After ADR 74, when emote urn is wrong, should return the correct error', async () => {
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: validProfileMetadataWithEmotes(
          // the urn below is invalid
          [{ slot: 0, urn: 'urn:decentraland:tucu-tucu:base-avatars:tall_front_01' }]
        ),
        timestamp: ADR_74_TIMESTAMP + 1
      })
      const deployment = buildDeployment({ entity })

      const result = await emoteUrns.validate(components, deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'Each profile emote pointer should be a urn, for example (urn:decentraland:{protocol}:collections-v2:{contract(0x[a-fA-F0-9]+)}:{name}). Invalid pointer: (urn:decentraland:tucu-tucu:base-avatars:tall_front_01)'
      )
    })

    it('After ADR 74, when emote slot number is < 0, should return the correct error', async () => {
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: validProfileMetadataWithEmotes([
          { slot: -1, urn: 'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:0' }
        ]),
        timestamp: ADR_74_TIMESTAMP + 1
      })
      const deployment = buildDeployment({ entity })

      const result = await emoteUrns.validate(components, deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The slot -1 of the emote urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:0 must be a number between 0 and 9 (inclusive).'
      )
    })

    it('After ADR 74, when emote slot number is > 9, should return the correct error', async () => {
      const entity = buildEntity({
        type: EntityType.PROFILE,
        metadata: validProfileMetadataWithEmotes([
          { slot: 10, urn: 'urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:0' }
        ]),
        timestamp: ADR_74_TIMESTAMP + 1
      })
      const deployment = buildDeployment({ entity })

      const result = await emoteUrns.validate(components, deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The slot 10 of the emote urn:decentraland:matic:collections-v2:0xa7f6eba61566fd4b3012569ef30f0200ec138aa5:0 must be a number between 0 and 9 (inclusive).'
      )
    })
  })
})
