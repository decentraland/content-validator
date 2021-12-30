import { scenes } from '../../../src/validations/access-checker/scenes'
import { buildSceneDeployment } from '../../setup/deployments'
import { buildExternalCalls } from '../../setup/mock'

describe('Access: scenes', () => {
  it('When a non-decentraland address tries to deploy a default scene, then an error is returned', async () => {
    const pointers = ['Default10']
    const deployment = buildSceneDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => false,
      ownerAddress: () => '0xAddress',
    })

    const response = await scenes.validate({ deployment, externalCalls })
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain('Only Decentraland can add or modify default scenes')
  })

  it('When a decentraland address tries to deploy an default scene, then it is allowed', async () => {
    const pointers = ['Default10']
    const deployment = buildSceneDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => '0xAddress',
    })

    const response = await scenes.validate({ deployment, externalCalls })
    expect(response.ok).toBeTruthy()
  })

  it('When non-urns are used as pointers, then validation fails', async () => {
    const pointers = ['invalid-pointer']
    const deployment = buildSceneDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => '0xAddress',
    })

    const response = await scenes.validate({ deployment, externalCalls })
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'Scene pointers should only contain two integers separated by a comma, for example (10,10) or (120,-45). Invalid pointer: invalid-pointer'
    )
  })
})
