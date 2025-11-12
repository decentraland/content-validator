import { ContentMapping, EntityType } from '@dcl/schemas'
import { DeploymentToValidate, ValidateFn, ValidationResponse } from '../../../src/types'
import {
  allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn,
  allHashesInUploadedFilesAreReportedInTheEntityValidateFn,
  allMandatoryContentFilesArePresentValidateFn,
  createAllHashesWereUploadedOrStoredValidateFn,
  entityShouldNotHaveContentFilesValidateFn
} from '../../../src/validations/content'
import { ADR_158_TIMESTAMP, ADR_290_REJECTED_TIMESTAMP, ADR_45_TIMESTAMP } from '../../../src/validations/timestamps'
import {
  validateAfterADR290RejectedTimestamp,
  validateUpToADR290OptionalityTimestamp
} from '../../../src/validations/validations'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity, buildProfileEntity } from '../../setup/entity'
import { buildComponents, buildExternalCalls } from '../../setup/mock'
import { VALID_PROFILE_METADATA } from '../../setup/profiles'

// Mock the validation wrapper functions to simply return the validate function
// This allows us to test the content validation logic without the wrapper behavior
jest.mock('../../../src/validations/validations', () => ({
  ...jest.requireActual('../../../src/validations/validations'),
  validateUpToADR290OptionalityTimestamp: jest.fn((_fromTimestamp: number, validateFn: ValidateFn) => validateFn),
  validateAfterADR290RejectedTimestamp: jest.fn((validateFn: ValidateFn) => validateFn)
}))

const mockValidateUpToADR290OptionalityTimestamp = validateUpToADR290OptionalityTimestamp as jest.MockedFunction<
  typeof validateUpToADR290OptionalityTimestamp
>
const mockValidateAfterADR290RejectedTimestamp = validateAfterADR290RejectedTimestamp as jest.MockedFunction<
  typeof validateAfterADR290RejectedTimestamp
>

describe('when validating content files', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('when validating all hashes were uploaded or stored', () => {
    let validateFn: ReturnType<typeof createAllHashesWereUploadedOrStoredValidateFn>
    let deployment: DeploymentToValidate
    let content: ContentMapping[]
    let files: Map<string, Uint8Array>
    let isContentStoredAlreadyMock: Map<string, boolean>

    beforeEach(() => {
      content = []
      files = new Map()
      deployment = buildDeployment({
        entity: buildEntity({
          content
        }),
        files
      })
      isContentStoredAlreadyMock = new Map()

      const components = buildComponents({
        externalCalls: buildExternalCalls({
          isContentStoredAlready: jest.fn().mockResolvedValue(isContentStoredAlreadyMock)
        })
      })
      validateFn = createAllHashesWereUploadedOrStoredValidateFn(components)
    })

    describe('and none of the entity content hashes are already stored', () => {
      beforeEach(() => {
        isContentStoredAlreadyMock.clear()
      })

      describe('and the hashes are found in the uploaded files', () => {
        beforeEach(() => {
          files.set('hash1', new Uint8Array())
          files.set('hash2', new Uint8Array())
          content.push({ file: 'file1.png', hash: 'hash1' })
          content.push({ file: 'file2.png', hash: 'hash2' })
        })

        it('should return ok', async () => {
          const result: ValidationResponse = await validateFn(deployment)
          expect(result.ok).toBe(true)
        })
      })

      describe('and some of the hashes are not found in the uploaded files', () => {
        const hash2 = 'hash2'

        beforeEach(() => {
          files.set('hash1', new Uint8Array())
          content.push({ file: 'file1.png', hash: 'hash1' })
          content.push({ file: 'file2.png', hash: 'hash2' })
          deployment = buildDeployment({ entity: buildEntity({ content }), files })
        })

        it('should return an error with the missing hash', async () => {
          const result: ValidationResponse = await validateFn(deployment)
          expect(result.ok).toBe(false)
          expect(result.errors).toContain(
            `This hash is referenced in the entity but was not uploaded or previously available: ${hash2}`
          )
        })
      })
    })

    describe('and all of the entity content hashes are already stored', () => {
      const hash1 = 'hash1'
      const hash2 = 'hash2'

      beforeEach(() => {
        content.push({ file: 'file1.png', hash: hash1 })
        content.push({ file: 'file2.png', hash: hash2 })
        const components = buildComponents({
          externalCalls: buildExternalCalls({
            isContentStoredAlready: jest.fn().mockResolvedValue(
              new Map([
                [hash1, true],
                [hash2, true]
              ])
            )
          })
        })
        validateFn = createAllHashesWereUploadedOrStoredValidateFn(components)
      })

      describe('and the hashes are found in the uploaded files', () => {
        beforeEach(() => {
          files.set(hash1, new Uint8Array())
          files.set(hash2, new Uint8Array())
        })

        it('should return ok', async () => {
          const result: ValidationResponse = await validateFn(deployment)
          expect(result.ok).toBe(true)
        })
      })

      describe('and the hashes are not found in the uploaded files but in the files', () => {
        it('should return ok', async () => {
          const result: ValidationResponse = await validateFn(deployment)
          expect(result.ok).toBe(true)
        })
      })
    })

    describe('and some of the hashes are already stored and some others come from uploaded files', () => {
      beforeEach(() => {
        const hash1 = 'hash1'
        const hash2 = 'hash2'
        content.push({ file: 'file1.png', hash: hash1 })
        content.push({ file: 'file2.png', hash: hash2 })
        files.set(hash1, new Uint8Array())
        files.set(hash2, new Uint8Array())
        isContentStoredAlreadyMock.set(hash2, true)
      })

      it('should return ok', async () => {
        const result: ValidationResponse = await validateFn(deployment)
        expect(result.ok).toBe(true)
      })
    })

    describe('and the entity has no content', () => {
      beforeEach(() => {
        isContentStoredAlreadyMock.clear()
      })

      it('should return ok', async () => {
        const result: ValidationResponse = await validateFn(deployment)
        expect(result.ok).toBe(true)
      })
    })

    describe('and multiple hashes are missing', () => {
      beforeEach(() => {
        content.push({ file: 'file1.png', hash: 'hash1' })
        content.push({ file: 'file2.png', hash: 'hash2' })
        content.push({ file: 'file3.png', hash: 'hash3' })
      })

      it('should return an error for each of the missing hashes', async () => {
        const result: ValidationResponse = await validateFn(deployment)
        expect(result.ok).toBe(false)
        expect(result.errors).toContain(
          `This hash is referenced in the entity but was not uploaded or previously available: hash1`
        )
        expect(result.errors).toContain(
          `This hash is referenced in the entity but was not uploaded or previously available: hash2`
        )
        expect(result.errors).toContain(
          `This hash is referenced in the entity but was not uploaded or previously available: hash3`
        )
      })
    })
  })

  describe('when validating all hashes in uploaded files are reported in the entity', () => {
    let deployment: DeploymentToValidate
    let content: ContentMapping[]
    let files: Map<string, Uint8Array>
    let entityId: string

    beforeEach(() => {
      entityId = 'entityIdHash'
      content = []
      files = new Map()
      deployment = buildDeployment({
        entity: buildProfileEntity({ timestamp: ADR_45_TIMESTAMP + 1000, content, id: entityId }),
        files
      })
    })

    describe('and all hashes in uploaded files are reported in the entity', () => {
      beforeEach(() => {
        const hash1 = 'hash1'
        const hash2 = 'hash2'
        content.push({ file: 'file1.png', hash: hash1 })
        content.push({ file: 'file2.png', hash: hash2 })
        files.set(hash1, new Uint8Array())
        files.set(hash2, new Uint8Array())
      })

      it('should return ok', async () => {
        const result: ValidationResponse = await allHashesInUploadedFilesAreReportedInTheEntityValidateFn(deployment)
        expect(result.ok).toBe(true)
      })
    })

    describe('when uploaded hash is the entity id', () => {
      beforeEach(() => {
        content.push({ file: 'file1.png', hash: entityId })
        files.set(entityId, new Uint8Array())
      })

      it('should return ok', async () => {
        const result: ValidationResponse = await allHashesInUploadedFilesAreReportedInTheEntityValidateFn(deployment)
        expect(result.ok).toBe(true)
        expect(result.errors).toBeUndefined()
      })
    })

    describe('when an uploaded hash is not in the entity', () => {
      let unreportedHash: string

      beforeEach(() => {
        const hash1 = 'hash1'
        unreportedHash = 'unreportedHash'
        content.push({ file: 'file1.png', hash: hash1 })
        files.set(hash1, new Uint8Array())
        files.set(unreportedHash, new Uint8Array())
      })

      it('should return an error with the unreported hash', async () => {
        const result: ValidationResponse = await allHashesInUploadedFilesAreReportedInTheEntityValidateFn(deployment)
        expect(result.ok).toBe(false)
        expect(result.errors).toContain(`This hash was uploaded but is not referenced in the entity: ${unreportedHash}`)
      })
    })

    describe('and the entity has no content but there are uploaded files', () => {
      let uploadedHash: string

      beforeEach(() => {
        uploadedHash = 'uploadedHash'
        files.set(uploadedHash, new Uint8Array())
      })

      it('should return an error', async () => {
        const result: ValidationResponse = await allHashesInUploadedFilesAreReportedInTheEntityValidateFn(deployment)
        expect(result.ok).toBe(false)
        expect(result.errors).toContain(`This hash was uploaded but is not referenced in the entity: ${uploadedHash}`)
      })
    })

    describe('and no files are uploaded', () => {
      beforeEach(() => {
        content.push({ file: 'file1.png', hash: 'hash1' })
      })

      it('should return ok', async () => {
        const result: ValidationResponse = await allHashesInUploadedFilesAreReportedInTheEntityValidateFn(deployment)
        expect(result.ok).toBe(true)
      })
    })
  })

  describe('when validating that all content files correspond to at least one avatar snapshot', () => {
    it('should call validateUpToADR290OptionalityTimestamp with ADR_45_TIMESTAMP', async () => {
      const deployment: DeploymentToValidate = buildDeployment({
        entity: buildProfileEntity({ timestamp: ADR_45_TIMESTAMP + 1000 })
      })
      await allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn(deployment)
      expect(mockValidateUpToADR290OptionalityTimestamp).toHaveBeenCalledWith(ADR_45_TIMESTAMP, expect.any(Function))
    })

    describe('and the entity is not a profile', () => {
      let deployment: DeploymentToValidate
      beforeEach(() => {
        const entity = buildEntity({
          type: EntityType.SCENE,
          timestamp: ADR_45_TIMESTAMP + 1000,
          content: [{ file: 'scene.json', hash: 'someHash' }]
        })
        deployment = buildDeployment({ entity })
      })

      it('should return ok', async () => {
        const result: ValidationResponse =
          await allContentFilesCorrespondToAtLeastOneAvatarSnapshotAfterADR45ValidateFn(deployment)
        expect(result.ok).toBe(true)
      })
    })

    describe('and the entity is a profile', () => {
      let deployment: DeploymentToValidate
      let content: ContentMapping[]

      beforeEach(() => {
        content = []
        deployment = buildDeployment({
          entity: buildProfileEntity({ timestamp: ADR_45_TIMESTAMP + 1000, content, metadata: VALID_PROFILE_METADATA }),
          files: new Map()
        })
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
        beforeEach(() => {
          const invalidFile = 'invalid.png'
          const invalidHash = 'invalidHash'
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
        beforeEach(() => {
          const wrongHash = 'wrongHashForFace256'
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
  })

  describe('when validating that all mandatory content files are present', () => {
    it('should call validateUpToADR290OptionalityTimestamp with ADR_158_TIMESTAMP', async () => {
      const deployment: DeploymentToValidate = buildDeployment({
        entity: buildProfileEntity({ timestamp: ADR_158_TIMESTAMP + 1000 })
      })

      await allMandatoryContentFilesArePresentValidateFn(deployment)
      expect(mockValidateUpToADR290OptionalityTimestamp).toHaveBeenCalledWith(ADR_158_TIMESTAMP, expect.any(Function))
    })

    describe('and the entity is not a profile', () => {
      let deployment: DeploymentToValidate
      beforeEach(() => {
        const entity = buildEntity({
          type: EntityType.SCENE,
          timestamp: ADR_158_TIMESTAMP + 1000,
          content: []
        })
        deployment = buildDeployment({ entity })
      })

      it('should return ok', async () => {
        const result: ValidationResponse = await allMandatoryContentFilesArePresentValidateFn(deployment)
        expect(result.ok).toBe(true)
      })
    })

    describe('and the entity is a profile', () => {
      let deployment: DeploymentToValidate
      let content: ContentMapping[]
      let files: Map<string, Uint8Array>

      beforeEach(() => {
        content = []
        files = new Map()
        deployment = buildDeployment({
          entity: buildProfileEntity({ timestamp: ADR_158_TIMESTAMP + 1000, content }),
          files
        })
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
  })

  describe('when validating that the entity should not have content files', () => {
    it('should call validateAfterADR290RejectedTimestamp', async () => {
      const deployment: DeploymentToValidate = buildDeployment({
        entity: buildProfileEntity({ timestamp: ADR_290_REJECTED_TIMESTAMP + 1 })
      })
      await entityShouldNotHaveContentFilesValidateFn(deployment)
      expect(mockValidateAfterADR290RejectedTimestamp).toHaveBeenCalledWith(expect.any(Function))
    })

    describe('and the entity is not a profile', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        const entity = buildEntity({
          type: EntityType.SCENE,
          timestamp: ADR_290_REJECTED_TIMESTAMP + 1,
          content: [{ file: 'scene.json', hash: 'hash1' }]
        })
        deployment = buildDeployment({ entity })
      })

      it('should return ok', async () => {
        const result: ValidationResponse = await entityShouldNotHaveContentFilesValidateFn(deployment)
        expect(result.ok).toBe(true)
      })
    })

    describe('and the entity is a profile', () => {
      let deployment: DeploymentToValidate
      let content: ContentMapping[]
      let files: Map<string, Uint8Array>

      beforeEach(() => {
        content = []
        files = new Map()
        deployment = buildDeployment({
          entity: buildProfileEntity({ timestamp: ADR_290_REJECTED_TIMESTAMP + 1, content }),
          files
        })
      })

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
})
