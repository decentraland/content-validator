import { ADR_X_TIMESTAMP } from '../../../src'
import { size } from '../../../src/validations/size'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { buildExternalCalls } from '../../setup/mock'

const buildFiles = (...files: [hash: string, sizeInMB: number][]): Map<string, Uint8Array> =>
  new Map(files?.map((file) => [file[0], Buffer.alloc(file[1] * 1024 * 1024)]) ?? [])

describe('Size', () => {
  it('When an entity is too big per pointer, then it fails', async () => {
    const files = buildFiles(['hash', 3])
    const entity = buildEntity({ pointers: ['P1'] })
    const deployment = buildDeployment({ files, entity })
    const externalCalls = buildExternalCalls({
      getMaxUploadSizePerTypeInMB: () => 2,
    })

    const result = await size.validate({ deployment, externalCalls })
    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain(
      'The deployment is too big. The maximum allowed size per pointer is 2 MB for profile. You can upload up to 2097152 bytes but you tried to upload 3145728.'
    )
  })
  it('When an entity is big, but has enough pointers, then it is ok', async () => {
    const entity = buildEntity({ pointers: ['P1', 'P2'] })
    const files = buildFiles(['hash', 3])
    const deployment = buildDeployment({ entity, files })
    const externalCalls = buildExternalCalls({
      getMaxUploadSizePerTypeInMB: () => 2,
    })

    const result = await size.validate({ deployment, externalCalls })
    expect(result.ok).toBeTruthy()
  })

  describe('ADR_X: ', () => {
    const timestamp = ADR_X_TIMESTAMP + 1
    it('When an entity is too big per pointer, then it fails', async () => {
      const content = [{ file: 'C', hash: 'C' }]
      const entity = buildEntity({ content, timestamp, pointers: ['P1'] })
      const files = buildFiles(['C', 3])

      const deployment = buildDeployment({ entity, files })
      const externalCalls = buildExternalCalls({
        getMaxUploadSizePerTypeInMB: () => 2,
      })

      const result = await size.validate({ deployment, externalCalls })
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The deployment is too big. The maximum allowed size per pointer is 2 MB for profile. You can upload up to 2097152 bytes but you tried to upload 3145728.'
      )
    })

    it('When an entity final version is too big, then it fails', async () => {
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'B', hash: 'B' },
        { file: 'C', hash: 'C' },
      ]

      const contentSizes = new Map([
        ['A', 1024 * 1024 * 5],
        ['B', 1024 * 1024 * 5],
      ])
      const entity = buildEntity({ content, timestamp, pointers: ['P1'] })
      const files = buildFiles(['C', 3])

      const deployment = buildDeployment({ entity, files })
      const externalCalls = buildExternalCalls({
        getMaxUploadSizePerTypeInMB: () => 10,
        fetchContentFileSize: (hash) => Promise.resolve(contentSizes.get(hash) ?? 0),
      })

      const response = await size.validate({ deployment, externalCalls })
      expect(response.ok).toBeFalsy()
      expect(response.errors).toContain(
        'The deployment is too big. The maximum allowed size per pointer is 10 MB for profile. You can upload up to 10485760 bytes but you tried to upload 13631488.'
      )
    })

    it('When cannot fetch content file in order to check size, then it fails', async () => {
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' },
      ]

      const entity = buildEntity({ content, timestamp, pointers: ['P1'] })
      const files = buildFiles(['C', 3])

      const deployment = buildDeployment({ entity, files })
      const externalCalls = buildExternalCalls({
        getMaxUploadSizePerTypeInMB: () => 10,
        fetchContentFileSize: () => Promise.resolve(undefined),
      })

      const response = await size.validate({ deployment, externalCalls })
      expect(response.ok).toBeFalsy()
      expect(response.errors).toContain(`Couldn't fetch content file with hash: A`)
    })

    it(`When there are repeated hashes in content, then it doesn't count multiple times and is ok`, async () => {
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'B', hash: 'A' },
        { file: 'C', hash: 'C' },
      ]

      const contentSizes = new Map([['A', 1024 * 1024 * 5]])
      const entity = buildEntity({ content, timestamp, pointers: ['P1'] })
      const files = buildFiles(['C', 3])

      const deployment = buildDeployment({ entity, files })
      const externalCalls = buildExternalCalls({
        getMaxUploadSizePerTypeInMB: () => 10,
        fetchContentFileSize: (hash) => Promise.resolve(contentSizes.get(hash) ?? 0),
      })

      const response = await size.validate({ deployment, externalCalls })
      expect(response.ok).toBeTruthy()
    })
  })
})
