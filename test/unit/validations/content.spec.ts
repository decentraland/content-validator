import { ContentMapping } from '@dcl/schemas'
import { DeploymentToValidate, ValidationResponse } from '../../../src/types'
import {
  allHashesInUploadedFilesAreReportedInTheEntityValidateFn,
  createAllHashesWereUploadedOrStoredValidateFn
} from '../../../src/validations/content'
import { ADR_45_TIMESTAMP } from '../../../src/validations/timestamps'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity, buildProfileEntity } from '../../setup/entity'
import { buildComponents, buildExternalCalls } from '../../setup/mock'

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
})
