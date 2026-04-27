import { EntityType, WearableCategory } from '@dcl/schemas'
import {
  createDeploymentMaxSizeExcludingThumbnailIsNotExceededValidateFn,
  createThumbnailMaxSizeIsNotExceededValidateFn
} from '../../../../src/validations/items/items'
import {
  springBonesMetadataValidateFn,
  thirdPartyWearableMerkleProofContentValidateFn,
  wearableRepresentationContentValidateFn
} from '../../../../src/validations/items/wearables'
import { createSizeValidateFn } from '../../../../src/validations/size'
import { ADR_45_TIMESTAMP } from '../../../../src/validations/timestamps'
import { buildDeployment } from '../../../setup/deployments'
import {
  VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT,
  VALID_THIRD_PARTY_WEARABLE_BASE_METADATA
} from '../../../setup/emotes'
import { buildEntity, buildWearableEntity } from '../../../setup/entity'
import { buildComponents, buildExternalCalls, createImage } from '../../../setup/mock'
import { VALID_THIRD_PARTY_WEARABLE, VALID_WEARABLE_METADATA } from '../../../setup/wearable'

describe('Wearables', () => {
  const timestamp = ADR_45_TIMESTAMP + 1
  const components = buildComponents()
  const thumbnailMaxSizeValidateFn = createThumbnailMaxSizeIsNotExceededValidateFn(components)
  describe('Thumbnail:', () => {
    let validThumbnailBuffer: Buffer
    let invalidThumbnailBuffer: Buffer
    const fileName = 'thumbnail.png'
    const hash = 'thumbnail'

    beforeAll(async () => {
      validThumbnailBuffer = await createImage(1024)
      invalidThumbnailBuffer = await createImage(1025)
    })

    it('When there is no hash for given thumbnail file name, it should return an error', async () => {
      const files = new Map([[hash, validThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: VALID_WEARABLE_METADATA,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result = await thumbnailMaxSizeValidateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't find hash for thumbnail file with name: ${fileName}`)
    })

    it('When there is no file for given thumbnail file hash, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([['notSame' + hash, validThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: VALID_WEARABLE_METADATA,
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result = await thumbnailMaxSizeValidateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't find thumbnail file with hash: ${hash}`)
    })

    it('When thumbnail image format is not valid, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, Buffer.alloc(1)]])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: VALID_WEARABLE_METADATA,
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result = await thumbnailMaxSizeValidateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't parse thumbnail, please check image format.`)
    })

    it('When thumbnail image size is invalid, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, invalidThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: VALID_WEARABLE_METADATA,
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result = await thumbnailMaxSizeValidateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Invalid thumbnail image size (width = 1025 / height = 1025)`)
    })

    it('When thumbnail image format is not png, it should return an error', async () => {
      const jpgImage = await createImage(1024, 'jpg')
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, jpgImage]])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: VALID_WEARABLE_METADATA,
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result = await thumbnailMaxSizeValidateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Invalid or unknown image format. Only 'PNG' format is accepted.`)
    })

    it('When thumbnail image size is valid, should not return any error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, validThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: VALID_WEARABLE_METADATA,
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const result = await thumbnailMaxSizeValidateFn(deployment)

      expect(result.ok).toBeTruthy()
    })

    it(`When thumbnail file was already uploaded, it won't be validated again`, async () => {
      const content = [{ file: fileName, hash }]
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: VALID_WEARABLE_METADATA,
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity })

      const externalCalls = buildExternalCalls({
        isContentStoredAlready: async () => new Map([[hash, true]])
      })

      const validateFn = createThumbnailMaxSizeIsNotExceededValidateFn(buildComponents({ externalCalls }))
      const result = await validateFn(deployment)

      expect(result.ok).toBeTruthy()
    })

    it('When thumbnail exceeds 1MB, it should return an error', async () => {
      // Create a large image that will exceed 1MB when encoded as PNG
      const largeThumbnailBuffer = await createImage(8192) // 8192x8192 image will be > 1MB
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, largeThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: VALID_WEARABLE_METADATA,
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      // Use the deployment size validation function instead of thumbnail dimension validation
      const validateFn = createDeploymentMaxSizeExcludingThumbnailIsNotExceededValidateFn(components)
      const result = await validateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        `The thumbnail is too big. The maximum allowed size for thumbnail model files is 1 MB. You can upload up to 1048576 bytes but you tried to upload 1328277.`
      )
    })
  })

  describe('Size:', () => {
    it(`When a wearable is deployed and model is too big, then it fails`, async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' },
        { file: 'thumbnail.png', hash: 'thumbnail' }
      ]
      const files = new Map([
        ['A', withSize(1)],
        ['C', withSize(1.5)],
        ['thumbnail', Buffer.alloc(1)]
      ])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: { thumbnail: 'thumbnail.png' },
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })
      const validateFn = createDeploymentMaxSizeExcludingThumbnailIsNotExceededValidateFn(components)
      const result = await validateFn(deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The deployment is too big. The maximum allowed size for wearable model files is 2 MB. You can upload up to 2097152 bytes but you tried to upload 2621440.'
      )
    })
    it(`Skin category has a special size, should support more than 3mb`, async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' },
        { file: 'thumbnail.png', hash: 'thumbnail' }
      ]
      const files = new Map([
        ['A', withSize(1)],
        ['C', withSize(1.5)],
        ['thumbnail', Buffer.alloc(1)]
      ])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: { thumbnail: 'thumbnail.png', data: { category: WearableCategory.SKIN } },
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })
      const validateFn = createDeploymentMaxSizeExcludingThumbnailIsNotExceededValidateFn(components)
      const result = await validateFn(deployment)

      expect(result.ok).toBeTruthy()
    })

    it(`Skin category has a special size, should fail when bigger than 8mb`, async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' },
        { file: 'D', hash: 'D' },
        { file: 'thumbnail.png', hash: 'thumbnail' }
      ]
      const files = new Map([
        ['A', withSize(3)],
        ['C', withSize(2.5)],
        ['D', withSize(3)],
        ['thumbnail', Buffer.alloc(1)]
      ])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: { thumbnail: 'thumbnail.png', data: { category: WearableCategory.SKIN } },
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })
      const validateFn = createDeploymentMaxSizeExcludingThumbnailIsNotExceededValidateFn(components)
      const result = await validateFn(deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The deployment is too big. The maximum allowed size for wearable model files is 8 MB. You can upload up to 8388608 bytes but you tried to upload 8912896.'
      )
    })

    it(`When a wearable is deployed and thumbnail is too big, then it fails`, async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' },
        { file: 'thumbnail.png', hash: 'thumbnail' }
      ]
      const files = new Map([
        ['A', withSize(1)],
        ['C', withSize(1)],
        ['thumbnail', withSize(2)]
      ])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: { thumbnail: 'thumbnail.png' },
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })

      const validateFn = createSizeValidateFn(components)
      const result = await validateFn(deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The deployment is too big. The maximum allowed size per pointer is 3 MB for wearable. You can upload up to 3145728 bytes but you tried to upload 4194304.'
      )
    })
    it(`when a wearable is deployed and sizes are correct, then it is ok`, async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' },
        { file: 'thumbnail.png', hash: 'thumbnail' }
      ]
      const files = new Map([
        ['A', withSize(1)],
        ['C', withSize(1)],
        ['thumbnail', withSize(0.9)]
      ])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: { thumbnail: 'thumbnail.png' },
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })
      const validateFn = createDeploymentMaxSizeExcludingThumbnailIsNotExceededValidateFn(components)
      const result = await validateFn(deployment)

      expect(result.ok).toBeTruthy()
    })

    it(`When thumbnail size is OK but wearable model files exceed 2MB, then it fails`, async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'B', hash: 'B' },
        { file: 'thumbnail.png', hash: 'thumbnail' }
      ]
      const files = new Map([
        ['A', withSize(1.5)], // 1.5MB
        ['B', withSize(1.5)], // 1.5MB (total model files = 3MB, exceeds 2MB limit)
        ['thumbnail', withSize(0.5)] // 0.5MB thumbnail (within 1MB limit)
      ])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: { thumbnail: 'thumbnail.png' },
        content,
        timestamp
      })
      const deployment = buildDeployment({ entity, files })
      const validateFn = createDeploymentMaxSizeExcludingThumbnailIsNotExceededValidateFn(components)
      const result = await validateFn(deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The deployment is too big. The maximum allowed size for wearable model files is 2 MB. You can upload up to 2097152 bytes but you tried to upload 3145728.'
      )
    })
  })
  describe('Content:', () => {
    it('when a wearable representation is referencing files included in content, then it is ok', async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'file1', hash: '1' },
        { file: 'file2', hash: '2' }
      ]
      const files = new Map([
        ['file1', withSize(1)],
        ['file2', withSize(0.9)]
      ])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        // this metadata includes representations pointing to file1 and file2
        metadata: VALID_WEARABLE_METADATA,
        content
      })
      const deployment = buildDeployment({ entity, files })
      const result = await wearableRepresentationContentValidateFn(deployment)

      expect(result.ok).toBeTruthy()
    })

    it('when a wearable representation is referencing a file that is not present in the content array, it returns an error', async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'notFile1', hash: '1' },
        { file: 'file2', hash: '2' }
      ]
      const files = new Map([
        ['notFile1', withSize(1)],
        ['file2', withSize(0.9)]
      ])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        // this metadata includes representations pointing to file1 and file2
        metadata: VALID_WEARABLE_METADATA,
        content
      })
      const deployment = buildDeployment({ entity, files })
      const result = await wearableRepresentationContentValidateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Representation content: 'file1' is not one of the content files`)
    })

    it('wearable validation without representation fails', async () => {
      const { data, ...wearableWithoutData } = { ...VALID_WEARABLE_METADATA }
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: {
          ...wearableWithoutData,
          data: {
            ...data,
            representations: []
          }
        },
        content: []
      })
      const deployment = buildDeployment({ entity })
      const result = await wearableRepresentationContentValidateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`No wearable representations found`)
    })

    it('emote validation without content fails', async () => {
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: VALID_WEARABLE_METADATA,
        content: []
      })
      const deployment = buildDeployment({ entity })
      const result = await wearableRepresentationContentValidateFn(deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`No content found`)
    })
  })

  describe(`Merkle Proofed (Third Party) Wearable`, () => {
    const { entity: metadata, root: merkleRoot } = VALID_THIRD_PARTY_WEARABLE

    it(`When urn corresponds to a Third Party wearable and can verify merkle root with the proofs, validation pass`, async () => {
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        pointers: [metadata.id],
        metadata: VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT.entity,
        content: Object.keys(VALID_THIRD_PARTY_WEARABLE_BASE_METADATA.content).map((file) => ({
          file,
          hash: VALID_THIRD_PARTY_WEARABLE_BASE_METADATA.content[file]
        }))
      })
      const deployment = buildDeployment({ entity })
      const result = await thirdPartyWearableMerkleProofContentValidateFn(deployment)

      expect(result.ok).toBeTruthy()
    })

    it(`When not a Third Party wearable, validation passes`, async () => {
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: VALID_WEARABLE_METADATA,
        content: []
      })
      const deployment = buildDeployment({ entity })
      const result = await thirdPartyWearableMerkleProofContentValidateFn(deployment)

      expect(result.ok).toBeTruthy()
    })

    it(`When metadata id does not match the pointer being deployed, validation fails`, async () => {
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        pointers: ['some-other-pointer'],
        metadata: VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT.entity,
        content: Object.keys(VALID_THIRD_PARTY_WEARABLE_BASE_METADATA.content).map((file) => ({
          file,
          hash: VALID_THIRD_PARTY_WEARABLE_BASE_METADATA.content[file]
        }))
      })
      const deployment = buildDeployment({ entity })
      const result = await thirdPartyWearableMerkleProofContentValidateFn(deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`The id '${metadata.id}' does not match the pointer 'some-other-pointer'`)
    })

    it(`When there are more uploaded files than declared in metadata, validation fails`, async () => {
      const entity = buildWearableEntity({
        metadata: VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT.entity,
        pointers: [VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT.entity.id],
        content: [
          ...Object.keys(VALID_THIRD_PARTY_WEARABLE_BASE_METADATA.content).map((file) => ({
            file,
            hash: VALID_THIRD_PARTY_WEARABLE_BASE_METADATA.content[file]
          })),
          { file: 'some-other-file', hash: 'some-other-hash' }
        ]
      })

      const deployment = buildDeployment({ entity })
      const result = await thirdPartyWearableMerkleProofContentValidateFn(deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The content declared in the metadata does not match the files uploaded with the entity'
      )
    })

    it(`When there are less uploaded files than declared in metadata, validation fails`, async () => {
      const entity = buildWearableEntity({
        metadata: VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT.entity,
        pointers: [VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT.entity.id],
        content: [
          ...Object.keys(VALID_THIRD_PARTY_WEARABLE_BASE_METADATA.content)
            .slice(1)
            .map((file) => ({
              file,
              hash: VALID_THIRD_PARTY_WEARABLE_BASE_METADATA.content[file]
            }))
        ]
      })

      const deployment = buildDeployment({ entity })
      const result = await thirdPartyWearableMerkleProofContentValidateFn(deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The content declared in the metadata does not match the files uploaded with the entity'
      )
    })

    it(`When an uploaded file is different to the one declared in metadata, validation fails`, async () => {
      const entity = buildWearableEntity({
        metadata: VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT.entity,
        pointers: [VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT.entity.id],
        content: [
          {
            file: VALID_THIRD_PARTY_WEARABLE_BASE_METADATA.content[0],
            hash: 'some-other-hash'
          },
          ...Object.keys(VALID_THIRD_PARTY_WEARABLE_BASE_METADATA.content)
            .slice(1)
            .map((file) => ({
              file,
              hash: VALID_THIRD_PARTY_WEARABLE_BASE_METADATA.content[file]
            }))
        ]
      })

      const deployment = buildDeployment({ entity })
      const result = await thirdPartyWearableMerkleProofContentValidateFn(deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The content declared in the metadata does not match the files uploaded with the entity'
      )
    })

    it(`When part of the proofed metadata is altered, validation fails`, async () => {
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        pointers: [metadata.id],
        metadata: {
          ...VALID_THIRD_PARTY_EMOTE_METADATA_WITH_MERKLE_ROOT.entity,
          name: 'otherName'
        },
        content: Object.keys(VALID_THIRD_PARTY_WEARABLE_BASE_METADATA.content).map((file) => ({
          file,
          hash: VALID_THIRD_PARTY_WEARABLE_BASE_METADATA.content[file]
        }))
      })
      const deployment = buildDeployment({ entity })
      const result = await thirdPartyWearableMerkleProofContentValidateFn(deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        "The entity hash provided '124ce3f2650617ee506608461299c1097161768b15de11dc3cb617a65bb82334' is different to the one calculated from the metadata 'd78f642b785a7a63dece99cd8c68479c8033f69178dc54e348f24e8ecfeb2a08'"
      )
    })
  })

  describe('Spring bones:', () => {
    // VALID_WEARABLE_METADATA's representation has mainFile: 'file1', so the active
    // hash for the representation is whatever 'file1' maps to in entity.content.
    const fileHash = 'bafkreialsvt77jvpy673cnugp5ggnxfaalfncufweayuk3jbxskh3pelkm'
    const file2Hash = 'bafkreigreflbn4w3a36rgg2ywlhf2asebqlsd4skg5q5djpklcdcjkbjvi'
    const baseContent = [
      { file: 'file1', hash: fileHash },
      { file: 'file2', hash: file2Hash }
    ]
    const validBoneParams = {
      stiffness: 2,
      gravityPower: 0,
      gravityDir: [0, -1, 0] as [number, number, number],
      drag: 0.5,
      isRoot: true
    }

    function buildWearableWithSpringBones(springBones: unknown) {
      return buildEntity({
        type: EntityType.WEARABLE,
        metadata: {
          ...VALID_WEARABLE_METADATA,
          data: { ...VALID_WEARABLE_METADATA.data, springBones }
        },
        content: baseContent,
        timestamp
      })
    }

    it('passes when no springBones field is present', async () => {
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: VALID_WEARABLE_METADATA,
        content: baseContent,
        timestamp
      })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeTruthy()
    })

    it('passes when models is empty', async () => {
      const entity = buildWearableWithSpringBones({ version: 1, models: {} })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeTruthy()
    })

    it('passes with a valid hash-keyed entry and a canonical bone name', async () => {
      const entity = buildWearableWithSpringBones({
        version: 1,
        models: { [fileHash]: { Hair_springBone_L: validBoneParams } }
      })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeTruthy()
    })

    it('passes when isRoot is omitted (it is optional)', async () => {
      const { isRoot: _omit, ...paramsWithoutIsRoot } = validBoneParams
      const entity = buildWearableWithSpringBones({
        version: 1,
        models: { [fileHash]: { Hair_springBone_L: paramsWithoutIsRoot } }
      })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeTruthy()
    })

    it('passes when center is provided as a string', async () => {
      const entity = buildWearableWithSpringBones({
        version: 1,
        models: { [fileHash]: { Hair_springBone_L: { ...validBoneParams, center: 'Avatar_Hips' } } }
      })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeTruthy()
    })

    it('passes when two representations share the same GLB hash and there is one entry in models', async () => {
      const sharedHash = fileHash
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: {
          ...VALID_WEARABLE_METADATA,
          data: {
            ...VALID_WEARABLE_METADATA.data,
            representations: [
              {
                bodyShapes: ['urn:decentraland:off-chain:base-avatars:BaseMale'] as any,
                mainFile: 'male/shared.glb',
                contents: ['male/shared.glb'],
                overrideHides: [],
                overrideReplaces: []
              },
              {
                bodyShapes: ['urn:decentraland:off-chain:base-avatars:BaseFemale'] as any,
                mainFile: 'female/shared.glb',
                contents: ['female/shared.glb'],
                overrideHides: [],
                overrideReplaces: []
              }
            ],
            springBones: {
              version: 1,
              models: { [sharedHash]: { Hair_springBone: validBoneParams } }
            }
          }
        },
        content: [
          { file: 'male/shared.glb', hash: sharedHash },
          { file: 'female/shared.glb', hash: sharedHash }
        ],
        timestamp
      })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeTruthy()
    })

    it('fails when version is not 1', async () => {
      const entity = buildWearableWithSpringBones({
        version: 2,
        models: { [fileHash]: { Hair_springBone_L: validBoneParams } }
      })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain('springBones.version must be 1, got 2')
    })

    it('fails when models is keyed by a filename that is not a current representation hash', async () => {
      const entity = buildWearableWithSpringBones({
        version: 1,
        models: { 'male/AnimeLong.glb': { Hair_springBone_L: validBoneParams } }
      })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        `springBones.models key 'male/AnimeLong.glb' does not match any current representation hash`
      )
    })

    it('fails when a stale hash no longer matches any current representation', async () => {
      const staleHash = 'bafkreistaleshashstalehashstalehashstalehashstalehashstalehashstale'
      const entity = buildWearableWithSpringBones({
        version: 1,
        models: { [staleHash]: { Hair_springBone_L: validBoneParams } }
      })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        `springBones.models key '${staleHash}' does not match any current representation hash`
      )
    })

    it('fails when a bone name does not contain the springbone token', async () => {
      const entity = buildWearableWithSpringBones({
        version: 1,
        models: { [fileHash]: { Hair_001: validBoneParams } }
      })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        `Bone name 'Hair_001' in model '${fileHash}' does not follow the spring bone naming convention`
      )
    })

    it('fails when stiffness is out of range', async () => {
      const entity = buildWearableWithSpringBones({
        version: 1,
        models: { [fileHash]: { Hair_springBone_L: { ...validBoneParams, stiffness: 6 } } }
      })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeFalsy()
      expect(result.errors?.some((e) => e.includes('stiffness'))).toBeTruthy()
    })

    it('fails when drag is out of range', async () => {
      const entity = buildWearableWithSpringBones({
        version: 1,
        models: { [fileHash]: { Hair_springBone_L: { ...validBoneParams, drag: 1.5 } } }
      })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeFalsy()
      expect(result.errors?.some((e) => e.includes('drag'))).toBeTruthy()
    })

    it('fails when gravityDir has the wrong length', async () => {
      const entity = buildWearableWithSpringBones({
        version: 1,
        models: { [fileHash]: { Hair_springBone_L: { ...validBoneParams, gravityDir: [0, -1] } } }
      })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeFalsy()
      expect(result.errors?.some((e) => e.includes('gravityDir'))).toBeTruthy()
    })

    it('fails when gravityDir contains a non-numeric element', async () => {
      const entity = buildWearableWithSpringBones({
        version: 1,
        models: { [fileHash]: { Hair_springBone_L: { ...validBoneParams, gravityDir: [0, -1, 'x'] } } }
      })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeFalsy()
      expect(result.errors?.some((e) => e.includes('gravityDir'))).toBeTruthy()
    })

    it('fails when models is null', async () => {
      const entity = buildWearableWithSpringBones({ version: 1, models: null })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeFalsy()
    })

    it('fails when version field is missing entirely', async () => {
      const entity = buildWearableWithSpringBones({
        models: { [fileHash]: { Hair_springBone_L: validBoneParams } }
      })
      const result = await springBonesMetadataValidateFn(buildDeployment({ entity }))
      expect(result.ok).toBeFalsy()
    })
  })
})
