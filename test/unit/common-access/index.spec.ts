import { EntityType } from '@dcl/schemas'
import { createPointerValidateFn } from '../../../src/validations/access/common/profile'
import { createAccessValidateFn } from '../../../src/validations/access/index'
import { LEGACY_CONTENT_MIGRATION_TIMESTAMP } from '../../../src/validations/timestamps'
import { buildDeployment } from '../../setup/deployments'
import { buildProfileEntity } from '../../setup/entity'
import { buildExternalCalls } from '../../setup/mock'

describe('createAccessValidateFn', () => {
  const deployerAddress = '0x0000000000000000000000000000000000000001'
  const pointerAddress = '0x0000000000000000000000000000000000000002'
  const externalCalls = buildExternalCalls({
    ownerAddress: () => deployerAddress,
    isAddressOwnedByDecentraland: (address) => address === deployerAddress
  })
  const accessValidateFns = {
    [EntityType.PROFILE]: createPointerValidateFn({ externalCalls }),
    [EntityType.SCENE]: jest.fn(),
    [EntityType.WEARABLE]: jest.fn(),
    [EntityType.STORE]: jest.fn(),
    [EntityType.EMOTE]: jest.fn(),
    [EntityType.OUTFITS]: jest.fn()
  }

  const validateFn = createAccessValidateFn({ externalCalls }, accessValidateFns)

  it('when access is not met, deployer is DCL but deployment timestamp is after DCL Launch, validation fails', async () => {
    const entity = buildProfileEntity({
      pointers: [pointerAddress],
      timestamp: LEGACY_CONTENT_MIGRATION_TIMESTAMP + 1
    })
    const deployment = buildDeployment({ entity })
    const result = await validateFn(deployment)
    expect(result.ok).toBeFalsy()
    expect(result.errors).toEqual([
      'You can only alter your own profile. The pointer address and the signer address are different (pointer:0x0000000000000000000000000000000000000002 signer: 0x0000000000000000000000000000000000000001).'
    ])
  })
  it('when access is not met, deployer is DCL but deployment timestamp is before DCL Launch, validation pass', async () => {
    const entity = buildProfileEntity({
      pointers: [pointerAddress],
      timestamp: LEGACY_CONTENT_MIGRATION_TIMESTAMP - 1
    })
    const deployment = buildDeployment({ entity })
    const result = await validateFn(deployment)
    expect(result.ok).toBeTruthy()
  })
})
