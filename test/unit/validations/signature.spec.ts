import { signature } from '../../../src/validations/signature'
import { buildDeployment, buildProfileDeployment } from '../../setup/deployments'
import { buildEntity } from '../../setup/entity'
import { buildExternalCalls } from '../../setup/mock'

describe('Signature', () => {
  it(`When can't validate signature, it's reported`, async () => {
    const testMessage = 'test'
    const entity = buildEntity()
    const deployment = buildDeployment(entity)
    const externalCalls = buildExternalCalls({
      validateSignature: () => Promise.resolve({ ok: false, message: testMessage }),
    })

    const result = await signature.validate({ deployment, externalCalls })

    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain(`The signature is invalid. ${testMessage}`)
  })

  it(`When can validate signature, then no errors are reported`, async () => {
    const entity = buildEntity()
    const deployment = buildDeployment(entity)
    const externalCalls = buildExternalCalls({
      validateSignature: () => Promise.resolve({ ok: true }),
    })

    const result = await signature.validate({ deployment, externalCalls })

    expect(result.ok).toBeTruthy()
  })
})
