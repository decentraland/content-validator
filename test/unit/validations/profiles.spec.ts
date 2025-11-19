import { ContentMapping, EntityType } from '@dcl/schemas'
import { DeploymentToValidate, ValidateFn, ValidationResponse } from '../../../src/types'
import {
  allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn,
  allMandatoryContentFilesArePresentValidateFn,
  createFaceThumbnailValidateFn,
  createProfileImagesValidateFn,
  createProfileValidateFn,
  emoteUrnsValidateFn,
  entityShouldNotHaveContentFilesValidateFn,
  profileMustHaveEmotesValidateFn,
  profileMustNotHaveSnapshotsValidateFn,
  profileNameValidateFn,
  profileSlotsAreNotRepeatedValidateFn,
  profileWearablesNotRepeatedValidateFn,
  wearableUrnsValidateFn
} from '../../../src/validations/profile'
import {
  ADR_158_TIMESTAMP,
  ADR_232_TIMESTAMP,
  ADR_244_TIMESTAMP,
  ADR_290_REJECTED_TIMESTAMP,
  ADR_45_TIMESTAMP,
  ADR_74_TIMESTAMP,
  ADR_75_TIMESTAMP
} from '../../../src/validations/timestamps'
import {
  validateAfterADR232,
  validateAfterADR290RejectedTimestamp,
  validateAfterADR74,
  validateAfterADR75,
  validateUpToADR290OptionalityTimestamp
} from '../../../src/validations/validations'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity, buildProfileEntity } from '../../setup/entity'
import { buildComponents, buildExternalCalls, createImage } from '../../setup/mock'
import { VALID_PROFILE_METADATA, validProfileMetadataWithEmotes } from '../../setup/profiles'

// Mock the validation wrapper functions to simply return the validate function
// This allows us to test the profile validation logic without the wrapper behavior
jest.mock('../../../src/validations/validations', () => ({
  ...jest.requireActual('../../../src/validations/validations'),
  validateUpToADR290OptionalityTimestamp: jest.fn((_fromTimestamp: number, validateFn: ValidateFn) => validateFn),
  validateAfterADR290RejectedTimestamp: jest.fn((validateFn: ValidateFn) => validateFn),
  validateAfterADR75: jest.fn((validateFn: ValidateFn) => validateFn),
  validateAfterADR74: jest.fn((validateFn: ValidateFn) => validateFn),
  validateAfterADR232: jest.fn((validateFn: ValidateFn) => validateFn)
}))

const mockValidateUpToADR290OptionalityTimestamp = validateUpToADR290OptionalityTimestamp as jest.MockedFunction<
  typeof validateUpToADR290OptionalityTimestamp
>
const mockValidateAfterADR75 = validateAfterADR75 as jest.MockedFunction<typeof validateAfterADR75>
const mockValidateAfterADR74 = validateAfterADR74 as jest.MockedFunction<typeof validateAfterADR74>
const mockValidateAfterADR232 = validateAfterADR232 as jest.MockedFunction<typeof validateAfterADR232>
const mockValidateAfterADR290RejectedTimestamp = validateAfterADR290RejectedTimestamp as jest.MockedFunction<
  typeof validateAfterADR290RejectedTimestamp
>

describe('when validating face thumbnail', () => {
  let validateFn: ReturnType<typeof createFaceThumbnailValidateFn>
  let deployment: DeploymentToValidate
  let files: Map<string, Uint8Array>
  let face256Hash: string
  let isContentStoredAlreadyMock: Map<string, boolean>

  beforeEach(() => {
    face256Hash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5s'
    files = new Map()
    isContentStoredAlreadyMock = new Map()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the face256 hash is missing from metadata', () => {
    beforeEach(() => {
      deployment = buildDeployment({
        entity: buildProfileEntity({
          timestamp: ADR_45_TIMESTAMP + 1000,
          metadata: {
            avatars: [
              {
                ...VALID_PROFILE_METADATA.avatars[0],
                avatar: {
                  ...VALID_PROFILE_METADATA.avatars[0].avatar,
                  snapshots: undefined
                }
              }
            ]
          }
        }),
        files
      })
      const components = buildComponents()
      validateFn = createFaceThumbnailValidateFn(components)
    })

    it('should return an error stating that the hash is missing', async () => {
      const result: ValidationResponse = await validateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(`Couldn't find hash for face256 thumbnail file with name: 'face256'`)
    })
  })

  describe('and the profile has a valid a face256 thumbnail in the metadata', () => {
    beforeEach(() => {
      deployment = buildDeployment({
        entity: buildProfileEntity({
          timestamp: ADR_45_TIMESTAMP + 1000,
          metadata: VALID_PROFILE_METADATA
        }),
        files
      })

      const components = buildComponents({
        externalCalls: buildExternalCalls({
          isContentStoredAlready: jest.fn().mockResolvedValue(isContentStoredAlreadyMock)
        })
      })
      validateFn = createFaceThumbnailValidateFn(components)
    })

    describe('and the face256 thumbnail is already stored', () => {
      beforeEach(async () => {
        const face256Buffer = await createImage(256, 'png')
        files.set(face256Hash, new Uint8Array(face256Buffer))
        isContentStoredAlreadyMock.set(face256Hash, true)
      })

      it('should return ok', async () => {
        const result: ValidationResponse = await validateFn(deployment)
        expect(result.ok).toBe(true)
      })
    })

    describe('and the face256 thumbnail is not already stored', () => {
      beforeEach(() => {
        isContentStoredAlreadyMock.set(face256Hash, false)
      })

      describe('and the thumbnail is valid', () => {
        beforeEach(async () => {
          const face256Buffer = await createImage(256, 'png')
          files.set(face256Hash, new Uint8Array(face256Buffer))
        })

        it('should return ok', async () => {
          const result: ValidationResponse = await validateFn(deployment)
          expect(result.ok).toBe(true)
        })
      })

      describe('and the thumbnail file is not in the uploaded files', () => {
        beforeEach(() => {
          files.delete(face256Hash)
        })

        it('should return an error stating that the thumbnail file was not found', async () => {
          const result: ValidationResponse = await validateFn(deployment)
          expect(result.ok).toBe(false)
          expect(result.errors).toContain(`Couldn't find thumbnail file with hash: ${face256Hash}`)
        })
      })

      describe('and the thumbnail has invalid format', () => {
        beforeEach(async () => {
          const face256Buffer = await createImage(256, 'jpg')
          files.set(face256Hash, new Uint8Array(face256Buffer))
        })

        it('should return an error stating that the format is invalid', async () => {
          const result: ValidationResponse = await validateFn(deployment)
          expect(result.ok).toBe(false)
          expect(result.errors).toContain(`Invalid or unknown image format. Only 'PNG' format is accepted.`)
        })
      })

      describe('and the thumbnail has an invalid size', () => {
        beforeEach(async () => {
          const face256Buffer = await createImage(512, 'png')
          files.set(face256Hash, new Uint8Array(face256Buffer))
        })

        it('should return an error stating that the thumbnail has an invalid size', async () => {
          const result: ValidationResponse = await validateFn(deployment)
          expect(result.ok).toBe(false)
          expect(result.errors).toContain(`Invalid face256 thumbnail image size (width = 512 / height = 512)`)
        })
      })

      describe('and the thumbnail is corrupted', () => {
        beforeEach(() => {
          files.set(face256Hash, new Uint8Array([1, 2, 3]))
        })

        it('should return an error stating that the thumbnail is not a valid image', async () => {
          const result: ValidationResponse = await validateFn(deployment)
          expect(result.ok).toBe(false)
          expect(result.errors).toContain(`Couldn't parse face256 thumbnail, please check image format.`)
        })
      })
    })
  })
})

describe('when validating wearable URNs', () => {
  let deployment: DeploymentToValidate

  beforeEach(() => {
    jest.clearAllMocks()

    deployment = buildDeployment({
      entity: buildProfileEntity({
        timestamp: ADR_75_TIMESTAMP + 1000,
        metadata: VALID_PROFILE_METADATA
      })
    })
  })

  it('should call validateAfterADR75', async () => {
    await wearableUrnsValidateFn(deployment)
    expect(mockValidateAfterADR75).toHaveBeenCalledWith(expect.any(Function))
  })

  describe('and all wearables are valid URNs', () => {
    it('should return ok', async () => {
      const result: ValidationResponse = await wearableUrnsValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and wearables include old emotes', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].avatar.wearables = [
        'dance',
        'wave',
        'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0'
      ]
    })

    it('should return ok', async () => {
      const result: ValidationResponse = await wearableUrnsValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and a wearable has an invalid URN', () => {
    let invalidPointer: string

    beforeEach(() => {
      invalidPointer = 'urn:decentraland:invalid'
      deployment.entity.metadata.avatars[0].avatar.wearables = [invalidPointer]
    })

    it('should return an error with the invalid pointer', async () => {
      const result: ValidationResponse = await wearableUrnsValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(
        `Each profile wearable pointer should be a urn, for example (urn:decentraland:{protocol}:collections-v2:{contract(0x[a-fA-F0-9]+)}:{name}). Invalid pointer: (${invalidPointer})`
      )
    })
  })

  describe('and if the deployment is after the ADR 244 timestamp', () => {
    beforeEach(() => {
      deployment.entity.timestamp = ADR_244_TIMESTAMP + 1000
    })

    describe('and a wearable is a blockchain collection v2 asset instead of an item', () => {
      let assetPointer: string

      beforeEach(() => {
        assetPointer = 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0'
        deployment.entity.metadata.avatars[0].avatar.wearables = [assetPointer]
      })

      it('should return an error indicating that the asset should be item', async () => {
        const result: ValidationResponse = await wearableUrnsValidateFn(deployment)
        expect(result.ok).toBe(false)
        expect(result.errors).toContain(
          `Wearable pointer ${assetPointer} should be an item, not an asset. The URN must include the tokenId.`
        )
      })
    })

    describe('and a wearable is a blockchain collection v1 asset instead of an item', () => {
      let assetPointer: string

      beforeEach(() => {
        assetPointer = 'urn:decentraland:ethereum:collections-v1:0x09305998a531fade369ebe30adf868c96a34e813:1'
        deployment.entity.metadata.avatars[0].avatar.wearables = [assetPointer]
      })

      it('should return an error indicating that the asset should be item', async () => {
        const result: ValidationResponse = await wearableUrnsValidateFn(deployment)
        expect(result.ok).toBe(false)
        expect(result.errors).toContain(
          `Wearable pointer ${assetPointer} should be an item, not an asset. The URN must include the tokenId.`
        )
      })
    })

    describe('and wearables are items with tokenId', () => {
      beforeEach(() => {
        deployment.entity.metadata.avatars[0].avatar.wearables = [
          'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0:123'
        ]
      })

      it('should return ok', async () => {
        const result: ValidationResponse = await wearableUrnsValidateFn(deployment)
        expect(result.ok).toBe(true)
      })
    })
  })
})

describe('when validating emote URNs', () => {
  let deployment: DeploymentToValidate

  beforeEach(() => {
    jest.clearAllMocks()

    deployment = buildDeployment({
      entity: buildProfileEntity({
        timestamp: ADR_74_TIMESTAMP + 1000,
        metadata: VALID_PROFILE_METADATA
      })
    })
  })

  it('should call validateAfterADR74', async () => {
    await emoteUrnsValidateFn(deployment)
    expect(mockValidateAfterADR74).toHaveBeenCalledWith(expect.any(Function))
  })

  describe('and all emotes are valid URNs with valid slots', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].avatar.emotes = [
        { slot: 0, urn: 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0' },
        { slot: 1, urn: 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:1' }
      ]
    })

    it('should return ok', async () => {
      const result: ValidationResponse = await emoteUrnsValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and emotes include old emotes', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].avatar.emotes = [
        { slot: 0, urn: 'dance' },
        { slot: 1, urn: 'wave' }
      ]
    })

    it('should return ok', async () => {
      const result: ValidationResponse = await emoteUrnsValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and an emote has an invalid URN', () => {
    let invalidUrn: string

    beforeEach(() => {
      invalidUrn = 'urn:decentraland:invalid'
      deployment = buildDeployment({
        entity: buildProfileEntity({
          timestamp: ADR_74_TIMESTAMP + 1000,
          metadata: validProfileMetadataWithEmotes([{ slot: 0, urn: invalidUrn }], [])
        })
      })
    })

    it('should return an error with the invalid URN', async () => {
      const result: ValidationResponse = await emoteUrnsValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(
        `Each profile emote pointer should be a urn, for example (urn:decentraland:{protocol}:collections-v2:{contract(0x[a-fA-F0-9]+)}:{name}). Invalid pointer: (${invalidUrn})`
      )
    })
  })

  describe('and if the deployment is after the ADR 244 timestamp', () => {
    beforeEach(() => {
      deployment.entity.timestamp = ADR_244_TIMESTAMP + 1000
    })

    describe('and an emote is a blockchain collection v2 asset instead of an item', () => {
      let assetUrn: string

      beforeEach(() => {
        assetUrn = 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0'
        deployment.entity.metadata.avatars[0].avatar.emotes = [{ slot: 0, urn: assetUrn }]
      })

      it('should return an error indicating asset should be item', async () => {
        const result: ValidationResponse = await emoteUrnsValidateFn(deployment)
        expect(result.ok).toBe(false)
        expect(result.errors).toContain(
          `Emote pointer ${assetUrn} should be an item, not an asset. The URN must include the tokenId.`
        )
      })
    })

    describe('and an emote is a blockchain collection v1 asset instead of an item', () => {
      let assetUrn: string

      beforeEach(() => {
        assetUrn = 'urn:decentraland:ethereum:collections-v1:0x09305998a531fade369ebe30adf868c96a34e813:1'
        deployment.entity.metadata.avatars[0].avatar.emotes = [{ slot: 0, urn: assetUrn }]
      })

      it('should return an error indicating that the asset should be item', async () => {
        const result: ValidationResponse = await emoteUrnsValidateFn(deployment)
        expect(result.ok).toBe(false)
        expect(result.errors).toContain(
          `Emote pointer ${assetUrn} should be an item, not an asset. The URN must include the tokenId.`
        )
      })
    })

    describe('and emotes are items with tokenId', () => {
      beforeEach(() => {
        deployment.entity.metadata.avatars[0].avatar.emotes = [
          { slot: 0, urn: 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0:123' }
        ]
      })

      it('should return ok', async () => {
        const result: ValidationResponse = await emoteUrnsValidateFn(deployment)
        expect(result.ok).toBe(true)
      })
    })
  })

  describe('and an emote has an invalid negative slot', () => {
    let invalidSlot: number

    beforeEach(() => {
      invalidSlot = -1
      deployment.entity.metadata.avatars[0].avatar.emotes = [
        { slot: invalidSlot, urn: 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0' }
      ]
    })

    it('should return an error about invalid slot range', async () => {
      const result: ValidationResponse = await emoteUrnsValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(
        `The slot ${invalidSlot} of the emote urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0 must be a number between 0 and 9 (inclusive).`
      )
    })
  })

  describe('and an emote has an invalid positive slot greater than 9', () => {
    let invalidSlot: number

    beforeEach(() => {
      invalidSlot = 10
      deployment.entity.metadata.avatars[0].avatar.emotes = [
        { slot: invalidSlot, urn: 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0' }
      ]
    })

    it('should return an error about invalid slot range', async () => {
      const result: ValidationResponse = await emoteUrnsValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(
        `The slot ${invalidSlot} of the emote urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0 must be a number between 0 and 9 (inclusive).`
      )
    })
  })
})

describe('when validating that profile must have emotes', () => {
  let deployment: DeploymentToValidate

  beforeEach(() => {
    jest.clearAllMocks()

    deployment = buildDeployment({
      entity: buildProfileEntity({
        timestamp: ADR_74_TIMESTAMP + 1000,
        metadata: VALID_PROFILE_METADATA
      })
    })
  })

  it('should call validateAfterADR74', async () => {
    await profileMustHaveEmotesValidateFn(deployment)
    expect(mockValidateAfterADR74).toHaveBeenCalledWith(expect.any(Function))
  })

  describe('and the profile has emotes', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].avatar.emotes = [
        { slot: 0, urn: 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0' }
      ]
    })

    it('should return ok', async () => {
      const result: ValidationResponse = await profileMustHaveEmotesValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and the profile does not have emotes', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].avatar.emotes = undefined
    })

    it('should return an error', async () => {
      const result: ValidationResponse = await profileMustHaveEmotesValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('Profile must have emotes after ADR 74.')
    })
  })

  describe('and the profile has empty emotes array', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].avatar.emotes = []
    })

    it('should return ok since the array exists', async () => {
      const result: ValidationResponse = await profileMustHaveEmotesValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })
})

describe('when validating that emote slots are not repeated', () => {
  let deployment: DeploymentToValidate

  beforeEach(() => {
    jest.clearAllMocks()

    deployment = buildDeployment({
      entity: buildProfileEntity({
        timestamp: ADR_74_TIMESTAMP + 1000,
        metadata: VALID_PROFILE_METADATA
      })
    })
  })

  describe('and all slots are unique', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].avatar.emotes = [
        { slot: 0, urn: 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0' },
        { slot: 1, urn: 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:1' },
        { slot: 2, urn: 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:2' }
      ]
    })

    it('should return ok', async () => {
      const result: ValidationResponse = await profileSlotsAreNotRepeatedValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and an emote has a repeated slot', () => {
    beforeEach(() => {
      deployment = buildDeployment({
        entity: buildProfileEntity({
          timestamp: ADR_74_TIMESTAMP + 1000,
          metadata: validProfileMetadataWithEmotes(
            [
              { slot: 0, urn: 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0' },
              { slot: 0, urn: 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:1' }
            ],
            []
          )
        })
      })
    })

    it('should return an error', async () => {
      const result: ValidationResponse = await profileSlotsAreNotRepeatedValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('Emote slot 0 should not be repeated.')
    })
  })

  describe('and there are no emotes', () => {
    beforeEach(() => {
      deployment = buildDeployment({
        entity: buildProfileEntity({
          timestamp: ADR_74_TIMESTAMP + 1000,
          metadata: VALID_PROFILE_METADATA
        })
      })
    })

    it('should return ok', async () => {
      const result: ValidationResponse = await profileSlotsAreNotRepeatedValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })
})

describe('when validating that wearables are not repeated', () => {
  let deployment: DeploymentToValidate

  beforeEach(() => {
    jest.clearAllMocks()

    deployment = buildDeployment({
      entity: buildProfileEntity({
        timestamp: ADR_232_TIMESTAMP + 1000,
        metadata: VALID_PROFILE_METADATA
      })
    })
  })

  it('should call validateAfterADR232', async () => {
    await profileWearablesNotRepeatedValidateFn(deployment)
    expect(mockValidateAfterADR232).toHaveBeenCalledWith(expect.any(Function))
  })

  describe('and the avatar has unique wearables', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].avatar.wearables = [
        'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0',
        'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:1',
        'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:2'
      ]
    })

    it('should return ok', async () => {
      const result: ValidationResponse = await profileWearablesNotRepeatedValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and the avatar has a repeated wearable', () => {
    let repeatedWearable: string

    beforeEach(() => {
      repeatedWearable = 'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:0'
      deployment.entity.metadata.avatars[0].avatar.wearables = [
        repeatedWearable,
        'urn:decentraland:matic:collections-v2:0xf6f601efee04e74cecac02c8c5bdc8cc0fc1c721:1',
        repeatedWearable
      ]
    })

    it('should return an error', async () => {
      const result: ValidationResponse = await profileWearablesNotRepeatedValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('Wearables should not be repeated.')
    })
  })

  describe('and the avatar has no wearables', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].avatar.wearables = []
    })

    it('should return ok', async () => {
      const result: ValidationResponse = await profileWearablesNotRepeatedValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })
})

describe('when validating profile images', () => {
  let validateFn: ReturnType<typeof createProfileImagesValidateFn>
  let deployment: DeploymentToValidate
  let files: Map<string, Uint8Array>
  let calculatedFileHashes: Map<string, { calculatedHash: string; buffer: Uint8Array }>
  let face256Hash: string
  let bodyHash: string

  beforeEach(() => {
    jest.clearAllMocks()

    files = new Map()
    calculatedFileHashes = new Map()
    deployment = buildDeployment({
      entity: buildProfileEntity({
        timestamp: ADR_45_TIMESTAMP + 1000,
        metadata: VALID_PROFILE_METADATA
      }),
      files
    })
    const components = buildComponents({
      externalCalls: buildExternalCalls({
        calculateFilesHashes: jest.fn().mockResolvedValue(calculatedFileHashes)
      })
    })
    validateFn = createProfileImagesValidateFn(components)
  })

  describe('and all image hashes match', () => {
    beforeEach(() => {
      face256Hash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5s'
      bodyHash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5t'
      files.set(face256Hash, new Uint8Array())
      files.set(bodyHash, new Uint8Array())
      calculatedFileHashes.set(face256Hash, { calculatedHash: face256Hash, buffer: new Uint8Array() })
      calculatedFileHashes.set(bodyHash, { calculatedHash: bodyHash, buffer: new Uint8Array() })
    })

    it('should return ok', async () => {
      const result: ValidationResponse = await validateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and the body hash does not match', () => {
    let wrongBodyHash: string

    beforeEach(() => {
      wrongBodyHash = 'aDifferentHash'
      face256Hash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5s'
      bodyHash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5t'
      deployment.entity.metadata.avatars[0].avatar.snapshots = {
        face256: face256Hash,
        body: bodyHash
      }
      calculatedFileHashes.set(face256Hash, { calculatedHash: face256Hash, buffer: new Uint8Array() })
      calculatedFileHashes.set(bodyHash, { calculatedHash: wrongBodyHash, buffer: new Uint8Array() })
      files.set(face256Hash, new Uint8Array())
      files.set(bodyHash, new Uint8Array())
    })

    it('should return an error stating that the body hash is incorrect', async () => {
      const result: ValidationResponse = await validateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(`Mismatch of hash found for file. Expected: ${bodyHash} but got ${wrongBodyHash}`)
    })
  })

  describe('and the face256 hash does not match', () => {
    let wrongFace256Hash: string
    beforeEach(() => {
      wrongFace256Hash = 'aDifferentHash'
      face256Hash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5s'
      bodyHash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5t'
      deployment.entity.metadata.avatars[0].avatar.snapshots = {
        face256: face256Hash,
        body: bodyHash
      }
      calculatedFileHashes.set(face256Hash, { calculatedHash: wrongFace256Hash, buffer: new Uint8Array() })
      calculatedFileHashes.set(bodyHash, { calculatedHash: bodyHash, buffer: new Uint8Array() })
      files.set(face256Hash, new Uint8Array())
      files.set(bodyHash, new Uint8Array())
    })

    it('should return an error stating that the face256 hash is incorrect', async () => {
      const result: ValidationResponse = await validateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(
        `Mismatch of hash found for file. Expected: ${face256Hash} but got ${wrongFace256Hash}`
      )
    })
  })

  describe('and both hashes do not match', () => {
    let wrongFace256Hash: string
    let wrongBodyHash: string

    beforeEach(() => {
      wrongFace256Hash = 'aDifferentHash'
      wrongBodyHash = 'aDifferentHash'
      face256Hash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5s'
      bodyHash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5t'
      deployment.entity.metadata.avatars[0].avatar.snapshots = {
        face256: face256Hash,
        body: bodyHash
      }
      calculatedFileHashes.set(face256Hash, { calculatedHash: wrongFace256Hash, buffer: new Uint8Array() })
      calculatedFileHashes.set(bodyHash, { calculatedHash: wrongBodyHash, buffer: new Uint8Array() })
      files.set(face256Hash, new Uint8Array())
      files.set(bodyHash, new Uint8Array())
    })

    it('should return an error stating that both hashes are incorrect', async () => {
      const result: ValidationResponse = await validateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(
        `Mismatch of hash found for file. Expected: ${face256Hash} but got ${wrongFace256Hash}`
      )
      expect(result.errors).toContain(`Mismatch of hash found for file. Expected: ${bodyHash} but got ${wrongBodyHash}`)
    })
  })

  describe('and the face256 hash is missing', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].avatar.snapshots = {
        face256: undefined,
        body: 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5t'
      }
    })

    it('should return an error stating that the face256 hash is missing', async () => {
      const result: ValidationResponse = await validateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(`Couldn't find hash for face or body thumbnails on profile metadata`)
    })
  })

  describe('and body hash is missing', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].avatar.snapshots = {
        face256: 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5s',
        body: undefined
      }
    })

    it('should return an error stating that the body hash is missing', async () => {
      const result: ValidationResponse = await validateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(`Couldn't find hash for face or body thumbnails on profile metadata`)
    })
  })
})

describe('when validating that profile must not have snapshots', () => {
  let deployment: DeploymentToValidate

  beforeEach(() => {
    jest.clearAllMocks()

    deployment = buildDeployment({
      entity: buildProfileEntity({
        timestamp: ADR_290_REJECTED_TIMESTAMP + 1000,
        metadata: VALID_PROFILE_METADATA
      })
    })
  })

  it('should call validateAfterADR290RejectedTimestamp', async () => {
    await profileMustNotHaveSnapshotsValidateFn(deployment)
    expect(mockValidateAfterADR290RejectedTimestamp).toHaveBeenCalledWith(expect.any(Function))
  })

  describe('and the avatar has no snapshots', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].avatar.snapshots = undefined
    })

    it('should return ok', async () => {
      const result: ValidationResponse = await profileMustNotHaveSnapshotsValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and the avatar has a snapshot', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].avatar.snapshots = {
        face256: 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5s',
        body: 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5t'
      }
    })

    it('should return an error', async () => {
      const result: ValidationResponse = await profileMustNotHaveSnapshotsValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('Avatars must not have snapshots.')
    })
  })
})

describe('when validating that all content files correspond to at least one avatar snapshot', () => {
  let deployment: DeploymentToValidate
  let content: ContentMapping[]

  beforeEach(() => {
    jest.clearAllMocks()
    content = []
    deployment = buildDeployment({
      entity: buildProfileEntity({ timestamp: ADR_45_TIMESTAMP + 1000, content, metadata: VALID_PROFILE_METADATA }),
      files: new Map()
    })
  })

  it('should call validateUpToADR290OptionalityTimestamp with ADR_45_TIMESTAMP', async () => {
    await allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn(deployment)
    expect(mockValidateUpToADR290OptionalityTimestamp).toHaveBeenCalledWith(ADR_45_TIMESTAMP, expect.any(Function))
  })

  describe('and there is a content file that corresponds to face256 snapshot', () => {
    beforeEach(() => {
      const hash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5s'
      content.push({ file: 'face256.png', hash })
    })

    it('should return ok', async () => {
      const result: ValidationResponse =
        await allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and there is a content file that corresponds to body snapshot', () => {
    beforeEach(() => {
      const hash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5t'
      content.push({ file: 'body.png', hash })
    })

    it('should return ok', async () => {
      const result: ValidationResponse =
        await allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and there is a content file that does not correspond to any snapshot', () => {
    let invalidFile: string
    let invalidHash: string

    beforeEach(() => {
      invalidFile = 'invalid.png'
      invalidHash = 'invalidHash'
      content.push({ file: invalidFile, hash: invalidHash })
    })

    it('should return an error with the file name and hash', async () => {
      const result: ValidationResponse =
        await allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(
        `This file is not expected: 'invalid.png' or its hash is invalid: 'invalidHash'. Please, include only valid snapshot files.`
      )
    })
  })

  describe('and there is a content file with a wrong hash for the snapshot', () => {
    let wrongHash: string

    beforeEach(() => {
      wrongHash = 'wrongHashForFace256'
      content.push({ file: 'face256.png', hash: wrongHash })
    })

    it('should return an error with the file name and hash', async () => {
      const result: ValidationResponse =
        await allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(
        `This file is not expected: 'face256.png' or its hash is invalid: 'wrongHashForFace256'. Please, include only valid snapshot files.`
      )
    })
  })

  describe("and the entity's metadata has no avatars", () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars = []
      content.push({ file: 'face256.png', hash: 'someHash' })
    })

    it('should return an error', async () => {
      const result: ValidationResponse =
        await allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(`Entity is missing metadata or avatars`)
    })
  })
})

describe('when validating that all mandatory content files are present', () => {
  let deployment: DeploymentToValidate
  let content: ContentMapping[]
  let files: Map<string, Uint8Array>

  beforeEach(() => {
    jest.clearAllMocks()
    content = []
    files = new Map()
    deployment = buildDeployment({
      entity: buildProfileEntity({ timestamp: ADR_158_TIMESTAMP + 1000, content }),
      files
    })
  })

  it('should call validateUpToADR290OptionalityTimestamp with ADR_158_TIMESTAMP', async () => {
    await allMandatoryContentFilesArePresentValidateFn(deployment)
    expect(mockValidateUpToADR290OptionalityTimestamp).toHaveBeenCalledWith(ADR_158_TIMESTAMP, expect.any(Function))
  })

  describe('and both mandatory files are present', () => {
    beforeEach(() => {
      content.push({ file: 'body.png', hash: 'hash1' })
      content.push({ file: 'face256.png', hash: 'hash2' })
    })

    it('should return ok', async () => {
      const result: ValidationResponse = await allMandatoryContentFilesArePresentValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and mandatory files use different case', () => {
    beforeEach(() => {
      content.push({ file: 'BODY.PNG', hash: 'hash1' })
      content.push({ file: 'FACE256.PNG', hash: 'hash2' })
    })

    it('should return ok', async () => {
      const result: ValidationResponse = await allMandatoryContentFilesArePresentValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and body.png is missing', () => {
    beforeEach(() => {
      content.push({ file: 'face256.png', hash: 'hash2' })
    })

    it('should return an error with the missing file name', async () => {
      const result: ValidationResponse = await allMandatoryContentFilesArePresentValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(`Profile entity is missing file 'body.png'`)
    })
  })

  describe('and face256.png is missing', () => {
    beforeEach(() => {
      content.push({ file: 'body.png', hash: 'hash1' })
    })

    it('should return an error with missing file name', async () => {
      const result: ValidationResponse = await allMandatoryContentFilesArePresentValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(`Profile entity is missing file 'face256.png'`)
    })
  })

  describe('and both mandatory files are missing', () => {
    it('should return an error with both missing file names', async () => {
      const result: ValidationResponse = await allMandatoryContentFilesArePresentValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(`Profile entity is missing file 'body.png'`)
      expect(result.errors).toContain(`Profile entity is missing file 'face256.png'`)
    })
  })
})

describe('when validating that the entity should not have content files', () => {
  let deployment: DeploymentToValidate
  let content: ContentMapping[]
  let files: Map<string, Uint8Array>

  beforeEach(() => {
    jest.clearAllMocks()
    content = []
    files = new Map()
    deployment = buildDeployment({
      entity: buildProfileEntity({ timestamp: ADR_290_REJECTED_TIMESTAMP + 1, content }),
      files
    })
  })

  it('should call validateAfterADR290RejectedTimestamp', async () => {
    await entityShouldNotHaveContentFilesValidateFn(deployment)
    expect(mockValidateAfterADR290RejectedTimestamp).toHaveBeenCalledWith(expect.any(Function))
  })

  describe('and the entity is a profile', () => {
    beforeEach(() => {})

    describe('and the profile has no content files', () => {
      it('should return ok', async () => {
        const result: ValidationResponse = await entityShouldNotHaveContentFilesValidateFn(deployment)
        expect(result.ok).toBe(true)
      })
    })

    describe('and the entity has content', () => {
      beforeEach(() => {
        content.push({ file: 'body.png', hash: 'hash1' })
      })

      it('should return an error with the content file name', async () => {
        const result: ValidationResponse = await entityShouldNotHaveContentFilesValidateFn(deployment)
        expect(result.ok).toBe(false)
        expect(result.errors).toContain(`Entity has content files when it should not: body.png`)
      })
    })

    describe('and the entity has uploaded files', () => {
      beforeEach(() => {
        files.set('hash1', new Uint8Array())
      })

      it('should return an error with the uploaded file hash', async () => {
        const result: ValidationResponse = await entityShouldNotHaveContentFilesValidateFn(deployment)
        expect(result.ok).toBe(false)
        expect(result.errors).toContain(`Entity has uploaded files when it should not: hash1`)
      })
    })
  })
})

describe('when validating profile name', () => {
  let deployment: DeploymentToValidate

  beforeEach(() => {
    jest.clearAllMocks()

    deployment = buildDeployment({
      entity: buildProfileEntity({
        timestamp: ADR_75_TIMESTAMP + 1000,
        metadata: VALID_PROFILE_METADATA
      })
    })
  })

  describe('and the name is valid', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].name = 'ValidName123'
    })

    it('should return ok', () => {
      const result: ValidationResponse = profileNameValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and the name has minimum valid length', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].name = 'ab'
    })

    it('should return ok', () => {
      const result: ValidationResponse = profileNameValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and the name has maximum valid length', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].name = 'a'.repeat(15)
    })

    it('should return ok', () => {
      const result: ValidationResponse = profileNameValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and the name is only numbers', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].name = '123456'
    })

    it('should return ok', () => {
      const result: ValidationResponse = profileNameValidateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })

  describe('and the name is too short', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].name = 'a'
    })

    it('should return an error about invalid length', () => {
      const result: ValidationResponse = profileNameValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('Profile names should be between 2 and 15 characters.')
    })
  })

  describe('and the name is empty', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].name = ''
    })

    it('should return an error about invalid length', () => {
      const result: ValidationResponse = profileNameValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('Profile names should be between 2 and 15 characters.')
    })
  })

  describe('and the name is too long', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].name = 'a'.repeat(16)
    })

    it('should return an error about invalid length', () => {
      const result: ValidationResponse = profileNameValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('Profile names should be between 2 and 15 characters.')
    })
  })

  describe('and the name contains spaces', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].name = 'Some Name'
    })

    it('should return an error about special characters', () => {
      const result: ValidationResponse = profileNameValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(
        'Profile name should only contain letters and numbers. No special characters allowed.'
      )
    })
  })

  describe('and the name contains hyphens', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].name = 'name-test'
    })

    it('should return an error about special characters', () => {
      const result: ValidationResponse = profileNameValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(
        'Profile name should only contain letters and numbers. No special characters allowed.'
      )
    })
  })

  describe('and the name contains underscores', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].name = 'name_test'
    })

    it('should return an error about special characters', () => {
      const result: ValidationResponse = profileNameValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(
        'Profile name should only contain letters and numbers. No special characters allowed.'
      )
    })
  })

  describe('and the name contains special characters', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].name = 'name@test'
    })

    it('should return an error about special characters', () => {
      const result: ValidationResponse = profileNameValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(
        'Profile name should only contain letters and numbers. No special characters allowed.'
      )
    })
  })

  describe('and the name contains emoji', () => {
    beforeEach(() => {
      deployment.entity.metadata.avatars[0].name = 'name😊'
    })

    it('should return an error about special characters', () => {
      const result: ValidationResponse = profileNameValidateFn(deployment)
      expect(result.ok).toBe(false)
      expect(result.errors).toContain(
        'Profile name should only contain letters and numbers. No special characters allowed.'
      )
    })
  })
})

describe('when creating profile validate function', () => {
  let validateFn: ReturnType<typeof createProfileValidateFn>
  let deployment: DeploymentToValidate

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('and the entity is not a profile', () => {
    beforeEach(() => {
      deployment = buildDeployment({
        entity: buildEntity({
          type: EntityType.SCENE,
          timestamp: ADR_45_TIMESTAMP + 1000
        })
      })
      const components = buildComponents()
      validateFn = createProfileValidateFn(components)
    })

    it('should return ok', async () => {
      const result: ValidationResponse = await validateFn(deployment)
      expect(result.ok).toBe(true)
    })
  })
})
