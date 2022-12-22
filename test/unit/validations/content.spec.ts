import {
  allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45,
  allHashesInUploadedFilesAreReportedInTheEntity,
  allHashesWereUploadedOrStored,
  allMandatoryContentFilesArePresent,
  content
} from '../../../src/validations/content'
import { ADR_158_TIMESTAMP, ADR_45_TIMESTAMP } from '../../../src/validations/timestamps'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { buildComponents, buildExternalCalls } from '../../setup/mock'
import { VALID_PROFILE_METADATA } from '../../setup/profiles'

const notAvailableHashMessage = (hash: string) => {
  return `This hash is referenced in the entity but was not uploaded or previously available: ${hash}`
}

const notReferencedHashMessage = (hash: string) => {
  return `This hash was uploaded but is not referenced in the entity: ${hash}`
}

describe('Content', () => {
  const components = buildComponents()
  it(`When a hash that was not uploaded and not present is referenced, it is reported`, async () => {
    const entity = buildEntity({
      content: [{ file: 'name', hash: 'hash' }]
    })

    const deployment = buildDeployment({ entity })

    const result = await allHashesWereUploadedOrStored.validate(components, deployment)
    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain(notAvailableHashMessage('hash'))
  })

  it(`When a hash content file was not uploaded but was already stored, then no error is returned`, async () => {
    const entity = buildEntity({
      content: [{ file: 'body.png', hash: 'hash' }],
      metadata: {
        avatars: [
          {
            avatar: {
              snapshots: {
                body: 'hash'
              }
            }
          }
        ]
      }
    })
    const deployment = buildDeployment({ entity })
    const externalCalls = buildExternalCalls({
      isContentStoredAlready: () => Promise.resolve(new Map([['hash', true]]))
    })

    const result = await content.validate(buildComponents({ externalCalls }), deployment)
    expect(result.ok).toBeTruthy()
  })

  it(`When a hash that was uploaded wasn't already stored, then an error is returned`, async () => {
    const entity = buildEntity({
      content: [{ file: 'name', hash: 'hash' }]
    })
    const files = new Map([['hash', Buffer.from([])]])
    const deployment = buildDeployment({ entity, files })

    const result = await allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45.validate(components, deployment)
    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain(
      "This file is not expected: 'name' or its hash is invalid: 'hash'. Please, include only valid snapshot files."
    )
  })

  it('When a hash is uploaded but not referenced, it is reported', async () => {
    const entity = buildEntity({
      content: [{ file: 'name', hash: 'hash' }]
    })

    const files = new Map([
      ['hash-1', Buffer.from([])],
      ['hash-2', Buffer.from([])]
    ])
    const deployment = buildDeployment({ entity, files })

    const result = await allHashesInUploadedFilesAreReportedInTheEntity.validate(components, deployment)
    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain(notReferencedHashMessage('hash-2'))
  })

  describe('ADR_45: ', () => {
    it('When profile content files correspond to any snapshot, then no error is returned', async () => {
      const expectedFile = 'face256.png'
      const hash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5s'

      const contentItems = [{ file: expectedFile, hash }]
      const files = new Map([[hash, Buffer.from([])]])
      const entity = buildEntity({
        metadata: VALID_PROFILE_METADATA,
        content: contentItems,
        timestamp: ADR_45_TIMESTAMP + 1
      })

      const deployment = buildDeployment({ entity, files })
      const result = await content.validate(components, deployment)
      expect(result.ok).toBeTruthy()
    })

    it(`When a profile content file hash doesn't correspond to any snapshot, it is reported`, async () => {
      const expectedFile = 'face256.png'

      const invalidHash = 'invalid-hash'
      const contentItems = [{ file: expectedFile, hash: invalidHash }]
      const files = new Map([[invalidHash, Buffer.from([])]])
      const entity = buildEntity({
        metadata: VALID_PROFILE_METADATA,
        content: contentItems,
        timestamp: ADR_45_TIMESTAMP + 1
      })

      const deployment = buildDeployment({ entity, files })
      const result = await allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45.validate(
        components,
        deployment
      )
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        `This file is not expected: '${expectedFile}' or its hash is invalid: '${invalidHash}'. Please, include only valid snapshot files.`
      )
    })

    it(`When profile content files don't correspond to any shapshot, it is reported`, async () => {
      const unexpectedFile = 'unexpected-file.png'
      const hash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5q'

      const contentItems = [{ file: unexpectedFile, hash }]
      const files = new Map([[hash, Buffer.from([])]])
      const entity = buildEntity({
        metadata: VALID_PROFILE_METADATA,
        content: contentItems,
        timestamp: ADR_45_TIMESTAMP + 1
      })

      const deployment = buildDeployment({ entity, files })
      const result = await allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45.validate(
        components,
        deployment
      )
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain(
        `This file is not expected: '${unexpectedFile}' or its hash is invalid: '${hash}'. Please, include only valid snapshot files.`
      )
    })

    it(`When profile content files don't correspond to any shapshot before ADR 45, it is not reported`, async () => {
      const unexpectedFile = 'unexpected-file.png'
      const hash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5q'

      const contentItems = [{ file: unexpectedFile, hash }]
      const files = new Map([[hash, Buffer.from([])]])
      const entity = buildEntity({
        metadata: VALID_PROFILE_METADATA,
        content: contentItems,
        timestamp: ADR_45_TIMESTAMP - 1
      })

      const deployment = buildDeployment({ entity, files })
      const result = await allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45.validate(
        components,
        deployment
      )
      expect(result.ok).toBeTruthy()
    })
  })

  describe('ADR_100: ', () => {
    it(`When profile content files are empty before ADR 100, it is not reported`, async () => {
      const entity = buildEntity({
        metadata: VALID_PROFILE_METADATA,
        content: [],
        timestamp: ADR_158_TIMESTAMP - 1
      })

      const deployment = buildDeployment({ entity })
      const result = await allMandatoryContentFilesArePresent.validate(components, deployment)
      expect(result.ok).toBeTruthy()
    })

    it(`When profile content files are empty after ADR 100, it is reported`, async () => {
      const entity = buildEntity({
        metadata: VALID_PROFILE_METADATA,
        content: [],
        timestamp: ADR_158_TIMESTAMP + 1
      })

      const deployment = buildDeployment({ entity })
      const result = await allMandatoryContentFilesArePresent.validate(components, deployment)
      expect(result.ok).toBeFalsy()
      expect(result.errors).toContain("Profile entity is missing file 'body.png'")
      expect(result.errors).toContain("Profile entity is missing file 'face256.png'")
    })

    it(`When profile content files are all present after ADR 100, it is not reported`, async () => {
      const faceFile = 'face256.png'
      const bodyFile = 'body.png'
      const hash = 'bafybeiasb5vpmaounyilfuxbd3lryvosl4yefqrfahsb2esg46q6tu6y5q'

      const contentItems = [
        { file: faceFile, hash },
        { file: bodyFile, hash }
      ]
      const files = new Map([[hash, Buffer.from([])]])
      const entity = buildEntity({
        metadata: VALID_PROFILE_METADATA,
        content: contentItems,
        timestamp: ADR_158_TIMESTAMP + 1
      })

      const deployment = buildDeployment({ entity, files })
      const result = await allMandatoryContentFilesArePresent.validate(components, deployment)
      expect(result.ok).toBeTruthy()
    })
  })
})
