import { entityStructureValidationFn } from '../../../src/validations/entity-structure'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'

describe('entityStructureValidationFn', () => {
  it('when entity has valid pointers, validation passes', async () => {
    const deployment = buildDeployment({ entity: buildEntity({ pointers: ['P1', 'P2'] }) })
    const result = await entityStructureValidationFn(deployment)
    expect(result.ok).toBe(true)
  })

  it('when entity has repeated pointers, validation fails', async () => {
    const deployment = buildDeployment({ entity: buildEntity({ pointers: ['P1', 'P1'] }) })
    const result = await entityStructureValidationFn(deployment)
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('There are repeated pointers in your request.')
  })

  it('when entity has empty pointers array, validation fails', async () => {
    const deployment = buildDeployment({ entity: buildEntity({ pointers: [] }) })
    const result = await entityStructureValidationFn(deployment)
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('The entity needs to be pointed by one or more pointers.')
  })

  it('when entity pointers is undefined, validation fails instead of throwing', async () => {
    const deployment = buildDeployment({ entity: buildEntity({ pointers: undefined as any }) })
    const result = await entityStructureValidationFn(deployment)
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('The entity needs to be pointed by one or more pointers.')
  })

  it('when entity pointers is null, validation fails instead of throwing', async () => {
    const deployment = buildDeployment({ entity: buildEntity({ pointers: null as any }) })
    const result = await entityStructureValidationFn(deployment)
    expect(result.ok).toBe(false)
    expect(result.errors).toContain('The entity needs to be pointed by one or more pointers.')
  })
})
