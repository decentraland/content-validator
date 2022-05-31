import { signature } from '../../../src/validations/signature'
import { buildDeployment } from '../../setup/deployments'
import { buildComponents, buildExternalCalls } from '../../setup/mock'

describe('Signature', () => {
  it(`When can't validate signature, it's reported`, async () => {
    const testMessage = 'test'
    const deployment = buildDeployment()
    const externalCalls = buildExternalCalls({
      validateSignature: () =>
        Promise.resolve({ ok: false, message: testMessage })
    })

    const result = await signature.validate(
      deployment,
      buildComponents({ externalCalls })
    )

    expect(result.ok).toBeFalsy()
    expect(result.errors).toContain(`The signature is invalid. ${testMessage}`)
  })

  it(`When can validate signature, then no errors are reported`, async () => {
    const deployment = buildDeployment()
    const externalCalls = buildExternalCalls({
      validateSignature: () => Promise.resolve({ ok: true })
    })

    const result = await signature.validate(
      deployment,
      buildComponents({ externalCalls })
    )

    expect(result.ok).toBeTruthy()
  })
})
