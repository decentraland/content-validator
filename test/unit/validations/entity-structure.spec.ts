import { DeploymentToValidate, ValidationResponse } from '../../../src/types'
import { entityStructureValidationFn } from '../../../src/validations/entity-structure'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'

describe('when validating entity structure', () => {
  let deployment: DeploymentToValidate
  let result: ValidationResponse

  afterEach(() => {
    jest.resetAllMocks()
  })

  describe('and the entity has valid pointers', () => {
    beforeEach(async () => {
      deployment = buildDeployment({ entity: buildEntity({ pointers: ['P1', 'P2'] }) })
      result = await entityStructureValidationFn(deployment)
    })

    it('should return ok', () => {
      expect(result.ok).toBe(true)
    })
  })

  describe('and the entity has repeated pointers', () => {
    beforeEach(async () => {
      deployment = buildDeployment({ entity: buildEntity({ pointers: ['P1', 'P1'] }) })
      result = await entityStructureValidationFn(deployment)
    })

    it('should return an error about repeated pointers', () => {
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('There are repeated pointers in your request.')
    })
  })

  describe('and the entity has an empty pointers array', () => {
    beforeEach(async () => {
      deployment = buildDeployment({ entity: buildEntity({ pointers: [] }) })
      result = await entityStructureValidationFn(deployment)
    })

    it('should return an error about missing pointers', () => {
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('The entity needs to be pointed by one or more pointers.')
    })
  })

  describe('and the entity pointers is undefined', () => {
    beforeEach(async () => {
      deployment = buildDeployment({ entity: buildEntity({ pointers: undefined as any }) })
      result = await entityStructureValidationFn(deployment)
    })

    it('should return an error instead of throwing', () => {
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('The entity needs to be pointed by one or more pointers.')
    })
  })

  describe('and the entity pointers is null', () => {
    beforeEach(async () => {
      deployment = buildDeployment({ entity: buildEntity({ pointers: null as any }) })
      result = await entityStructureValidationFn(deployment)
    })

    it('should return an error instead of throwing', () => {
      expect(result.ok).toBe(false)
      expect(result.errors).toContain('The entity needs to be pointed by one or more pointers.')
    })
  })
})
