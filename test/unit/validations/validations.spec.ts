import { ContentMapping, EntityType } from '@dcl/schemas'
import { DeploymentToValidate, OK, ValidationResponse } from '../../../src/types'
import {
  ADR_158_TIMESTAMP,
  ADR_173_TIMESTAMP,
  ADR_232_TIMESTAMP,
  ADR_236_TIMESTAMP,
  ADR_244_TIMESTAMP,
  ADR_290_OPTIONAL_TIMESTAMP,
  ADR_290_REJECTED_TIMESTAMP,
  ADR_45_TIMESTAMP,
  ADR_74_TIMESTAMP,
  ADR_75_TIMESTAMP
} from '../../../src/validations/timestamps'
import {
  validateAfterADR173,
  validateAfterADR232,
  validateAfterADR236,
  validateAfterADR244,
  validateAfterADR290RejectedTimestamp,
  validateAfterADR45,
  validateAfterADR74,
  validateAfterADR75,
  validateAll,
  validateIfConditionMet,
  validateIfTypeMatches,
  validateUpToADR290OptionalityTimestamp
} from '../../../src/validations/validations'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity, buildProfileEntity } from '../../setup/entity'
import { VALID_PROFILE_METADATA } from '../../setup/profiles'

describe('when testing validation wrapper functions', () => {
  let mockValidateFn: jest.Mock<Promise<ValidationResponse>>
  let resultFromMockValidateFn: ValidationResponse
  afterEach(() => {
    jest.clearAllMocks()
  })

  beforeEach(() => {
    resultFromMockValidateFn = { ok: true }
    mockValidateFn = jest.fn().mockResolvedValue(resultFromMockValidateFn)
  })

  describe('when using validateAll', () => {
    let deployment: DeploymentToValidate
    let mockValidateFn1: jest.Mock<Promise<ValidationResponse>>
    let mockValidateFn2: jest.Mock<Promise<ValidationResponse>>
    let mockValidateFn3: jest.Mock<Promise<ValidationResponse>>

    beforeEach(() => {
      deployment = buildDeployment({ entity: buildEntity() })
    })

    describe('and all validation functions pass', () => {
      beforeEach(() => {
        mockValidateFn1 = jest.fn().mockResolvedValue(OK)
        mockValidateFn2 = jest.fn().mockResolvedValue(OK)
        mockValidateFn3 = jest.fn().mockResolvedValue(OK)
      })

      it('should call all validation functions in order and return ok', async () => {
        const validateFn = validateAll(mockValidateFn1, mockValidateFn2, mockValidateFn3)
        const result = await validateFn(deployment)
        expect(mockValidateFn1).toHaveBeenCalledWith(deployment)
        expect(mockValidateFn2).toHaveBeenCalledWith(deployment)
        expect(mockValidateFn3).toHaveBeenCalledWith(deployment)
        expect(result).toEqual(OK)
      })
    })

    describe('and the first validation function fails', () => {
      let errorResponse: ValidationResponse

      beforeEach(() => {
        errorResponse = { ok: false, errors: ['First validation failed'] }
        mockValidateFn1 = jest.fn().mockResolvedValue(errorResponse)
        mockValidateFn2 = jest.fn().mockResolvedValue(OK)
        mockValidateFn3 = jest.fn().mockResolvedValue(OK)
      })

      it('should return the error and not call subsequent validation functions', async () => {
        const validateFn = validateAll(mockValidateFn1, mockValidateFn2, mockValidateFn3)
        const result = await validateFn(deployment)
        expect(mockValidateFn1).toHaveBeenCalledWith(deployment)
        expect(mockValidateFn2).not.toHaveBeenCalled()
        expect(mockValidateFn3).not.toHaveBeenCalled()
        expect(result).toEqual(errorResponse)
      })
    })

    describe('and a middle validation function fails', () => {
      let errorResponse: ValidationResponse

      beforeEach(() => {
        errorResponse = { ok: false, errors: ['Second validation failed'] }
        mockValidateFn1 = jest.fn().mockResolvedValue(OK)
        mockValidateFn2 = jest.fn().mockResolvedValue(errorResponse)
        mockValidateFn3 = jest.fn().mockResolvedValue(OK)
      })

      it('should return the error and not call subsequent validation functions', async () => {
        const validateFn = validateAll(mockValidateFn1, mockValidateFn2, mockValidateFn3)
        const result = await validateFn(deployment)
        expect(mockValidateFn1).toHaveBeenCalledWith(deployment)
        expect(mockValidateFn2).toHaveBeenCalledWith(deployment)
        expect(mockValidateFn3).not.toHaveBeenCalled()
        expect(result).toEqual(errorResponse)
      })
    })

    describe('and no validation functions are provided', () => {
      it('should return ok', async () => {
        const validateFn = validateAll()
        const result = await validateFn(deployment)
        expect(result).toEqual(OK)
      })
    })
  })

  describe('when using validateIfConditionMet', () => {
    let deployment: DeploymentToValidate
    let condition: jest.Mock<boolean>
    let mockValidateFn: jest.Mock<Promise<ValidationResponse>>
    let validationResponse: ValidationResponse

    beforeEach(() => {
      deployment = buildDeployment({ entity: buildEntity() })
    })

    describe('and the condition returns true', () => {
      beforeEach(() => {
        condition = jest.fn().mockReturnValue(true)
        validationResponse = { ok: true }
        mockValidateFn = jest.fn().mockResolvedValue(validationResponse)
      })

      it('should call the validation function and return its result', async () => {
        const validateFn = validateIfConditionMet(condition, mockValidateFn)
        const result = await validateFn(deployment)
        expect(condition).toHaveBeenCalledWith(deployment)
        expect(mockValidateFn).toHaveBeenCalledWith(deployment)
        expect(result).toEqual(validationResponse)
      })
    })

    describe('and the condition returns false', () => {
      beforeEach(() => {
        condition = jest.fn().mockReturnValue(false)
        mockValidateFn = jest.fn().mockResolvedValue({ ok: false, errors: ['Should not be called'] })
      })

      it('should not call the validation function and return ok', async () => {
        const validateFn = validateIfConditionMet(condition, mockValidateFn)
        const result = await validateFn(deployment)
        expect(condition).toHaveBeenCalledWith(deployment)
        expect(mockValidateFn).not.toHaveBeenCalled()
        expect(result).toEqual(OK)
      })
    })
  })

  describe('when validating after ADR 45', () => {
    describe('and the timestamp is before ADR 45', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_45_TIMESTAMP - 1000 }) })
      })

      it('should not call the validation function and return ok', async () => {
        const validateFn = validateAfterADR45(mockValidateFn)
        const result = await validateFn(deployment)
        expect(mockValidateFn).not.toHaveBeenCalled()
        expect(result).toEqual(OK)
      })
    })

    describe('and the timestamp is at or after ADR 45', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_45_TIMESTAMP + 1000 }) })
      })

      it('should call the validation function and return the result from the validation function', async () => {
        const validateFn = validateAfterADR45(mockValidateFn)
        const result = await validateFn(deployment)
        expect(mockValidateFn).toHaveBeenCalledWith(deployment)
        expect(result).toEqual(resultFromMockValidateFn)
      })
    })
  })

  describe('when validating after ADR 74', () => {
    describe('and the timestamp is before ADR 74', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_74_TIMESTAMP - 1000 }) })
      })

      it('should return ok without calling the validation function', async () => {
        const validateFn = validateAfterADR74(mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(OK)
        expect(mockValidateFn).not.toHaveBeenCalled()
      })
    })

    describe('and the timestamp is at or after ADR 74', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_74_TIMESTAMP + 1000 }) })
      })

      it('should call the validation function and return the result from the validation function', async () => {
        const validateFn = validateAfterADR74(mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(resultFromMockValidateFn)
        expect(mockValidateFn).toHaveBeenCalledWith(deployment)
      })
    })
  })

  describe('when validating after ADR 75', () => {
    describe('and the timestamp is before ADR 75', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_75_TIMESTAMP - 1000 }) })
      })

      it('should return ok without calling the validation function', async () => {
        const validateFn = validateAfterADR75(mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(OK)
        expect(mockValidateFn).not.toHaveBeenCalled()
      })
    })

    describe('and the timestamp is at or after ADR 75', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_75_TIMESTAMP + 1000 }) })
      })

      it('should call the validation function and return the result from the validation function', async () => {
        const validateFn = validateAfterADR75(mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(resultFromMockValidateFn)
        expect(mockValidateFn).toHaveBeenCalledWith(deployment)
      })
    })
  })

  describe('when validating after ADR 173', () => {
    describe('and the timestamp is before ADR 173', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_173_TIMESTAMP - 1000 }) })
      })

      it('should return ok without calling the validation function', async () => {
        const validateFn = validateAfterADR173(mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(OK)
        expect(mockValidateFn).not.toHaveBeenCalled()
      })
    })

    describe('and the timestamp is at or after ADR 173', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_173_TIMESTAMP + 1000 }) })
      })

      it('should call the validation function and return the result from the validation function', async () => {
        const validateFn = validateAfterADR173(mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(resultFromMockValidateFn)
        expect(mockValidateFn).toHaveBeenCalledWith(deployment)
      })
    })
  })

  describe('when validating after ADR 232', () => {
    describe('and the timestamp is before ADR 232', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_232_TIMESTAMP - 1000 }) })
      })

      it('should return ok without calling the validation function', async () => {
        const validateFn = validateAfterADR232(mockValidateFn)
        const result = await validateFn(deployment)
        expect(result.ok).toBe(true)
        expect(mockValidateFn).not.toHaveBeenCalled()
      })
    })

    describe('and the timestamp is at or after ADR 232', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_232_TIMESTAMP + 1000 }) })
      })

      it('should call the validation function and return the result from the validation function', async () => {
        const validateFn = validateAfterADR232(mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(resultFromMockValidateFn)
        expect(mockValidateFn).toHaveBeenCalledWith(deployment)
      })
    })
  })

  describe('when validating after ADR 236', () => {
    describe('and the timestamp is before ADR 236', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_236_TIMESTAMP - 1000 }) })
      })

      it('should return ok without calling the validation function', async () => {
        const validateFn = validateAfterADR236(mockValidateFn)
        const result = await validateFn(deployment)
        expect(result.ok).toBe(true)
        expect(mockValidateFn).not.toHaveBeenCalled()
      })
    })

    describe('and the timestamp is at or after ADR 236', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_236_TIMESTAMP + 1000 }) })
      })

      it('should call the validation function and return the result from the validation function', async () => {
        const validateFn = validateAfterADR236(mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(resultFromMockValidateFn)
        expect(mockValidateFn).toHaveBeenCalledWith(deployment)
      })
    })
  })

  describe('when validating after ADR 244', () => {
    let mockValidateFn: jest.Mock<Promise<ValidationResponse>>

    beforeEach(() => {
      mockValidateFn = jest.fn().mockResolvedValue(OK)
    })

    describe('and the timestamp is before ADR 244', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_244_TIMESTAMP - 1000 }) })
      })

      it('should return ok without calling the validation function', async () => {
        const validateFn = validateAfterADR244(mockValidateFn)
        const result = await validateFn(deployment)
        expect(result.ok).toBe(true)
        expect(mockValidateFn).not.toHaveBeenCalled()
      })
    })

    describe('and the timestamp is at or after ADR 244', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_244_TIMESTAMP + 1000 }) })
      })

      it('should call the validation function and return the result from the validation function', async () => {
        const validateFn = validateAfterADR244(mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(resultFromMockValidateFn)
        expect(mockValidateFn).toHaveBeenCalledWith(deployment)
      })
    })
  })

  describe('when validating if entity type matches', () => {
    let mockValidateFn: jest.Mock<Promise<ValidationResponse>>

    beforeEach(() => {
      mockValidateFn = jest.fn().mockResolvedValue(OK)
    })

    describe('and the entity type matches', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ type: EntityType.PROFILE }) })
      })

      it('should call the validation function', async () => {
        const validateFn = validateIfTypeMatches(EntityType.PROFILE, mockValidateFn)
        await validateFn(deployment)
        expect(mockValidateFn).toHaveBeenCalledWith(deployment)
      })
    })

    describe('and the entity type does not match', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ type: EntityType.SCENE }) })
      })

      it('should not call the validation function and return ok', async () => {
        const validateFn = validateIfTypeMatches(EntityType.PROFILE, mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(OK)
        expect(mockValidateFn).not.toHaveBeenCalled()
      })
    })
  })

  describe('when validating after ADR 290 rejected timestamp', () => {
    describe('and the timestamp is before ADR 290 rejected timestamp', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_290_REJECTED_TIMESTAMP - 1000 }) })
      })

      it('should return ok without calling the validation function', async () => {
        const validateFn = validateAfterADR290RejectedTimestamp(mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(OK)
        expect(mockValidateFn).not.toHaveBeenCalled()
      })
    })

    describe('and the timestamp is at or after ADR 290 rejected timestamp', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({ entity: buildEntity({ timestamp: ADR_290_REJECTED_TIMESTAMP + 1000 }) })
      })

      it('should call the validation function and return the result from the validation function', async () => {
        const validateFn = validateAfterADR290RejectedTimestamp(mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(resultFromMockValidateFn)
        expect(mockValidateFn).toHaveBeenCalledWith(deployment)
      })
    })
  })

  describe('when validating up to ADR 290 optionality timestamp', () => {
    const fromTimestamp = ADR_158_TIMESTAMP

    describe('and the timestamp is before the from timestamp', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({
          entity: buildProfileEntity({ timestamp: fromTimestamp - 1000, content: [] })
        })
      })

      it('should return ok without calling the validation function', async () => {
        const validateFn = validateUpToADR290OptionalityTimestamp(fromTimestamp, mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(OK)
        expect(mockValidateFn).not.toHaveBeenCalled()
      })
    })

    describe('and the timestamp is between from timestamp and ADR 290 optional timestamp', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        const timestamp = Math.floor((fromTimestamp + ADR_290_OPTIONAL_TIMESTAMP) / 2)
        deployment = buildDeployment({
          entity: buildProfileEntity({ timestamp, content: [] })
        })
      })

      it('should call the validation function and return the result from the validation function', async () => {
        const validateFn = validateUpToADR290OptionalityTimestamp(fromTimestamp, mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(resultFromMockValidateFn)
        expect(mockValidateFn).toHaveBeenCalledWith(deployment)
      })
    })

    describe('and the timestamp is at or after ADR 290 rejected timestamp', () => {
      let deployment: DeploymentToValidate

      beforeEach(() => {
        deployment = buildDeployment({
          entity: buildProfileEntity({ timestamp: ADR_290_REJECTED_TIMESTAMP + 1000, content: [] })
        })
      })

      it('should return ok without calling the validation function', async () => {
        const validateFn = validateUpToADR290OptionalityTimestamp(fromTimestamp, mockValidateFn)
        const result = await validateFn(deployment)
        expect(result).toEqual(OK)
        expect(mockValidateFn).not.toHaveBeenCalled()
      })
    })

    describe('and the timestamp is in the optional period', () => {
      const optionalTimestamp = ADR_290_OPTIONAL_TIMESTAMP + 1000

      describe('and the entity is a profile', () => {
        let deployment: DeploymentToValidate
        let content: ContentMapping[]
        let files: Map<string, Uint8Array>

        beforeEach(() => {
          content = []
          files = new Map()
          deployment = buildDeployment({
            entity: buildProfileEntity({ metadata: VALID_PROFILE_METADATA, timestamp: optionalTimestamp, content }),
            files
          })
        })

        describe('and the profile has content files', () => {
          beforeEach(() => {
            content.push({ file: 'body.png', hash: 'hash1' })
          })

          it('should call the validation function and return the result from the validation function', async () => {
            const validateFn = validateUpToADR290OptionalityTimestamp(fromTimestamp, mockValidateFn)
            const result = await validateFn(deployment)
            expect(result).toEqual(resultFromMockValidateFn)
            expect(mockValidateFn).toHaveBeenCalledWith(deployment)
          })
        })

        describe('and the profile has uploaded files', () => {
          beforeEach(() => {
            files.set('hash1', new Uint8Array())
          })

          it('should call the validation function and return the result from the validation function', async () => {
            const validateFn = validateUpToADR290OptionalityTimestamp(fromTimestamp, mockValidateFn)
            const result = await validateFn(deployment)
            expect(result).toEqual(resultFromMockValidateFn)
            expect(mockValidateFn).toHaveBeenCalledWith(deployment)
          })
        })

        describe('and the profile has snapshots in the avatar metadata', () => {
          beforeEach(() => {
            deployment.entity.metadata.avatars[0].avatar.snapshots = {
              face256: 'hash1'
            }
          })

          it('should call the validation function and return the result from the validation function', async () => {
            const validateFn = validateUpToADR290OptionalityTimestamp(fromTimestamp, mockValidateFn)
            const result = await validateFn(deployment)
            expect(result).toEqual(resultFromMockValidateFn)
            expect(mockValidateFn).toHaveBeenCalledWith(deployment)
          })
        })

        describe('and the profile has no content, files, or snapshots in the avatar metadata', () => {
          beforeEach(() => {
            deployment.entity.metadata.avatars[0].avatar.snapshots = undefined
          })

          it('should call the validation function and return the result from the validation function', async () => {
            const validateFn = validateUpToADR290OptionalityTimestamp(fromTimestamp, mockValidateFn)
            const result = await validateFn(deployment)
            expect(result).toEqual(resultFromMockValidateFn)
            expect(mockValidateFn).toHaveBeenCalledWith(deployment)
          })
        })
      })

      describe('and the entity is not a profile', () => {
        let deployment: DeploymentToValidate

        beforeEach(() => {
          deployment = buildDeployment({
            entity: buildEntity({ type: EntityType.SCENE, timestamp: optionalTimestamp, content: [] })
          })
        })

        it('should call the validation function and return the result from the validation function', async () => {
          const validateFn = validateUpToADR290OptionalityTimestamp(fromTimestamp, mockValidateFn)
          const result = await validateFn(deployment)
          expect(result).toEqual(resultFromMockValidateFn)
          expect(mockValidateFn).toHaveBeenCalledWith(deployment)
        })
      })
    })
  })
})
