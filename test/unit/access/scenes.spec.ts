import { access } from '../../../src/validations/access-checker/access'
import { scenes } from '../../../src/validations/access-checker/scenes'
import { buildSceneDeployment } from '../../setup/deployments'
import { buildComponents, buildConfig, buildExternalCalls } from '../../setup/mock'

describe('Access: scenes', () => {
  it('When a non-decentraland address tries to deploy a default scene, then an error is returned', async () => {
    const pointers = ['Default10']
    const deployment = buildSceneDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => false,
      ownerAddress: () => '0xAddress'
    })

    const response = await scenes.validate(buildComponents({ externalCalls }), deployment)
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

    const response = await scenes.validate(buildComponents({ externalCalls }), deployment)
    expect(response.ok).toBeFalsy()
  })

  it('When non-urns are used as pointers, then validation fails', async () => {
    const pointers = ['invalid-pointer']
    const deployment = buildSceneDeployment(pointers)
    const externalCalls = buildExternalCalls({
      isAddressOwnedByDecentraland: () => true,
      ownerAddress: () => '0xAddress'
    })

    const response = await scenes.validate(buildComponents({ externalCalls }), deployment)
    expect(response.ok).toBeFalsy()
    expect(response.errors).toContain(
      'Scene pointers should only contain two integers separated by a comma, for example (10,10) or (120,-45). Invalid pointer: invalid-pointer'
    )
  })

  describe('blockchain access check validations', () => {
    it('When IGNORE_BLOCKCHAIN_ACCESS_CHECKS=false, then ownerAddress function is invoked', async () => {
      const pointers = ['Default10']
      const deployment = buildSceneDeployment(pointers)
      const config = buildConfig({
        IGNORE_BLOCKCHAIN_ACCESS_CHECKS: 'false'
      })
      const ownerAddress = jest.fn()
      ownerAddress.mockResolvedValue('0xAddress')
      const externalCalls = buildExternalCalls({
        isAddressOwnedByDecentraland: () => true,
        ownerAddress
      })

      const response = await access.validate(buildComponents({ config, externalCalls }), deployment)
      expect(response.ok).toBeFalsy()
      expect(ownerAddress).toHaveBeenCalled()
    })

    it('When IGNORE_BLOCKCHAIN_ACCESS_CHECKS=false, then ownerAddress function is not invoked', async () => {
      const pointers = ['Default10']
      const deployment = buildSceneDeployment(pointers)
      const config = buildConfig({
        IGNORE_BLOCKCHAIN_ACCESS_CHECKS: 'true'
      })
      const ownerAddress = jest.fn()
      const externalCalls = buildExternalCalls({
        ownerAddress
      })

      const response = await access.validate(buildComponents({ config, externalCalls }), deployment)
      expect(response.ok).toBeTruthy()
      expect(ownerAddress).not.toHaveBeenCalled()
    })
  })
})
