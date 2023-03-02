import { createSceneValidateFn } from '../../../src/validations/access/on-chain/scenes'
import { buildSceneDeployment } from '../../setup/deployments'
import { buildExternalCalls } from '../../setup/mock'
import { buildOnChainAccessCheckerComponents } from './mock'

describe('Access: scenes', () => {
  it('When a non-decentraland address tries to deploy a default scene, then an error is returned', async () => {
    const pointers = ['Default10']
    const deployment = buildSceneDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => false,
      ownerAddress: () => '0xAddress'
    })

    const validateFn = createSceneValidateFn(buildOnChainAccessCheckerComponents({ externalCalls }))
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'Scene pointers should only contain two integers separated by a comma, for example (10,10) or (120,-45). Invalid pointer: default10'
    )
  })

  it('When a decentraland address tries to deploy an default scene, then it is not allowed', async () => {
    const pointers = ['Default10']
    const deployment = buildSceneDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => '0xAddress'
    })

    const validateFn = createSceneValidateFn(buildOnChainAccessCheckerComponents({ externalCalls }))
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
  })

  it('When non-urns are used as pointers, then validation fails', async () => {
    const pointers = ['invalid-pointer']
    const deployment = buildSceneDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => '0xAddress'
    })

    const validateFn = createSceneValidateFn(buildOnChainAccessCheckerComponents({ externalCalls }))
    const response = await validateFn(deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'Scene pointers should only contain two integers separated by a comma, for example (10,10) or (120,-45). Invalid pointer: invalid-pointer'
    )
  })
})
