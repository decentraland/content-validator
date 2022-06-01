import { hashV1 } from '@dcl/hashing'
import { EntityType } from '@dcl/schemas'
import { ADR_45_TIMESTAMP } from '../../../src'
import { size } from '../../../src/validations/size'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { buildComponents, buildExternalCalls } from '../../setup/mock'

const buildFiles = (
  ...files: [hash: string, sizeInMB: number][]
): Map<string, Uint8Array> =>
  new Map(
    files?.map((file) => [file[0], Buffer.alloc(file[1] * 1024 * 1024)]) ?? []
  )

describe('Size', () => {
  const components = buildComponents()

  it('When an entity is too big per pointer, then it fails', async () => {
    const files = buildFiles(['body.png', 2.1])
    const hash = await hashV1(files.get('body.png')!)

    const entity = buildEntity({
      pointers: ['P1'],
      content: [
        {
          file: 'body.png',
          hash: hash
        }
      ],
      metadata: {
        avatars: [
          {
            avatar: {
              snapshots: {
                body: hash
              }
            }
          }
        ]
      }
    })
    const deployment = buildDeployment({
      files: new Map([[hash, files.get('body.png')!]]),
      entity
    })
    const externalCalls = buildExternalCalls()

    const result = await size.validate(components, deployment)
    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain(
      'The deployment is too big. The maximum allowed size per pointer is 2 MB for profile. You can upload up to 2097152 bytes but you tried to upload 2202009.'
    )
  })
  it('When an entity is big, but has enough pointers, then it is ok', async () => {
    const files = buildFiles(['body.png', 2.1])
    const hash = await hashV1(files.get('body.png')!)

    const entity = buildEntity({
      pointers: ['P1', 'P2'],
      content: [
        {
          file: 'body.png',
          hash: hash
        }
      ],
      metadata: {
        avatars: [
          {
            avatar: {
              snapshots: {
                body: hash
              }
            }
          }
        ]
      }
    })
    const deployment = buildDeployment({
      files: new Map([[hash, files.get('body.png')!]]),
      entity
    })
    const externalCalls = buildExternalCalls()

    const result = await size.validate(components, deployment)
    expect(result.ok).toBeTruthy()
  })

  describe('ADR_45: ', () => {
    const timestamp = ADR_45_TIMESTAMP + 1
    it('When an entity is too big per pointer, then it fails', async () => {
      const content = [{ file: 'C', hash: 'C' }]
      const entity = buildEntity({ content, timestamp, pointers: ['P1'] })
      const files = buildFiles(['C', 2.1])

      const deployment = buildDeployment({ entity, files })
      const externalCalls = buildExternalCalls()

      const result = await size.validate(components, deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        'The deployment is too big. The maximum allowed size per pointer is 2 MB for profile. You can upload up to 2097152 bytes but you tried to upload 2202009.'
      )
    })

    it('When an entity final version is too big, then it fails', async () => {
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'B', hash: 'B' },
        { file: 'C', hash: 'C' }
      ]

      const contentSizes = new Map([
        ['A', 1024 * 1024 * 5],
        ['B', 1024 * 1024 * 5]
      ])
      const entity = buildEntity({
        content,
        timestamp,
        pointers: ['P1'],
        type: EntityType.SCENE
      })
      const files = buildFiles(['C', 6])

      const deployment = buildDeployment({ entity, files })
      const externalCalls = buildExternalCalls({
        fetchContentFileSize: (hash) =>
          Promise.resolve(contentSizes.get(hash) ?? 0)
      })

      const response = await size.validate(buildComponents({ externalCalls }), deployment)
      expect(response.ok).toBeFalsy()
      expect(response.errors).toContain(
        'The deployment is too big. The maximum allowed size per pointer is 15 MB for scene. You can upload up to 15728640 bytes but you tried to upload 16777216.'
      )
    })

    it('When cannot fetch content file in order to check size, then it fails', async () => {
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' }
      ]

      const entity = buildEntity({
        content,
        timestamp,
        pointers: ['P1'],
        type: EntityType.SCENE
      })
      const files = buildFiles(['C', 3])

      const deployment = buildDeployment({ entity, files })
      const externalCalls = buildExternalCalls({
        fetchContentFileSize: () => Promise.resolve(undefined)
      })

      const response = await size.validate(components, deployment)
      expect(response.ok).toBeFalsy()
      expect(response.errors).toContain(
        `Couldn't fetch content file with hash: A`
      )
    })

    it('When file has 0 size, it succeeds', async () => {
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'C', hash: 'C' }
      ]

      const entity = buildEntity({
        content,
        timestamp,
        pointers: ['P1'],
        type: EntityType.SCENE
      })
      const files = buildFiles(['C', 3])

      const deployment = buildDeployment({ entity, files })
      const externalCalls = buildExternalCalls({
        fetchContentFileSize: () => Promise.resolve(0)
      })

      const response = await size.validate(buildComponents({ externalCalls }), deployment)
      expect(response.ok).toBeTruthy()
    })

    it(`When there are repeated hashes in content, then it doesn't count multiple times and is ok`, async () => {
      const content = [
        { file: 'A', hash: 'A' },
        { file: 'B', hash: 'A' },
        { file: 'C', hash: 'C' }
      ]

      const contentSizes = new Map([['A', 1024 * 1024 * 5]])
      const entity = buildEntity({
        content,
        timestamp,
        pointers: ['P1'],
        type: EntityType.SCENE
      })
      const files = buildFiles(['C', 3])

      const deployment = buildDeployment({ entity, files })
      const externalCalls = buildExternalCalls({
        fetchContentFileSize: (hash) =>
          Promise.resolve(contentSizes.get(hash) ?? 0)
      })

      const response = await size.validate(buildComponents({ externalCalls }), deployment)
      expect(response.ok).toBeTruthy()
    })
  })
})
