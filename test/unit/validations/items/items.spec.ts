import { EntityType } from '@dcl/schemas'
import { deploymentMaxSizeExcludingThumbnailIsNotExceeded } from '../../../../src/validations/items/items'
import { buildAuditInfo } from '../../../setup/deployments'
import { buildComponents, buildExternalCalls } from '../../../setup/mock'

describe('deploymentMaxSizeExcludingThumbnailIsNotExceeded', () => {
  const components = buildComponents()

  it('unsupported type', async () => {
    const unsopportedType = 'asdf'
    const invalidDeployment = {
      entity: {
        version: 'v3',
        type: unsopportedType,
        pointers: ['P1'],
        timestamp: Date.now(),
        content: [],
        id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq'
      },
      auditInfo: buildAuditInfo(),
      files: new Map()
    }

    const result = await deploymentMaxSizeExcludingThumbnailIsNotExceeded(components, invalidDeployment as any)
    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain(`Type ${unsopportedType} is not supported yet`)
  })

  it('deployment without thumbnail hash', async () => {
    const invalidDeployment = {
      entity: {
        version: 'v3',
        type: EntityType.EMOTE,
        pointers: ['P1'],
        timestamp: Date.now(),
        content: [{ file: 'the-thumbnail2', hash: 'hash1' }],
        id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq',
        metadata: {
          thumbnail: 'the-thumbnail'
        }
      }
    }
    const result = await deploymentMaxSizeExcludingThumbnailIsNotExceeded(components, invalidDeployment as any)
    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain("Couldn't find the thumbnail hash")
  })

  it('deployment without thumbnail content', async () => {
    const thumbnailHash = 'hash1'
    const invalidDeployment = {
      entity: {
        version: 'v3',
        type: EntityType.EMOTE,
        pointers: ['P1'],
        timestamp: Date.now(),
        content: [{ file: 'the-thumbnail', hash: thumbnailHash }],
        id: 'bafybeihz4c4cf4icnlh6yjtt7fooaeih3dkv2mz6umod7dybenzmsxkzvq',
        metadata: {
          thumbnail: 'the-thumbnail'
        }
      },
      files: new Map()
    }
    const components = {
      externalCalls: buildExternalCalls({
        fetchContentFileSize: () => Promise.resolve(undefined)
      })
    }
    const result = await deploymentMaxSizeExcludingThumbnailIsNotExceeded(
      buildComponents(components),
      invalidDeployment as any
    )
    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain(`Couldn't fetch content file with hash: ${thumbnailHash}`)
  })
})
