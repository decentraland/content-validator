import { EntityType, WearableCategory } from '@dcl/schemas'
import {
  createDeploymentMaxSizeExcludingThumbnailIsNotExceededValidateFn,
  createThumbnailMaxSizeIsNotExceededValidateFn
} from '../../../../src/validations/items/items'
import { wearableRepresentationContentValidateFn } from '../../../../src/validations/items/wearables'
import { createSizeValidateFn } from '../../../../src/validations/size'
import { ADR_45_TIMESTAMP } from '../../../../src/validations/timestamps'
import { buildDeployment } from '../../../setup/deployments'
import { buildEntity } from '../../../setup/entity'
import { buildComponents, buildExternalCalls, createImage } from '../../../setup/mock'
import { VALID_WEARABLE_METADATA } from '../../../setup/wearable'

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
})
