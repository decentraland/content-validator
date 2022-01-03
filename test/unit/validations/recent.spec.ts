import ms from 'ms'
import { recent } from '../../../src/validations/recent'
import { buildDeployment, buildProfileDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { buildExternalCalls } from '../../setup/mock'

describe('Recent', () => {
  const externalCalls = buildExternalCalls()
  it(`When an entity with a timestamp too far into the past is deployed, then an error is returned`, async () => {
    const entity = buildEntity({ timestamp: Date.now() - ms('25m') })
    const deployment = buildDeployment(entity)

    const result = await recent.validate({ deployment, externalCalls })

    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain('The request is not recent enough, please submit it again with a new timestamp.')
  })

  it(`When an entity with a timestamp too far into the future is deployed, then an error is returned`, async () => {
    const entity = buildEntity({ timestamp: Date.now() + ms('20m') })
    const deployment = buildDeployment(entity)

    const result = await recent.validate({ deployment, externalCalls })

    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain(
      'The request is too far in the future, please submit it again with a new timestamp.'
    )
  })

  it(`When an entity with the correct timestamp is deployed, then no error is returned`, async () => {
    const entity = buildEntity({ timestamp: Date.now() })
    const deployment = buildDeployment(entity)

    const result = await recent.validate({ deployment, externalCalls })

    expect(result.ok).toBeTruthy()
  })
})
