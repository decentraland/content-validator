import { EntityType } from '@dcl/schemas'
import sharp from 'sharp'
import { ADR_74_TIMESTAMP, ValidationResponse } from '../../../../src'
import {
  emoteRepresentationContent
} from '../../../../src/validations/items/emotes'
import {
  deploymentMaxSizeExcludingThumbnailIsNotExceeded,
  thumbnailMaxSizeIsNotExceeded
} from '../../../../src/validations/items/items'
import { size } from '../../../../src/validations/size'
import { buildDeployment } from '../../../setup/deployments'
import { VALID_EMOTE_METADATA } from '../../../setup/emote'
import { buildEntity } from '../../../setup/entity'
import { buildComponents, buildExternalCalls } from '../../../setup/mock'

describe('Emotes', () => {
  const timestampAfterADR74 = ADR_74_TIMESTAMP + 1
  const components = buildComponents()
  describe('Thumbnail:', () => {
    let validThumbnailBuffer: Buffer
    let invalidThumbnailBuffer: Buffer
    const fileName = 'thumbnail.png'
    const hash = 'thumbnail'

    const createImage = async (
      size: number,
      format: 'png' | 'jpg' = 'png'
    ): Promise<Buffer> => {
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
      validThumbnailBuffer = await createImage(1024)
      invalidThumbnailBuffer = await createImage(1025)
    })

    it('When there is no hash for given thumbnail file name, it should return an error', async () => {
      const files = new Map([[hash, validThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_EMOTE_METADATA,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })

      const result = await thumbnailMaxSizeIsNotExceeded.validate(components, deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        `Couldn't find hash for thumbnail file with name: ${fileName}`
      )
    })

    it('When there is no file for given thumbnail file hash, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([['notSame' + hash, validThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_EMOTE_METADATA,
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })

      const result = await thumbnailMaxSizeIsNotExceeded.validate(components, deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        `Couldn't find thumbnail file with hash: ${hash}`
      )
    })

    it('When thumbnail image format is not valid, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, Buffer.alloc(1)]])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_EMOTE_METADATA,
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })

      const result = await thumbnailMaxSizeIsNotExceeded.validate(components, deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        `Couldn't parse thumbnail, please check image format.`
      )
    })

    it('When thumbnail image size is invalid, it should return an error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, invalidThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_EMOTE_METADATA,
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })

      const result = await thumbnailMaxSizeIsNotExceeded.validate(components, deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        `Invalid thumbnail image size (width = 1025 / height = 1025)`
      )
    })

    it('When thumbnail image format is not png, it should return an error', async () => {
      const jpgImage = await createImage(1024, 'jpg')
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, jpgImage]])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_EMOTE_METADATA,
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })

      const result: ValidationResponse = await thumbnailMaxSizeIsNotExceeded.validate(
        components,
        deployment
      )
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        `Invalid or unknown image format. Only 'PNG' format is accepted.`
      )
    })

    it('When thumbnail image size is valid, should not return any error', async () => {
      const content = [{ file: fileName, hash }]
      const files = new Map([[hash, validThumbnailBuffer]])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_EMOTE_METADATA,
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })

      const result = await thumbnailMaxSizeIsNotExceeded.validate(components, deployment)

      expect(result.ok).toBeTruthy()
    })

    it(`When thumbnail file was already uploaded, it won't be validated again`, async () => {
      const content = [{ file: fileName, hash }]
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: VALID_EMOTE_METADATA,
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity })

      const externalCalls = buildExternalCalls({
        isContentStoredAlready: async () => new Map([[hash, true]])
      })

      const result = await thumbnailMaxSizeIsNotExceeded.validate(
        buildComponents({ externalCalls }),
        deployment
      )

      expect(result.ok).toBeTruthy()
    })
  })

  describe('Size:', () => {
    it(`When an emote is deployed and model is too big, then it fails`, async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' },
        { file: 'thumbnail.png', hash: 'thumbnail' }
      ]
      const files = new Map([
        ['A', withSize(2)],
        ['C', withSize(2.5)],
        ['thumbnail', Buffer.alloc(1)]
      ])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: { thumbnail: 'thumbnail.png' },
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })
      const result = await deploymentMaxSizeExcludingThumbnailIsNotExceeded.validate(components, deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The deployment is too big. The maximum allowed size for emote model files is 4 MB. You can upload up to 4194304 bytes but you tried to upload 4718592.'
      )
    })
    it(`When an emote is deployed and thumbnail is too big, then it fails`, async () => {
      const withSize = (size: number) => Buffer.alloc(size * 1024 * 1024)
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' },
        { file: 'thumbnail.png', hash: 'thumbnail' }
      ]
      const files = new Map([
        ['A', withSize(2)],
        ['C', withSize(2)],
        ['thumbnail', withSize(2)]
      ])
      const entity = buildEntity({
        type: EntityType.EMOTE,
        metadata: { thumbnail: 'thumbnail.png' },
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })
      const result = await size.validate(components, deployment)

      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The deployment is too big. The maximum allowed size per pointer is 5 MB for emote. You can upload up to 5242880 bytes but you tried to upload 6291456.'
      )
    })
    it(`when an emote is deployed and sizes are correct, then it is ok`, async () => {
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
        type: EntityType.EMOTE,
        metadata: { thumbnail: 'thumbnail.png' },
        content,
        timestamp: timestampAfterADR74
      })
      const deployment = buildDeployment({ entity, files })
      const result = await deploymentMaxSizeExcludingThumbnailIsNotExceeded.validate(components, deployment)

      expect(result.ok).toBeTruthy()
    })
  })
  describe('Content:', () => {
    it('when an emote representation is referencing files included in content, then it is ok', async () => {
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
        type: EntityType.EMOTE,
        // this metadata includes representations pointing to file1 and file2
        metadata: VALID_EMOTE_METADATA,
        content
      })
      const deployment = buildDeployment({ entity, files })
      const result = await emoteRepresentationContent.validate(
        components,
        deployment
      )
      console.log(result.errors)
      expect(result.ok).toBeTruthy()
    })

    it('when an emote representation is referencing a file that is not present in the content array, it returns an error', async () => {
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
        type: EntityType.EMOTE,
        // this metadata includes representations pointing to file1 and file2
        metadata: VALID_EMOTE_METADATA,
        content
      })
      const deployment = buildDeployment({ entity, files })
      const result = await emoteRepresentationContent.validate(
        components,
        deployment
      )
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        `Representation content: 'file1' is not one of the content files`
      )
    })
  })
})
