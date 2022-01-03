import { rateLimit } from '../../../src/validations/rate-limit'
import { buildDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { buildExternalCalls } from '../../setup/mock'

describe('Rate Limit', () => {
  it('When it should not be rate limit, then the entity is deployed', async () => {
    const deployment = buildDeployment()
    const externalCalls = buildExternalCalls({
      isEntityRateLimited: () => Promise.resolve(false),
    })

    const result = await rateLimit.validate({ deployment, externalCalls })
    expect(result.ok).toBeTruthy()
  })
  it('When it should be rate limit, then the entity is not deployed', async () => {
    const entity = buildEntity()
    const deployment = buildDeployment({ entity })
    const externalCalls = buildExternalCalls({
      isEntityRateLimited: () => Promise.resolve(true),
    })

    const result = await rateLimit.validate({ deployment, externalCalls })
    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain(
      `Entity rate limited (entityId=${entity.id} pointers=${entity.pointers.join(',')}).`
    )
  })
})
