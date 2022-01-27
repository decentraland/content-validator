import { EntityType } from 'dcl-catalyst-commons'
import sharp from 'sharp'
import { ADR_45_TIMESTAMP } from '../../../src'
import { faceThumbnail } from '../../../src/validations/profile'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { buildExternalCalls } from '../../setup/mock'
import { VALID_PROFILE_METADATA } from '../../setup/profiles'

describe('Profiles', () => {
  const timestamp = ADR_45_TIMESTAMP + 1
  describe('Thumbnail face256:', () => {
    let validThumbnailBuffer: Buffer
    let invalidThumbnailBuffer: Buffer
    const fileName = 'face256.png'
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
      validThumbnailBuffer = await createImage(256)
      invalidThumbnailBuffer = await createImage(1)
    })
    const externalCalls = buildExternalCalls()
    it('When there is no hash for given thumbnail file name, it should return an error', async () => {
      const files = new Map([[hash, validThumbnailBuffer]])
      const entity = buildEntity({ type: EntityType.PROFILE, metadata: VALID_PROFILE_METADATA, timestamp })
      const deployment = buildDeployment({ entity, files })

      const result = await faceThumbnail.validate({ deployment, externalCalls })
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't find hash for thumbnail file with name: ${fileName}`)
    })

    it('When there is no file for given thumbnail file hash, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([['notSame' + hash, validThumbnailBuffer]])
      const entity = buildEntity({ type: EntityType.PROFILE, metadata: VALID_PROFILE_METADATA, content, timestamp })
      const deployment = buildDeployment({ entity, files })

      const result = await faceThumbnail.validate({ deployment, externalCalls })
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't find thumbnail file with hash: ${hash}`)
    })

    it('When thumbnail image format is not valid, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, Buffer.alloc(1)]])
      const entity = buildEntity({ type: EntityType.PROFILE, metadata: VALID_PROFILE_METADATA, content, timestamp })
      const deployment = buildDeployment({ entity, files })

      const result = await faceThumbnail.validate({ deployment, externalCalls })
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Couldn't parse thumbnail, please check image format.`)
    })

    it('When thumbnail image size is invalid, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, invalidThumbnailBuffer]])
      const entity = buildEntity({ type: EntityType.PROFILE, metadata: VALID_PROFILE_METADATA, content, timestamp })
      const deployment = buildDeployment({ entity, files })

      const result = await faceThumbnail.validate({ deployment, externalCalls })
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Invalid thumbnail image size (width = 1 / height = 1)`)
    })

    it('When thumbnail image format is not png, it should return an error', async () => {
      const jpgImage = await createImage(1024, 'jpg')
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, jpgImage]])
      const entity = buildEntity({ type: EntityType.PROFILE, metadata: VALID_PROFILE_METADATA, content, timestamp })
      const deployment = buildDeployment({ entity, files })

      const result = await faceThumbnail.validate({ deployment, externalCalls })
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(`Invalid or unknown image format. Only 'PNG' format is accepted.`)
    })

    it('When thumbnail image size is valid, should not return any error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, validThumbnailBuffer]])
      const entity = buildEntity({ type: EntityType.PROFILE, metadata: VALID_PROFILE_METADATA, content, timestamp })
      const deployment = buildDeployment({ entity, files })

      const result = await faceThumbnail.validate({ deployment, externalCalls })

      expect(result.ok).toBeTruthy()
    })
  })
})
