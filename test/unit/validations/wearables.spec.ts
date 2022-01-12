import { EntityType } from 'dcl-catalyst-commons'
import sharp from 'sharp'
import { ADR_45_TIMESTAMP } from '../../../src'
import { size } from '../../../src/validations/size'
import { wearableSize, wearableThumbnail } from '../../../src/validations/wearable'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { buildExternalCalls } from '../../setup/mock'
import { VALID_WEARABLE_METADATA } from '../../setup/wearable'

describe('Wearables', () => {
  const timestamp = ADR_45_TIMESTAMP + 1
  describe('Thumbnail:', () => {
    let validThumbnailBuffer: Buffer
    let invalidThumbnailBuffer: Buffer
    const fileName = 'thumbnail.png'
    const hash = 'thumbnail'

    const createImage = async (size: number, format: 'png' | 'jpg' = 'png'): Promise<Buffer> => {
      let image = sharp({
        create: {
          width: size,
          height: size,
          channels: 4,
          background: { r: 255, g: 0, b: 0, alpha: 0.5 },
        },
      })
      if (format) {
        image = format === 'png' ? image.png() : image.jpeg()
      }
      return await image.toBuffer()
    }

    beforeAll(async () => {
      validThumbnailBuffer = await createImage(1024)
      invalidThumbnailBuffer = await createImage(1)
    })
    const externalCalls = buildExternalCalls()
    it('When there is no hash for given thumbnail file name, it should return an error', async () => {
      const files = new Map([[hash, validThumbnailBuffer]])
      const entity = buildEntity({ type: EntityType.WEARABLE, metadata: VALID_WEARABLE_METADATA, timestamp })
      const deployment = buildDeployment({ entity, files })

      const result = await wearableThumbnail.validate({ deployment, externalCalls })
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't find hash for thumbnail file with name: ${fileName}`)
    })

    it('When there is no file for given thumbnail file hash, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([['notSame' + hash, validThumbnailBuffer]])
      const entity = buildEntity({ type: EntityType.WEARABLE, metadata: VALID_WEARABLE_METADATA, content, timestamp })
      const deployment = buildDeployment({ entity, files })

      const result = await wearableThumbnail.validate({ deployment, externalCalls })
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't find thumbnail file with hash: ${hash}`)
    })

    it('When thumbnail image format is not valid, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, Buffer.alloc(1)]])
      const entity = buildEntity({ type: EntityType.WEARABLE, metadata: VALID_WEARABLE_METADATA, content, timestamp })
      const deployment = buildDeployment({ entity, files })

      const result = await wearableThumbnail.validate({ deployment, externalCalls })
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't parse thumbnail, please check image format.`)
    })

    it('When thumbnail image size is invalid, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, invalidThumbnailBuffer]])
      const entity = buildEntity({ type: EntityType.WEARABLE, metadata: VALID_WEARABLE_METADATA, content, timestamp })
      const deployment = buildDeployment({ entity, files })

      const result = await wearableThumbnail.validate({ deployment, externalCalls })
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Invalid thumbnail image size (width = 1 / height = 1)`)
    })

    it('When thumbnail image format is not png, it should return an error', async () => {
      const jpgImage = await createImage(1024, 'jpg')
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, jpgImage]])
      const entity = buildEntity({ type: EntityType.WEARABLE, metadata: VALID_WEARABLE_METADATA, content, timestamp })
      const deployment = buildDeployment({ entity, files })

      const result = await wearableThumbnail.validate({ deployment, externalCalls })
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Invalid or unknown image format. Only 'PNG' format is accepted.`)
    })

    it('When thumbnail image size is valid, should not return any error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, validThumbnailBuffer]])
      const entity = buildEntity({ type: EntityType.WEARABLE, metadata: VALID_WEARABLE_METADATA, content, timestamp })
      const deployment = buildDeployment({ entity, files })

      const result = await wearableThumbnail.validate({ deployment, externalCalls })

      expect(result.ok).toBeTruthy()
    })
  })

  describe('Size:', () => {
    it(`When a wearable is deployed and model is too big, then it fails`, async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' },
        { file: 'thumbnail.png', hash: 'thumbnail' },
      ]
      const files = new Map([
        ['A', withSize(1)],
        ['C', withSize(1.5)],
        ['thumbnail', Buffer.alloc(1)],
      ])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: { thumbnail: 'thumbnail.png' },
        content,
        timestamp,
      })
      const deployment = buildDeployment({ entity, files })
      const externalCalls = buildExternalCalls()
      const result = await wearableSize.validate({ deployment, externalCalls })

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The deployment is too big. The maximum allowed size for wearable model files is 2 MB. You can upload up to 2097152 bytes but you tried to upload 2621440.'
      )
    })
    it(`When a wearable is deployed and thumbnail is too big, then it fails`, async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' },
        { file: 'thumbnail.png', hash: 'thumbnail' },
      ]
      const files = new Map([
        ['A', withSize(1)],
        ['C', withSize(1)],
        ['thumbnail', withSize(2)],
      ])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: { thumbnail: 'thumbnail.png' },
        content,
        timestamp,
      })
      const deployment = buildDeployment({ entity, files })
      const externalCalls = buildExternalCalls()
      const result = await size.validate({ deployment, externalCalls })

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
        { file: 'thumbnail.png', hash: 'thumbnail' },
      ]
      const files = new Map([
        ['A', withSize(1)],
        ['C', withSize(1)],
        ['thumbnail', withSize(0.9)],
      ])
      const entity = buildEntity({
        type: EntityType.WEARABLE,
        metadata: { thumbnail: 'thumbnail.png' },
        content,
        timestamp,
      })
      const deployment = buildDeployment({ entity, files })
      const externalCalls = buildExternalCalls()
      const result = await wearableSize.validate({ deployment, externalCalls })

      expect(result.ok).toBeTruthy()
    })
  })
})
